const fs = require('fs');

const fullFileContent = `import { Meal, Workout } from '@/db/database';
import { UserData } from '@/store/useUserStore';
import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini AI client
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
let rpmTimestamps = [];

import { useUserStore } from '@/store/useUserStore';
import { Alert } from 'react-native';

export const checkAndIncrementRateLimits = () => {
    const now = Date.now();
    rpmTimestamps = rpmTimestamps.filter(t => now - t < 60 * 1000);
    if (rpmTimestamps.length >= RPM_LIMIT) {
        Alert.alert('Limit reached', \`Limit reached: \${rpmTimestamps.length}/\${RPM_LIMIT} (Minute). Please wait a moment or try again tomorrow.\`);
        return false;
    }

    const state = useUserStore.getState();
    const today = new Date().toISOString().split('T')[0];
    const daily = state.user?.aiDailyCount || { count: 0, dateStr: today };
    const currentCount = daily.dateStr === today ? daily.count : 0;

    if (currentCount >= 450 && currentCount < DAILY_LIMIT) {
        Alert.alert('Warning', 'You are reaching the daily requests limit (450+ Requests processed today).');
    }

    if (currentCount >= DAILY_LIMIT) {
        Alert.alert('Limit reached', \`Limit reached: \${currentCount}/\${DAILY_LIMIT} (Daily). Please wait a moment or try again tomorrow.\`);
        return false;
    }

    rpmTimestamps.push(now);
    state.incrementDailyAiCount();
    return true;
};

const SYSTEM_PROMPT = \`
You are the HealthApp Nutrition Expert, powered by Google Gemini. Your goal is to be a precise, conversational, and highly intelligent nutrition partner for an Israeli user speaking Hebrew.

YOUR COGNITIVE PROCESS:
1. Deconstruct the user's input. Identify the core items, quantities, and preparation methods.
2. Maintain Context: The user might be correcting a previous meal ("Actually, add an egg") or providing a new meal.
3. Use your deep knowledge of nutritional values (USDA + Israeli market equivalents) to estimate macros.

OUTPUT RULES:
- If the user is just chatting or providing feedback that does NOT require logging a specific food, respond with standard text in Hebrew.
- **CRITICAL**: If the user's intent is to log a meal, you MUST output ONLY a pure JSON object representing the meal. DO NOT wrap the JSON in markdown blocks like \\\`\\\`\\\`json. The JSON MUST follow this exact schema:
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
\`;

export const generateNutritionResponse = async (history, newMessageText, imageBase64) => {
    if (!apiKey) {
        return { isMeal: false, textResponse: 'שגיאת מערכת: מפתח API של Gemini חסר.' };
    }

    if (!checkAndIncrementRateLimits()) {
        return { isMeal: false, textResponse: 'הגעת למגבלת קצב. המתן מעט.' };
    }

    try {
        let parts = [{ text: newMessageText }];
        if (imageBase64) {
            parts.push({
                inlineData: {
                    data: imageBase64.split(',')[1] || imageBase64,
                    mimeType: 'image/jpeg'
                }
            });
        }

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), 10000);
        });

        const apiPromise = ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [{ role: 'user', parts: parts }],
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });

        const result = await Promise.race([apiPromise, timeoutPromise]);
        const responseText = result.text || '';

        let rawJsonStr = responseText.trim();
        if (rawJsonStr.startsWith('\`\`\`json')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
        } else if (rawJsonStr.startsWith('\`\`\`')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
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
                return { isMeal: false, textResponse: parsed.textResponse || 'לא הבנתי את התשובה.' };
            }
        } catch (jsonError) {
            return { isMeal: false, textResponse: responseText };
        }
    } catch (e) {
        console.log('Gemini API Error:', e.message || e);
        return { isMeal: false, textResponse: 'שגיאת התחברות למנוע ה-AI.' };
    }
};

const NUTRITIONIST_SYSTEM_PROMPT = \`
You are the HealthApp Clinical Nutritionist and an elite sports nutritionist.
Calculate targets accurately and Return ONLY a raw JSON.
{
  "targets": { "calories": 2000, "protein": 150, "fat": 70, "carbs": 190, "fiber": 30, "sodium": 2300, "sugar": 45 },
  "explanation": "..."
}
\`;

export const generatePersonalizedPlan = async (user) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const userDataMsg = \`גיל: \${user.age}\\nמין: \${user.gender}\\nגובה: \${user.height} ס"מ\\nמשקל: \${user.weight} ק"ג\\nמטרה: \${user.goal}\\nרמת פעילות: \${user.activity_level}\\nאימונים בשבוע: \${user.workout_frequency}\\nמבנה גוף: \${user.body_type}\`;

        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: userDataMsg,
            config: { systemInstruction: NUTRITIONIST_SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 2048 } }
        });
        let rawJsonStr = (result.text || '').trim();

        if (rawJsonStr.startsWith('\`\`\`json')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
        } else if (rawJsonStr.startsWith('\`\`\`')) {
            rawJsonStr = rawJsonStr.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
        }

        const parsed = JSON.parse(rawJsonStr);
        return { targets: parsed.targets, explanation: parsed.explanation };
    } catch (e) {
        return null;
    }
};

const TEMPLATE_WORKOUT_PROMPT = \`You are the Elite AI Coach. Return ONLY JSON.\`;

export const estimateTemplateWorkout = async (user, templateName, templateDescription, userNotes, durationMinutes) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const promptMsg = \`Workout: \${templateName}, Duration: \${durationMinutes} mins\`;
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: promptMsg,
            config: { systemInstruction: TEMPLATE_WORKOUT_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        const parsed = JSON.parse(result.text || '{}');
        return { calories_burned: parsed.calories_burned, summary: parsed.summary };
    } catch (e) { return null; }
};

const WORKOUT_SYSTEM_PROMPT = \`You are the Elite AI Coach.\`;

export const generateWorkoutResponse = async (history, newMessageText, userWeightKg) => {
    if (!apiKey) return { isWorkout: false, textResponse: 'מפתח API חסר' };
    if (!checkAndIncrementRateLimits()) return { isWorkout: false, textResponse: 'הגעת למגנלית קצב' };

    try {
        const chat = ai.chats.create({
            model: 'gemini-3.1-flash-lite-preview',
            history: history,
            config: { systemInstruction: WORKOUT_SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });

        const result = await chat.sendMessage({ message: newMessageText });
        const parsed = JSON.parse(result.text || '{}');
        return { isWorkout: parsed.isWorkout, workoutData: parsed.workoutData, textResponse: parsed.textResponse };
    } catch (e) { return { isWorkout: false, textResponse: 'שגיאה' }; }
};

const RECIPE_ANALYSIS_PROMPT = \`Analyze Israeli recipe, return JSON.\`;

export const analyzeRecipe = async (name, ingredients, instructions) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: \`Recipe: \${name}\`,
            config: { systemInstruction: RECIPE_ANALYSIS_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        return JSON.parse(result.text || '{}');
    } catch (e) { return null; }
};

export const generateRecipeImage = async (name) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    return \`https://image.pollinations.ai/prompt/\${encodeURIComponent(name)}\`;
};

export const generateDailyScoreExplanation = async (score, consumptionStr, isWorkoutLogged, userGoal, loggedFoodsStr) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: 'Analyze score',
            config: { thinkingConfig: { thinkingBudget: 1024 } }
        });
        return result.text;
    } catch (e) { return null; }
};

export const generateDailyRecommendations = async (meals, workouts, targets, userGoal) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: 'Analyze recommendations',
            config: { thinkingConfig: { thinkingBudget: 1024 } }
        });
        return JSON.parse(result.text || '{}');
    } catch (e) { return null; }
};
\`;

fs.writeFileSync('c:\\\\Users\\\\Ofir\\\\Desktop\\\\HealthApp\\\\utils\\\\ai_fixed.ts', fullFileContent);
console.log('✅ File build successfully written to ai_fixed.ts');
