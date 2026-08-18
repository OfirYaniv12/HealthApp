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
    limitReached?: boolean;
    usedModel?: string;
};

export type WorkoutPlan = {
    isWorkout: boolean;
    textResponse?: string;
    workoutData?: {
        name: string;
        duration_minutes: number;
        calories_burned: number;
        summary: string;
    };
    limitReached?: boolean;
    usedModel?: string;

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

const withTimeout = async <T>(promise: Promise<T>, ms: number = 15000): Promise<T> => {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms));
    return Promise.race([promise, timeout]);
};

const FALLBACK_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash'
];

export const generateContentWithFallback = async (requestBase: any): Promise<any> => {
    for (const model of FALLBACK_MODELS) {
        try {
            const request = { ...requestBase, model };
            const result = await withTimeout(ai.models.generateContent(request));
            return { result, usedModel: model };
        } catch (e: any) {
            const isLimitErr = e?.status === 429 || String(e?.message).includes('429') || e?.status === 503 || String(e?.message).includes('503') || String(e?.message).includes('TIMEOUT') || String(e?.message).includes('404');
            if (isLimitErr) {
                console.log(`[AI Fallback] Model ${model} unavailable... trying next.`);
                continue;
            }
            throw e;
        }
    }
    return { limitReached: true };
};

export const chatWithFallback = async (history: any, newMessageText: string, config: any): Promise<any> => {
    for (const model of FALLBACK_MODELS) {
        try {
            const chat = ai.chats.create({ model, history, config });
            const result = await withTimeout(chat.sendMessage({ message: newMessageText }));
            return { result, usedModel: model };
        } catch (e: any) {
            const isLimitErr = e?.status === 429 || String(e?.message).includes('429') || e?.status === 503 || String(e?.message).includes('503') || String(e?.message).includes('TIMEOUT') || String(e?.message).includes('404');
            if (isLimitErr) {
                 continue;
            }
            throw e;
        }
    }
    return { limitReached: true };
};

const SYSTEM_PROMPT = `
You are the HealthApp Nutrition Expert, powered by Google Gemini. Your goal is to be a precise, conversational, and highly intelligent nutrition partner for an Israeli user speaking Hebrew.

YOUR COGNITIVE PROCESS:
1. Deconstruct the user's input. Identify the core items, quantities, and preparation methods.
2. If the user provides an image alongside text, you MUST explicitly state what you identify in the image and explain how the user's text description adds to or modifies that identification.
3. Maintain Context: The user might be correcting a previous meal ("Actually, add an egg") or providing a new meal.
4. Use your deep knowledge of nutritional values (USDA + Israeli market equivalents) to estimate macros.

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
    if (!apiKey) return { isMeal: false, textResponse: 'מפתח API חסר.' };
    if (!checkAndIncrementRateLimits()) return { isMeal: false, textResponse: 'הגעת למגבלת קצב. המתן מעט.' };

    try {
        let parts: any[] = [{ text: newMessageText }];
        if (imageBase64) {
            parts.push({
                inlineData: {
                    data: imageBase64.split(',')[1] || imageBase64,
                    mimeType: 'image/jpeg'
                }
            });
        }

        const contents = [...history, { role: 'user', parts: parts }];

        const fallbackData = await generateContentWithFallback({
            contents: contents,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        if (fallbackData.limitReached) return { isMeal: false, limitReached: true, textResponse: 'הגיע למגבלת השימוש.' };
        const result = fallbackData.result;
        const usedModel = fallbackData.usedModel;
        const responseText = result.text || '';

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
                    },
                    usedModel: usedModel
                };
            } else {
                return { isMeal: false, textResponse: parsed.textResponse || 'לא הבנתי את התשובה.', usedModel: usedModel };
            }
        } catch (jsonError) {
            return { isMeal: false, textResponse: responseText };
        }
    } catch (e: any) {
        return { isMeal: false, textResponse: 'שגיאת AI.' };
    }
};
;

const NUTRITIONIST_SYSTEM_PROMPT = `
You are the HealthApp Clinical Nutritionist and an elite sports nutritionist, an elite AI specialized in Israeli health, physiology, and precise macro calculations.
Your goal is to generate a comprehensive, highly personalized daily nutritional target profile.

Input User Data:
The user will provide their Age, Gender, Height, Weight, Activity Level, Workout Frequency, Body Type, and Primary Goal.

You are the HealthApp Precision Health Coach, an elite AI specialized in Israeli health, physiology, and scientific macro calculations. Your goal is to balance scientific accuracy with a friendly, supportive UI.

Task Requirements:
1. Calculate Total Daily Energy Expenditure (TDEE) precisely using standard formulas (e.g. Mifflin-St Jeor) based on weight/height/age/gender.
2. Calculate an appropriate Calorie Surplus or Deficit depending on their specific Goal (Weight Loss vs Muscle Gain).
3. Compute macronutrients dynamically and scientifically based on user profile and goals (e.g. Protein based on activity, carbs/fats balanced).
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
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const userDataMsg = `גיל: ${user.age}\nמין: ${user.gender}\nגובה: ${user.height} ס"מ\nמשקל: ${user.weight} ק"ג\nמטרה: ${user.goal}\nרמת פעילות: ${user.activity_level}\nאימונים בשבוע: ${user.workout_frequency}\nמבנה גוף: ${user.body_type}`;
        const fallbackData = await generateContentWithFallback({
            contents: userDataMsg,
            config: { systemInstruction: NUTRITIONIST_SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 2048 } }
        });
        if (fallbackData.limitReached) return null;
        const result = fallbackData.result;
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return { targets: parsed.targets, explanation: parsed.explanation };
    } catch (e: any) { return null; }
};
;

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

export const estimateTemplateWorkout = async (user: UserData, templateName: string, templateDescription: string | null, userNotes: string | null, durationMinutes: number) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const promptMsg = `Workout: ${templateName}, Duration: ${durationMinutes} mins`;
        const fallbackData = await generateContentWithFallback({
            contents: promptMsg,
            config: { systemInstruction: TEMPLATE_WORKOUT_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        if (fallbackData.limitReached) return null;
        const result = fallbackData.result;
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return { calories_burned: parsed.calories_burned, summary: parsed.summary };
    } catch (e: any) { return null; }
};
;

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

export const generateWorkoutResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessageText: string, userWeightKg: number): Promise<WorkoutPlan> => {
    if (!apiKey) return { isWorkout: false, textResponse: 'מפתח API חסר.' };
    if (!checkAndIncrementRateLimits()) return { isWorkout: false, textResponse: 'הגעת למגבלת קצב. המתן מעט.' };

    try {
        const fallbackData = await chatWithFallback(history, newMessageText, { 
            systemInstruction: WORKOUT_SYSTEM_PROMPT, 
            temperature: 0.1, 
            thinkingConfig: { thinkingBudget: 1024 } 
        });
        if (fallbackData.limitReached) return { isWorkout: false, limitReached: true, textResponse: 'הגיע למגבלת השימוש.' };
        const result = fallbackData.result;
        const usedModel = fallbackData.usedModel;
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        if (parsed.isWorkout) {
            // Support both flat root properties (as prompted) and nested workoutData (common AI hallucination)
            const dataTarget = parsed.workoutData || parsed;
            
            return {
                isWorkout: true,
                workoutData: {
                    name: dataTarget.name || 'אימון כללי',
                    duration_minutes: dataTarget.duration_minutes || 0,
                    calories_burned: dataTarget.calories_burned || 0,
                    summary: dataTarget.summary || 'אימון נרשם בהצלחה.'
                },
                usedModel: usedModel
            };
        }
        return { isWorkout: false, textResponse: parsed.textResponse, usedModel: usedModel };
    } catch (e: any) { return { isWorkout: false, textResponse: 'שגיאת AI.' }; }
};
;

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
        const formattedIngredients = ingredients.map(i => `- Quantity: ${i.quantity}, Item: ${i.name}`).join('\n');

        const promptMsg = `
Recipe Name: ${name}
Ingredients:
${formattedIngredients}

Instructions: ${instructions || 'ללא הוראות מיוחדות'}
`;

        const fallbackData = await generateContentWithFallback({
            contents: promptMsg,
            config: { 
                systemInstruction: RECIPE_ANALYSIS_PROMPT, 
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        if (fallbackData.limitReached) return null;
        const result = fallbackData.result;

        let rawJsonStr = (result.text || '').trim();

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

const SCORE_EXPLANATION_PROMPT = `
You are a friendly, knowledgeable health coach. Explain the user's daily health score based on their consumption data, logged items, and the CURRENT TIME OF DAY in 100% HEBREW.

STRICT FORMAT RULES (CRITICAL):
- ABSOLUTELY 100% HEBREW ONLY. DO NOT USE ANY ENGLISH WORDS OR SYMBOLS (no 'protein', no variables).
- DO NOT RETURN JSON. Provide the explanation as a clean, multi-line Hebrew text.
- STRUCTURE AS A LIST: Provide the explanation text as a list of clear, summarized bullet lines separated by the newline character.
- NO MARKDOWN SYMBOLS: Do NOT use any asterisks (*), hashtags (#), or bold tags. Clean text only.
- CONCISE TONE: Use 2-4 summarized bullet lines using warm emojis (e.g. 👏, 🌾, ⚠️). 

CONTENT & PERSONALIZATION RULES:
1. ANALYZE SPECIFIC MEALS: Do not just list general macro statues. Look at the "Logged Foods" list provided in context.
2. PRAISE/WARN: Praise fully specific meals with excellent nutrient profiles (e.g., loaded with fiber/protein). Call out specific meals that impacted the score significantly positively or negatively.
3. LOG VARIETY: Mention or comment on the variety of foods eaten today if notable.
4. TIME SENSITIVITY: Evaluate totals based on the Current Time provided. (e.g., eating 80% targets by 9:00 AM vs 9:00 PM).

Example Output:
- 👏 ארוחת הבוקר (יוגורט שיבולת שועל) הייתה בחירה מדהימה, שעזרה לך להישאר שבע!
- 🌾 צריכת הסיבים שלך מצוינת היום בזכות הירקות שרשמת
- ⚠️ שים לב לתוספת הסוכר בקפה
`;

const RECOMMENDATIONS_PROMPT = `
You are the HealthApp Advisor. Based on the user's daily consumption, workouts, and goals, generate actionable recommendations.

Output Requirement:
Return ONLY a strictly formatted JSON object. Do not wrap in markdown blocks like \`\`\`json.
{
  "short": ["טיפ 1 קצר", "טיפ 2 קצר"],
  "full": "הסבר מפורט ומובנה היטב בעברית. השתמש בכותרות מודגשות חמודות עם אימוג'ים (לדוגמה: 🍳 תזונה, 🏃 פעילות). הסבר בצורה ברורה מאוד כיצד על המשתמש להמשיך את היום כדי להגיע למטרותיו."
}
`;

export const generateDailyScoreExplanation = async (score: any, consumptionStr: string, isWorkoutLogged: boolean, userGoal?: string, loggedFoodsStr?: string): Promise<string | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    try {
        const now = new Date();
        const currentTimeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        
        const fullPrompt = `
Current Time: ${currentTimeStr}
Score: ${JSON.stringify(score)}
Goal: ${userGoal || 'Not set'}
Consumption: ${consumptionStr}
Workout Logged Today: ${isWorkoutLogged ? 'Yes' : 'No'}
Logged Foods: ${loggedFoodsStr || 'None'}
`;

        const fallbackData = await generateContentWithFallback({
            contents: fullPrompt,
            config: { 
                systemInstruction: SCORE_EXPLANATION_PROMPT,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 1024 } 
            }
        });
        if (fallbackData.limitReached) return null;
        const result = fallbackData.result;
        
        const raw = (result.text || '{}').replace(/```json|```/g, '').trim();
        return raw; // Returns expected JSON string
    } catch (e: any) { return null; }
};;

export const generateDailyRecommendations = async (meals: Meal[], workouts: Workout[], targets: any, userGoal?: string): Promise<{ short: string[], full: string } | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    try {
        const promptMsg = `
Meals Logged: ${JSON.stringify(meals)}
Workouts Logged: ${JSON.stringify(workouts)}
Targets: ${JSON.stringify(targets)}
User Goal: ${userGoal || 'לא צוין'}
`;

        const fallbackData = await generateContentWithFallback({
            contents: promptMsg,
            config: { 
                systemInstruction: RECOMMENDATIONS_PROMPT,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 2048 } 
            }
        });
        if (fallbackData.limitReached) return null;
        const result = fallbackData.result;
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return { short: parsed.short || [], full: parsed.full || "" };
    } catch (e: any) { return null; }
};

export const generateWorkoutSummary = async (exercises: any[]): Promise<string> => {
    if (!apiKey || exercises.length === 0) return '';
    if (!checkAndIncrementRateLimits()) return '';

    try {
        const prompt = `צור פסקה אחת קצרה בעברית (עד 3 משפטים, ללא כותרות וללא סימוני Markdown בכלל) המסכמת את פירוט האימון הבא:\n\n${JSON.stringify(exercises, null, 2)}`;
        const fallbackData = await generateContentWithFallback({
            contents: prompt,
            config: { temperature: 0.1 }
        });
        if (fallbackData.limitReached) return '';
        const result = fallbackData.result;
        return (result.text || '').replace(/[*_#]/g, '').trim();
    } catch (e) {
        return '';
    }
};

export const estimateWorkoutMET = async (exercises: any[], duration: number, userMetrics: any): Promise<number> => {
    if (!apiKey || exercises.length === 0) return 4.0;
    
    try {
        const prompt = `You are a sports science expert. 
Calculate the precise Metabolic Equivalent of Task (MET) for this workout session based on exercise selection and volume.
Duration: ${duration} minutes.
User Profile: Weight ${userMetrics.weight || 74}kg, Height ${userMetrics.height || 175}cm, Age ${userMetrics.age || 30}, Gender ${userMetrics.gender || 'unknown'} (Use this context to adjust intensity baseline).

Exercises Log:
${JSON.stringify(exercises, null, 2)}

Return ONLY a valid JSON object containing exactly one numeric key "MET" (e.g. 4.5). Value must be between 2.0 and 10.0 depending on intensity. Return NO OTHER TEXT.`;

        const fallbackData = await generateContentWithFallback({
            contents: prompt,
            config: { temperature: 0.1 }
        });
        if (fallbackData.limitReached) return 4.0;
        const result = fallbackData.result;
        
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return typeof parsed.MET === 'number' ? parsed.MET : 4.0;
    } catch (e) {
        return 4.0;
    }
};


;
