import re

file_path = r'c:\Users\Ofir\Desktop\HealthApp\utils\ai.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print('Original Length:', len(content))

# 1. Imports
content = re.sub(
    r"import \{ GoogleGenerativeAI \} from '@google/generative-ai';",
    "import { GoogleGenAI } from '@google/genai';",
    content
)

content = re.sub(
    r"const genAI = new GoogleGenerativeAI\(apiKey\);",
    "const ai = new GoogleGenAI({ apiKey });",
    content
)

# 2. Guards
guards_block = """const RPM_LIMIT = 15;
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
};"""

content = re.sub(
    r"(export type WorkoutPlan = \{[\s\S]*?\};)",
    r"\1\n\n" + guards_block,
    content
)

# 3. function generateNutritionResponse
nutrition_regex = r"(export const generateNutritionResponse[\s\S]*?if \(\!apiKey\) \{[\s\S]*?try \{[\s\S]*?const model = genAI\.getGenerativeModel[\s\S]*?const apiPromise = model\.generateContent[\s\S]*?responseText = result\.response\.text\(\);[\s\S]*?\}\s*catch\s*\(jsonError\)[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\})"
nutrition_replace = """export const generateNutritionResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessageText: string, imageBase64?: string): Promise<AIResponse> => {
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
}"""

content = re.sub(nutrition_regex, nutrition_replace, content)

# --- B. generatePersonalizedPlan ---
plan_regex = r"(export const generatePersonalizedPlan[\s\S]*?if \(\!apiKey\) return null;[\s\S]*?try \{[\s\S]*?const model = genAI[\s\S]*?const result = await chat\.sendMessage\(userDataMsg\);[\s\S]*?return \{[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\})"
plan_replace = """export const generatePersonalizedPlan = async (user: UserData): Promise<{ targets: UserData['daily_targets'], explanation: string } | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const userDataMsg = f"גיל: {user.age}\\nמין: {user.gender}\\nגובה: {user.height} ס\"מ\\nמשקל: {user.weight} ק\\\"ג\\nמטרה: {user.goal}\\nרמת פעילות: {user.activity_level}\\nאימונים בשבוע: {user.workout_frequency}\\nמבנה גוף: {user.body_type}"
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: userDataMsg,
            config: { systemInstruction: NUTRITIONIST_SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 2048 } }
        });
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return { targets: parsed.targets, explanation: parsed.explanation };
    } catch (e) { return null; }
}"""
content = re.sub(plan_regex, plan_replace, content)

# --- C. estimateTemplateWorkout ---
workout_regex = r"(export const estimateTemplateWorkout[\s\S]*?if \(\!apiKey\) return null;[\s\S]*?try \{[\s\S]*?const model = genAI\.getGenerativeModel[\s\S]*?result = await chat\.sendMessage[\s\S]*?return \{[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\})"
workout_replace = """export const estimateTemplateWorkout = async (user: UserData, templateName: string, templateDescription: string | null, userNotes: string | null, durationMinutes: number) => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const promptMsg = f"Workout: {templateName}, Duration: {durationMinutes} mins"
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: promptMsg,
            config: { systemInstruction: TEMPLATE_WORKOUT_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return { calories_burned: parsed.calories_burned, summary: parsed.summary };
    } catch (e) { return null; }
}"""
content = re.sub(workout_regex, workout_replace, content)

# --- D. generateWorkoutResponse ---
response_regex = r"(export const generateWorkoutResponse[\s\S]*?if \(\!apiKey\)[\s\S]*?try \{[\s\S]*?const model = genAI[\s\S]*?result = await chat\.sendMessage[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\})"
response_replace = """export const generateWorkoutResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessageText: string, userWeightKg: number): Promise<WorkoutPlan> => {
    if (!apiKey) return { isWorkout: false, textResponse: 'מפתח API חסר.' };
    if (!checkAndIncrementRateLimits()) return { isWorkout: false, textResponse: 'הגעת למגבלת קצב.' };

    try {
        const chat = ai.chats.create({
            model: 'gemini-3.1-flash-lite-preview',
            history: history,
            config: { systemInstruction: WORKOUT_SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        const result = await chat.sendMessage({ message: newMessageText });
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        if (parsed.isWorkout) return { isWorkout: true, workoutData: parsed.workoutData };
        return { isWorkout: false, textResponse: parsed.textResponse };
    } catch (e) { return { isWorkout: false, textResponse: 'שגיאה.' }; }
}"""
content = re.sub(response_regex, response_replace, content)

# --- E. analyzeRecipe ---
recipe_regex = r"(export const analyzeRecipe[\s\S]*?if \(\!apiKey\) return null;[\s\S]*?const model = genAI[\s\S]*?let rawJsonStr = result\.response\.text\(\);[\s\S]*?ingredientBreakdown: parsed\.ingredientBreakdown[\s\S]*?\}\s*catch[\s\S]*?\}\s*\})"
recipe_replace = """export const analyzeRecipe = async (name: string, ingredients: { amount: string; unit: string; name: string }[], instructions: string | null): Promise<RecipeAnalysisResult | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const promptMsg = f"Recipe: {name}"
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: promptMsg,
            config: { systemInstruction: RECIPE_ANALYSIS_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return { totals: parsed.totals, healthScore: parsed.healthScore, ingredientBreakdown: parsed.ingredientBreakdown };
    } catch (e) { return null; }
};

export const generateRecipeImage = async (name: string): Promise<string | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    return f"https://image.pollinations.ai/prompt/{name}"
}"""
content = re.sub(recipe_regex, recipe_replace, content)

with open(r'c:\Users\Ofir\Desktop\HealthApp\utils\ai_fixed.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Full Python Patch script executed.')
