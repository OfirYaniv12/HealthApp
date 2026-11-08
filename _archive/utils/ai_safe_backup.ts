import { Meal, Workout } from '@/db/database';
import { UserData } from '@/store/useUserStore';
import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini AI client
// IMPORTANT: The user must define EXPO_PUBLIC_GEMINI_API_KEY in their .env file
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export type MealData = {
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber?: number;
    sodium?: number;
    sugar?: number;
    summary: string;
};

export type AIResponse = {
    isMeal: boolean;
    textResponse?: string;
    mealData?: MealData;
};

export type WorkoutPlan = {
    isWorkout: boolean;
    textResponse?: string;
    workoutData?: {
        name: string;
        duration_minutes: number;
        calories_burned: number;
        summary: string;
    }
};

const RPM_LIMIT = 15;
const DAILY_LIMIT = 500;
let rpmTimestamps: number[] = [];

import { useUserStore } from '@/store/useUserStore';
import { Alert } from 'react-native';

export const checkAndIncrementRateLimits = (): boolean => {
    const now = Date.now();
    rpmTimestamps = rpmTimestamps.filter(t => now - t < 60 * 1000);
    if (rpmTimestamps.length >= RPM_LIMIT) {
        Alert.alert('Limit reached', `Limit reached: ${rpmTimestamps.length}/${RPM_LIMIT} (Minute). Please wait a moment or try again tomorrow.`);
        return false;
    }

    const state = useUserStore.getState();
    const today = new Date().toISOString().split('T')[0];
    const daily = state.user?.aiDailyCount || { count: 0, dateStr: today };
    const currentCount = daily.dateStr === today ? daily.count : 0;

    if (currentCount >= 450 && currentCount < DAILY_LIMIT) Alert.alert('Warning', 'You are reaching the daily requests limit.');
    
    if (currentCount >= DAILY_LIMIT) {
        Alert.alert('Limit reached', `Limit reached: ${currentCount}/${DAILY_LIMIT} (Daily). Please wait a moment or try again tomorrow.`);
        return false;
    }

    rpmTimestamps.push(now);
    state.incrementDailyAiCount();
    return true;
};

const SYSTEM_PROMPT = `
You are the HealthApp Nutrition Expert, powered by Google Gemini. Your goal is to be a precise, conversational, and highly intelligent nutrition partner for an Israeli user speaking Hebrew.

YOUR COGNITIVE PROCESS:
1. Deconstruct the user's input. Identify the core items, quantities, and preparation methods.
2. Maintain Context: The user might be correcting a previous meal ("Actually, add an egg") or providing a new meal.
3. Use your deep knowledge of nutritional values (USDA + Israeli market equivalents) to estimate macros.

OUTPUT RULES:
- If the user is just chatting or providing feedback that does NOT require logging a specific food, respond with standard text in Hebrew.
- **CRITICAL**: If the user's intent is to log a meal, you MUST output ONLY a pure JSON object representing the meal. DO NOT wrap the JSON in markdown blocks like \`\`\`json. The JSON MUST follow this exact schema:
{
  "isMeal": true,
  "name": "Summarized name of the meal (e.g. 'סלט ביצים עם מיונז')",
  "calories": 150,
  "protein": 10,
  "fat": 5,
  "carbs": 2,
  "fiber": 1.5,
  "sodium": 200,
  "sugar": 0.5,
  "summary": "Short explanation of how you calculated this (e.g. 'ביצה קשה: 70 קלוריות, מיונז: 80 קלוריות')"
}

- If the input is NOT a meal (e.g. "Hi", "How are you", "I'm not sure"), return:
{
  "isMeal": false,
  "textResponse": "Your helpful response in Hebrew"
}

ZERO HALLUCINATION RULE: If the user provides a completely vague food ("I ate a big thing"), do not log a meal. Return a textResponse asking for clarification (weight, ingredients).
`;

export const generateNutritionResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessageText: string, imageBase64?: string): Promise<AIResponse> => {
    if (!apiKey) { return { isMeal: false, textResponse: 'מפתח API חסר.' }; }
    if (!checkAndIncrementRateLimits()) return { isMeal: false, textResponse: 'הגעת למגבלת קצב.' };
    try {
        let parts: any[] = [{ text: newMessageText }];
        if (imageBase64) { parts.push({ inlineData: { data: imageBase64.split(',')[1] || imageBase64, mimeType: 'image/jpeg' } }); }
        const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const apiPromise = ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [{ role: 'user', parts: parts }],
            config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        const result = await Promise.race([apiPromise, timeoutPromise]);
        const responseText = result.text || '';

        // Clean markdown backticks if Gemini accidentally adds them despite instructions
        let rawJsonStr = responseText.trim();
        if (rawJsonStr.startsWith('```json')) {
            rawJsonStr = rawJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (rawJsonStr.startsWith('```')) {
            rawJsonStr = rawJsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        }

        try {
            const parsed = JSON.parse(rawJsonStr);
            if (parsed.isMeal) {
                return {
                    isMeal: true,
                    mealData: {
                        name: parsed.name,
                        calories: parsed.calories,
                        protein: parsed.protein,
                        fat: parsed.fat,
                        carbs: parsed.carbs,
                        fiber: parsed.fiber || 0,
                        sodium: parsed.sodium || 0,
                        sugar: parsed.sugar || 0,
                        summary: parsed.summary
                    }
                };
            } else {
                return {
                    isMeal: false,
                    textResponse: parsed.textResponse || 'לא הבנתי את התשובה.'
                };
            }
        } catch (jsonError) {
            // Fallback if the model completely ignored the JSON instruction
            return {
                isMeal: false,
                textResponse: responseText
            };
        }

    } catch (e: any) {
        console.log('Gemini API Error:', e.message || e);
        return {
            isMeal: false,
            textResponse: 'שגיאת התחברות למנוע ה-AI. אנא בדוק את חיבור הרשת ומפתח ה-API שלך.'
        };
    }
};

const NUTRITIONIST_SYSTEM_PROMPT = `
You are the HealthApp Clinical Nutritionist and an elite sports nutritionist, an elite AI specialized in Israeli health, physiology, and precise macro calculations.
Your goal is to generate a comprehensive, highly personalized daily nutritional target profile.

Input User Data:
The user will provide their Age, Gender, Height, Weight, Activity Level, Workout Frequency, Body Type, and Primary Goal.

Task Requirements:
1. Calculate Total Daily Energy Expenditure (TDEE).
2. Calculate an appropriate Calorie Surplus or Deficit depending on their Goal (Weight Loss vs Muscle Gain).
3. Compute macronutrients based on lean body mass principles (e.g., protein ~1.6-2.2g per kg depending on activity).
4. Provide targets for Fiber, Sodium, and Sugar appropriate for this user.
5. If the goal is "שילוב מתון" (Moderate Integration / Body Recomposition), prioritize high protein (1.8g-2.2g per kg), set a very slight caloric deficit (200-300 cals), and balance carbs/fats strongly to prioritize fat loss while maintaining energy for workouts.

Output Requirement:
Return ONLY a raw JSON object string. Do not wrap in markdown.
{
  "targets": {
    "calories": 2000,
    "protein": 150,
    "fat": 70,
    "carbs": 190,
    "fiber": 30,
    "sodium": 2300,
    "sugar": 45
  },
  "explanation": "הסבר מפורט בעברית על הסיבות לבחירת הערכים הללו בגישה קלינית ומקצועית."
}
`;

export const generatePersonalizedPlan = async (user: UserData): Promise<{ targets: UserData['daily_targets'], explanation: string } | null> => {
    if (!apiKey) return null;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: NUTRITIONIST_SYSTEM_PROMPT });

        const history: any[] = [];
        const chat = model.startChat({
            history,
            generationConfig: { temperature: 0.1 },
        });

        const userDataMsg = `
גיל: ${user.age}
מין: ${user.gender}
גובה: ${user.height} ס"מ
משקל: ${user.weight} ק"ג
מטרה: ${user.goal}
רמת פעילות: ${user.activity_level}
אימונים בשבוע: ${user.workout_frequency}
מבנה גוף: ${user.body_type}
${user.target_pace ? `קצב מטרה: ${user.target_pace}` : ''}
`;

        const result = await chat.sendMessage(userDataMsg);
        let rawJsonStr = result.response.text().trim();

        if (rawJsonStr.startsWith('```json')) {
            rawJsonStr = rawJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (rawJsonStr.startsWith('```')) {
            rawJsonStr = rawJsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const parsed = JSON.parse(rawJsonStr);
        return {
            targets: parsed.targets,
            explanation: parsed.explanation
        };
    } catch (e: any) {
        console.log('Failed to generate AI Nutrition Plan:', e.message || e);
        return null;
    }
};

const TEMPLATE_WORKOUT_PROMPT = `
You are the HealthApp Elite AI Coach. Your task is to calculate the estimated calories burned for a specific workout template that the user just performed.

Input Context:
- User Profile: (Age, Gender, Weight, Height)
- Workout Name
- Workout Description (from Template)
- User Session Notes (if any)
- Duration (in minutes)

Task Requirements:
Calculate the exact estimated calories burned using MET (Metabolic Equivalent of Task) based on the workout details and the user's weight.

Output Requirement:
Return ONLY a strictly formatted JSON object. Do not wrap in markdown blocks like \`\`\`json.
{
  "calories_burned": 320,
  "summary": "חישוב מבוסס על MET מוערך של 8 עבור אימון זה במשך 45 דק' למתאמן במשקל 70 ק״ג."
}
`;

export const estimateTemplateWorkout = async (
    user: UserData,
    templateName: string,
    templateDescription: string | null,
    userNotes: string | null,
    durationMinutes: number
): Promise<{ calories_burned: number; summary: string } | null> => {
    if (!apiKey) return null;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: TEMPLATE_WORKOUT_PROMPT });

        const history: any[] = [];
        const chat = model.startChat({
            history,
            generationConfig: { temperature: 0.1 },
        });

        const promptMsg = `
User Profile:
- Age: ${user.age}
- Gender: ${user.gender}
- Weight: ${user.weight}kg
- Height: ${user.height}cm

Workout Executed:
- Name: ${templateName}
- Template Info: ${templateDescription || 'ללא תיאור'}
- User Notes for This Session: ${userNotes || 'ללא הערות מיוחדות'}
- Duration: ${durationMinutes} minutes
`;

        const result = await chat.sendMessage(promptMsg);
        let rawJsonStr = result.response.text().trim();

        if (rawJsonStr.startsWith('\`\`\`json')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
        } else if (rawJsonStr.startsWith('\`\`\`')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
        }

        const parsed = JSON.parse(rawJsonStr);
        return {
            calories_burned: parsed.calories_burned,
            summary: parsed.summary
        };
    } catch (e: any) {
        console.log('Failed to estimate template workout:', e.message || e);
        return null;
    }
};

const WORKOUT_SYSTEM_PROMPT = `
You are the HealthApp Elite AI Coach. Your goal is to precisely estimate workout variables based on user input natively in Hebrew.

Input Core Parameters provided on every turn via System prepended text wrapper (e.g. User Weight Kg):
You MUST formulate exact calories burned using MET (Metabolic Equivalent of Task) or related physiology estimations cross-referenced against the provided user weight.

OUTPUT RULES:
- If the user is just chatting, return standard Hebrew text wrapped in JSON.
- If the user logs an actual workout, return ONLY a strict JSON object modeling the run, gym, swim, etc.

JSON SCHEMA REQUIREMENT:
{
  "isWorkout": true,
  "name": "שם האימון (למשל: ריצה קלה בקצב מתון)",
  "duration_minutes": 45,
  "calories_burned": 320,
  "summary": "הסבר קצר: חישוב בוסס על ריצה של 45 דק עבור מתאמן במשקל 70 ק״ג (MET ~8)."
}

NON-WORKOUT CHAT JSON:
{
  "isWorkout": false,
  "textResponse": "תגובה חברית בעברית - לדוגמה: איזה אימון עשית היום וכמה זמן לקח לך?"
}

ZERO HALLUCINATION: If the user says "התאמנתי" without time, politely reject logging it and ask for duration. 
`;

export const generateWorkoutResponse = async (
    history: { role: 'user' | 'model', parts: { text: string }[] }[],
    newMessageText: string,
    userWeightKg: number
): Promise<WorkoutPlan> => {
    if (!apiKey) {
        return {
            isWorkout: false,
            textResponse: 'שגיאת מערכת: מפתח API של Gemini חסר.'
        };
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: WORKOUT_SYSTEM_PROMPT });

        const chat = model.startChat({
            history: history,
            generationConfig: {
                temperature: 0.1,
            },
        });

        const fullPromptMsg = `[User Weight Context: ${userWeightKg}kg]\n\n${newMessageText}`;
        const result = await chat.sendMessage(fullPromptMsg);
        let rawJsonStr = result.response.text().trim();

        if (rawJsonStr.startsWith('\`\`\`json')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
        } else if (rawJsonStr.startsWith('\`\`\`')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
        }

        try {
            const parsed = JSON.parse(rawJsonStr);
            if (parsed.isWorkout) {
                return {
                    isWorkout: true,
                    workoutData: {
                        name: parsed.name,
                        duration_minutes: parsed.duration_minutes,
                        calories_burned: parsed.calories_burned,
                        summary: parsed.summary
                    }
                };
            } else {
                return {
                    isWorkout: false,
                    textResponse: parsed.textResponse || 'לא הבנתי את התשובה.'
                };
            }
        } catch (jsonError) {
            return {
                isWorkout: false,
                textResponse: rawJsonStr
            };
        }

    } catch (e: any) {
        console.log('Gemini AI Workout Error:', e.message || e);
        return {
            isWorkout: false,
            textResponse: 'שגיאת התחברות למנוע ה-AI. אנא נסה שוב.'
        };
    }
};

const RECIPE_ANALYSIS_PROMPT = `
You are an Elite AI Clinical Nutritionist. Your task is to analyze an Israeli recipe, its structured ingredients, and instructions, and provide a highly accurate nutritional breakdown.

Input Context:
- Recipe Name: (e.g. "Chicken Salad")
- Ingredients List: A structured list of items containing quantities and names (e.g. Quantity: 200g, Item: Chicken breast)
- Instructions: (e.g. "Grill the chicken...")

Task Requirements:
1. Calculate the TOTAL nutritional values for the entire recipe (Calories, Protein, Fat, Carbs, Fiber, Sodium, Sugar).
2. Assign a Health Score from 1 to 10 based on nutritional density, macronutrient balance, and absence of excessive sugars/bad fats.
3. Provide a per-ingredient breakdown, detailing exactly what each ingredient contributes to the total macros.

Output Requirement:
Return ONLY a strictly formatted JSON object. Do not wrap in markdown blocks like \`\`\`json.
{
  "totals": {
    "calories": 400,
    "protein": 45,
    "fat": 20,
    "carbs": 10,
    "fiber": 3,
    "sodium": 300,
    "sugar": 4
  },
  "healthScore": 8,
  "ingredientBreakdown": [
    {
      "name": "200g chicken breast",
      "calories": 330,
      "protein": 44,
      "fat": 7,
      "carbs": 0
    },
    {
      "name": "1 tbsp olive oil",
      "calories": 119,
      "protein": 0,
      "fat": 13.5,
      "carbs": 0
    }
  ]
}
`;

export type RecipeAnalysisResult = {
    totals: {
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
        fiber: number;
        sodium: number;
        sugar: number;
    };
    healthScore: number;
    ingredientBreakdown: {
        name: string;
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
    }[];
};

export const analyzeRecipe = async (name: string, ingredients: { quantity: string; name: string }[], instructions: string | null): Promise<RecipeAnalysisResult | null> => {
    if (!apiKey) return null;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: RECIPE_ANALYSIS_PROMPT });

        const history: any[] = [];
        const chat = model.startChat({
            history,
            generationConfig: { temperature: 0.1 },
        });

        const formattedIngredients = ingredients.map(i => `- Quantity: ${i.quantity}, Item: ${i.name}`).join('\n');

        const promptMsg = `
Recipe Name: ${name}
Ingredients:
${formattedIngredients}

Instructions: ${instructions || 'ללא הוראות מיוחדות'}
`;

        const result = await chat.sendMessage(promptMsg);
        let rawJsonStr = result.response.text().trim();

        if (rawJsonStr.startsWith('```json')) {
            rawJsonStr = rawJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (rawJsonStr.startsWith('```')) {
            rawJsonStr = rawJsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const parsed = JSON.parse(rawJsonStr);
        return {
            totals: parsed.totals,
            healthScore: parsed.healthScore,
            ingredientBreakdown: parsed.ingredientBreakdown
        };
    } catch (e: any) {
        console.log('Failed to analyze recipe:', e.message || e);
        return null;
    }
};

export const generateDailyScoreExplanation = async (
    score: any,
    consumptionStr: string,
    isWorkoutLogged: boolean,
    userGoal?: string,
    loggedFoodsStr?: string
): Promise<string | null> => {
    if (!apiKey) return null;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        const now = new Date();
        const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

        const prompt = `
אתה מנתח נתונים אובייקטיבי. ספר למשתמש מה המצב שלו היום מבחינת תזונה ואימונים, בצורה פשוטה, יומיומית וממוקדת, רק לפי הנתונים שיש למטה.

חוקי עיצוב וטון - חובה לציית לכולם:
1. אל תשתמש בפסקאות. כתוב רשימה של שורות.
2. איסור על שימוש בנקודות תבליט (כמו "-" או "*"). כל שורה חייבת להתחיל **ישירות** באימוג'י שקשור לתוכן (למשל: 🍗 לחלבון/בשר, 🥗 לירקות/סלט, 😴 לבוקר/חוסר אכילה, ⚠️ לחריגה, ✅ לעמידה ביעד, 🏃 לאימון). התאם את האימוג'י ספציפית למזון או למצב.
3. השפה חייבת להיות עברית פשוטה של יום יום, ישירה וברורה. אל תשתמש במונחים רפואיים, מדעיים או מורכבים. במקום "המכסה המומלצת לשלב זה של היום", תגיד "ביחס לשעה עכשיו".
4. אל תיתן עצות לעתיד, תוכניות מחשבה או מילות עידוד. אל תגיד "המשך כך", "נסה לאכול", "יש עבודה". רק עובדות על מה שהיה היום.
5. כל שורה חייבת לשלב נתון מקרו (מספר) ותיאור סטטוס פשוט.
6. השתמש ב-3 עד 4 שורות לכל היותר. התייחס גם לאיכות המזונות (גיוון) אם רלוונטי.

השעה כעת: ${timeStr}
המטרה של המשתמש: ${userGoal || 'לא הוגדרה'}
ציון יומי מחושב: ${score.totalScore} מתוך 10 (80% על המספרים, 20% על איכות האוכל)
נתוני הצריכה המספריים: ${consumptionStr}
מה המשתמש אכל היום: ${loggedFoodsStr || 'עדיין לא הוזן אוכל'}
האם נרשם אימון: ${isWorkoutLogged ? 'כן, אימון בוצע' : 'לא בוצע אימון'}.

דוגמאות לתוצאה בסגנון הנכון (ואלו רק דוגמאות):
🍗 אכלת 120 גרם חלבון מתוך 150 (היעד שלך), שזה מצוין לשעה הזו.
🥗 הוספת סלט וביצה לתפריט, מה שעוזר לגיוון ולציון הבריאות הכולל שלך.
⚠️ חרגת ב-20 גרם שומן ממה שמומלץ כרגע.
🏃 עשית אימון היום, שנותן לך בונוס יפה לציון הכולל.

הכן עכשיו את הניתוח המדויק שלך, לפי הכללים בלבד.
`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e: any) {
        if (e.message?.includes('429')) {
            console.log('Gemini Rate Limit (429) hit for daily score.');
        } else {
            console.log('Failed to generate daily score explanation:', e.message || e);
        }
        return null; // Return null so callers know not to cache this as a valid explanation
    }
};

export const generateDailyRecommendations = async (
    meals: Meal[],
    workouts: Workout[],
    targets: any,
    userGoal?: string
): Promise<{ short: string[], full: string } | null> => {
    if (!apiKey) return null;

    console.log('Current Key used:', apiKey.substring(0, 5));

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const now = new Date();
        const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

        const consumedCals = meals.reduce((sum, m) => sum + m.calories, 0);
        const consumedPro = meals.reduce((sum, m) => sum + m.protein, 0);
        const consumedCarb = meals.reduce((sum, m) => sum + m.carbs, 0);
        const consumedFat = meals.reduce((sum, m) => sum + m.fat, 0);

        const prompt = `
אתה מאמן ותזונאי אישי המנתח את מצבו של המתאמן להיום ונותן המלצות להמשך היום בלבד.
השעה כעת: ${timeStr}
המטרה של המשתמש: ${userGoal || 'לא הוגדרה'}
סך ארוחות שהוזנו היום: ${meals.length}
צריכה עד כה: ${Math.round(consumedCals)} קלוריות, ${Math.round(consumedPro)}g חלבון, ${Math.round(consumedCarb)}g פחמימות, ${Math.round(consumedFat)}g שומן.
יעדים יומיים: ${targets.calories} קלוריות, ${targets.protein}g חלבון.
האם בוצע אימון היום: ${workouts.length > 0 ? 'כן' : 'לא'}.

הנחיות קריטיות:
1. "Zero Data Logic": אם השעה מאוחרת (מעל 14:00) ולא הוזן שום אוכל, הסבר שהציון יהיה נמוך כי הגוף לא קיבל דלק, והמלץ להתחיל לאכול ארוחות מזינות.
2. תן המלצה קונקרטית מבוססת שעה.
3. אם טרם בוצע אימון, הצע אימון או מנוחה לפי המטרות.
4. איסור מוחלט על "מחר נתחיל מחדש". תן רק המלצות פרקטיות למצב העכשווי.

עליך להחזיר אובייקט JSON תקני (ללא markdown מסביב) עם המבנה הבא:
{
  "short": ["טיפ אקשן קצר 1", "טיפ אקשן קצר 2"],
  "full": "טקסט המכיל קטעים ברורים עם כותרות (מסתיימות ב-:) ונקודות (מתחילות ב-•).\nלדוגמה:\nתזונה:\n• אכלת X קלוריות, נותרו Y.\n• הוסף חלבון בארוחה הבאה.\n\nאימון:\n• כן/לא אימנת היום.\n• המלצה לפעילות נוספת."
}
`;

        const result = await model.generateContent(prompt);
        let rawJsonStr = result.response.text().trim();

        if (rawJsonStr.startsWith('\`\`\`json')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
        } else if (rawJsonStr.startsWith('\`\`\`')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
        }

        const parsed = JSON.parse(rawJsonStr);
        return {
            short: parsed.short || [],
            full: parsed.full || ""
        };
    } catch (e: any) {
        console.log('Failed to generate daily recommendations:', e.message || e);
        return null;
    }
};
