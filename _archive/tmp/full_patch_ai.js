const fs = require('fs');

const filePath = 'c:\\Users\\Ofir\\Desktop\\HealthApp\\utils\\ai.ts';
let template = fs.readFileSync(filePath, 'utf8');

console.log('Original Length:', template.length);

// 1. Imports
template = template.replace(
    /import \{ GoogleGenerativeAI \} from '@google\/generative-ai';/,
    `import { GoogleGenAI } from '@google/genai';`
);
template = template.replace(
    /const genAI = new GoogleGenerativeAI\(apiKey\);/,
    `const ai = new GoogleGenAI({ apiKey });`
);

// 2. Guards
const guardBlock = `const RPM_LIMIT = 15;
const DAILY_LIMIT = 500;
let rpmTimestamps: number[] = [];

import { useUserStore } from '@/store/useUserStore';
import { Alert } from 'react-native';

export const checkAndIncrementRateLimits = (): boolean => {
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

    if (currentCount >= 450 && currentCount < DAILY_LIMIT) Alert.alert('Warning', 'You are reaching the daily requests limit.');
    if (currentCount >= DAILY_LIMIT) {
        Alert.alert('Limit reached', \`Limit reached: \${currentCount}/\${DAILY_LIMIT} (Daily). Please wait a moment or try again tomorrow.\`);
        return false;
    }
    rpmTimestamps.push(now);
    state.incrementDailyAiCount();
    return true;
};`;

template = template.replace(
    /export type WorkoutPlan = \{[\s\S]*?\}\;/,
    match => `${match}\n\n${guardBlock}`
);

// 3. Functions updates (Continuous Exact Body Blocks)

// --- A. generateNutritionResponse ---
template = template.replace(
    /export const generateNutritionResponse[\s\S]*?if \(\!apiKey\) \{[\s\S]*?try \{[\s\S]*?const model = genAI\.getGenerativeModel[\s\S]*?const apiPromise = model\.generateContent[\s\S]*?responseText = result\.response\.text\(\);[\s\S]*?\}\s*catch\s*\(jsonError\)[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    `export const generateNutritionResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessageText: string, imageBase64?: string): Promise<AIResponse> => {
    if (!apiKey) return { isMeal: false, textResponse: 'מפתח API חסר.' };
    if (!checkAndIncrementRateLimits()) return { isMeal: false, textResponse: 'הגעת למגבלת קצב.' };

    try {
        let parts: any[] = [{ text: newMessageText }];
        if (imageBase64) { parts.push({ inlineData: { data: imageBase64.split(',')[1] || imageBase64, mimeType: 'image/jpeg' } }); }
        
        const apiPromise = ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [{ role: 'user', parts: parts }],
            config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });

        const result = await Promise.race([apiPromise, new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000))]);
        const responseText = result.text || '';
        let rawJsonStr = responseText.trim();
        if (rawJsonStr.startsWith('```json')) rawJsonStr = rawJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (rawJsonStr.startsWith('```')) rawJsonStr = rawJsonStr.replace(/^```/, '').replace(/```$/, '').trim();

        try {
            const parsed = JSON.parse(rawJsonStr);
            if (parsed.isMeal) {
                return { isMeal: true, mealData: { name: parsed.name, calories: parsed.calories, protein: parsed.protein, fat: parsed.fat, carbs: parsed.carbs, fiber: parsed.fiber || 0, sodium: parsed.sodium || 0, sugar: parsed.sugar || 0, summary: parsed.summary } };
            } else { return { isMeal: false, textResponse: parsed.textResponse || 'לא הבנתי.' }; }
        } catch (j) { return { isMeal: false, textResponse: responseText }; }
    } catch (e) { return { isMeal: false, textResponse: 'שגיאה ב-AI.' }; }
}`
);

// --- B. generatePersonalizedPlan ---
template = template.replace(
    /export const generatePersonalizedPlan[\s\S]*?if \(\!apiKey\) return null;[\s\S]*?try \{[\s\S]*?const model = genAI\.getGenerativeModel[\s\S]*?const result = await chat\.sendMessage\(userDataMsg\);[\s\S]*?return \{[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    `export const generatePersonalizedPlan = async (user: UserData): Promise<{ targets: UserData['daily_targets'], explanation: string } | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const userDataMsg = \`גיל: \${user.age}\\nמין: \${user.gender}\\nגובה: \${user.height} ס"מ\\nמשקל: \${user.weight} ק"ג\\nמטרה: \${user.goal}\\nרמת פעילות: \${user.activity_level}\\nאימונים בשבוע: \${user.workout_frequency}\\nמבנה גוף: \${user.body_type}\`;
        
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: userDataMsg,
            config: { systemInstruction: NUTRITIONIST_SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 2048 } }
        });
        const parsed = JSON.parse((result.text || '{}').replace(/\`\`\`json|\\\`\\\`\\\`/g, ''));
        return { targets: parsed.targets, explanation: parsed.explanation };
    } catch (e) { return null; }
}`
);

// --- C. estimateTemplateWorkout ---
template = template.replace(
    /export const estimateTemplateWorkout[\s\S]*?if \(\!apiKey\) return null;[\s\S]*?try \{[\s\S]*?const model = genAI\.getGenerativeModel[\s\S]*?result = await chat\.sendMessage[\s\S]*?return \{[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    `export const estimateTemplateWorkout = async (user: UserData, templateName: string, templateDescription: string | null, userNotes: string | null, durationMinutes: number) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const promptMsg = \`Workout: \${templateName}, Duration: \${durationMinutes} mins\`;
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: promptMsg,
            config: { systemInstruction: TEMPLATE_WORKOUT_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        const parsed = JSON.parse((result.text || '{}').replace(/\`\`\`json|\\\`\\\`\\\`/g, ''));
        return { calories_burned: parsed.calories_burned, summary: parsed.summary };
    } catch (e) { return null; }
}`
);

// --- D. generateWorkoutResponse ---
template = template.replace(
    /export const generateWorkoutResponse[\s\S]*?if \(\!apiKey\)[\s\S]*?try \{[\s\S]*?const model = genAI[\s\S]*?result = await chat\.sendMessage[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    `export const generateWorkoutResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessageText: string, userWeightKg: number): Promise<WorkoutPlan> => {
    if (!apiKey) return { isWorkout: false, textResponse: 'מפתח API חסר.' };
    if (!checkAndIncrementRateLimits()) return { isWorkout: false, textResponse: 'הגעת למגבלת קצב.' };

    try {
        const chat = ai.chats.create({
            model: 'gemini-3.1-flash-lite-preview',
            history: history,
            config: { systemInstruction: WORKOUT_SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        const result = await chat.sendMessage({ message: newMessageText });
        const parsed = JSON.parse((result.text || '{}').replace(/\`\`\`json|\\\`\\\`\\\`/g, ''));
        if (parsed.isWorkout) return { isWorkout: true, workoutData: parsed.workoutData };
        return { isWorkout: false, textResponse: parsed.textResponse };
    } catch (e) { return { isWorkout: false, textResponse: 'שגיאה.' }; }
}`
);

// --- E. Recreate generateRecipeImage & update analyzeRecipe ---
const analyzeRecipeMatch = /export const analyzeRecipe[\s\S]*?if \(\!apiKey\) return null;[\s\S]*?const model = genAI[\s\S]*?let rawJsonStr = result\.response\.text\(\);[\s\S]*?ingredientBreakdown: parsed\.ingredientBreakdown[\s\S]*?\}\s*catch[\s\S]*?\}\s*\}/;
template = template.replace(
    analyzeRecipeMatch,
    `export const analyzeRecipe = async (name: string, ingredients: { amount: string; unit: string; name: string }[], instructions: string | null): Promise<RecipeAnalysisResult | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const promptMsg = \`Recipe: \${name}\`;
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: promptMsg,
            config: { systemInstruction: RECIPE_ANALYSIS_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        const parsed = JSON.parse((result.text || '{}').replace(/\`\`\`json|\\\`\\\`\\\`/g, ''));
        return { totals: parsed.totals, healthScore: parsed.healthScore, ingredientBreakdown: parsed.ingredientBreakdown };
    } catch (e) { return null; }
};

export const generateRecipeImage = async (name: string): Promise<string | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    return \`https://image.pollinations.ai/prompt/\${encodeURIComponent(name)}\`;
}`
);

// --- F. generateDailyScoreExplanation ---
template = template.replace(
    /export const generateDailyScoreExplanation[\s\S]*?const model = genAI[\s\S]*?result = await model\.generateContent[\s\S]*?return null;[\s\S]*?\}\s*\}/,
    `export const generateDailyScoreExplanation = async (score: any, consumptionStr: string, isWorkoutLogged: boolean, userGoal?: string, loggedFoodsStr?: string): Promise<string | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: consumptionStr,
            config: { thinkingConfig: { thinkingBudget: 1024 } }
        });
        return result.text || '';
    } catch (e) { return null; }
}`
);

// --- G. generateDailyRecommendations ---
template = template.replace(
    /export const generateDailyRecommendations[\s\S]*?const model = genAI[\s\S]*?result = await model\.generateContent[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    `export const generateDailyRecommendations = async (meals: Meal[], workouts: Workout[], targets: any, userGoal?: string) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: 'recommendations',
            config: { thinkingConfig: { thinkingBudget: 2048 } }
        });
        return JSON.parse((result.text || '{}').replace(/\`\`\`json|\\\`\\\`\\\`/g, ''));
    } catch (e) { return null; }
}`
);

fs.writeFileSync('c:\\Users\\Ofir\\Desktop\\HealthApp\\utils\\ai_fixed.ts', template);
console.log('✅ Full Safety Patch script executed.');
