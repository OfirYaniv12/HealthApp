const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\Ofir\\Desktop\\HealthApp\\utils\\ai.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Load Replacements
const nutrition_replace = fs.readFileSync('c:\\Users\\Ofir\\Desktop\\HealthApp\\tmp\\nutrition_rep.txt', 'utf8');
const plan_replace = fs.readFileSync('c:\\Users\\Ofir\\Desktop\\HealthApp\\tmp\\plan_rep.txt', 'utf8');
const workout_replace = fs.readFileSync('c:\\Users\\Ofir\\Desktop\\HealthApp\\tmp\\workout_rep.txt', 'utf8');
const response_replace = fs.readFileSync('c:\\Users\\Ofir\\Desktop\\HealthApp\\tmp\\response_rep.txt', 'utf8');
const recipe_replace = fs.readFileSync('c:\\Users\\Ofir\\Desktop\\HealthApp\\tmp\\recipe_rep.txt', 'utf8');
const score_replace = fs.readFileSync('c:\\Users\\Ofir\\Desktop\\HealthApp\\tmp\\score_rep.txt', 'utf8');

console.log('Original Length:', content.length);

// 2. Update Imports
content = content.replace(
    /import \{ GoogleGenerativeAI \} from '@google\/generative-ai';/,
    `import { GoogleGenAI } from '@google/genai';`
);
content = content.replace(
    /const genAI = new GoogleGenerativeAI\(apiKey\);/,
    `const ai = new GoogleGenAI({ apiKey });`
);

// 3. Guards
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

content = content.replace(
    /export type WorkoutPlan = \{[\s\S]*?\}\;/,
    match => `${match}\n\n${guardBlock}`
);

// 4. Functions Updates
// A. generateNutritionResponse
content = content.replace(
    /export const generateNutritionResponse[\s\S]*?if \(\!apiKey\) \{[\s\S]*?try \{[\s\S]*?const model = genAI\.getGenerativeModel[\s\S]*?const apiPromise = model\.generateContent[\s\S]*?responseText = result\.response\.text\(\);[\s\S]*?\}\s*catch\s*\(jsonError\)[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    () => nutrition_replace
);

// B. generatePersonalizedPlan
content = content.replace(
    /export const generatePersonalizedPlan[\s\S]*?if \(\!apiKey\) return null;[\s\S]*?try \{[\s\S]*?const model = genAI\.getGenerativeModel[\s\S]*?const result = await chat\.sendMessage\(userDataMsg\);[\s\S]*?return \{[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    () => plan_replace
);

// C. estimateTemplateWorkout
content = content.replace(
    /export const estimateTemplateWorkout[\s\S]*?if \(\!apiKey\) return null;[\s\S]*?try \{[\s\S]*?const model = genAI\.getGenerativeModel[\s\S]*?result = await chat\.sendMessage[\s\S]*?return \{[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    () => workout_replace
);

// D. generateWorkoutResponse
content = content.replace(
    /export const generateWorkoutResponse[\s\S]*?if \(\!apiKey\)[\s\S]*?try \{[\s\S]*?const model = genAI[\s\S]*?result = await chat\.sendMessage[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    () => response_replace
);

// E. analyzeRecipe (replaces and appends Image)
content = content.replace(
    /export const analyzeRecipe[\s\S]*?if \(\!apiKey\) return null;[\s\S]*?const model = genAI[\s\S]*?let rawJsonStr = result\.response\.text\(\);[\s\S]*?ingredientBreakdown: parsed\.ingredientBreakdown[\s\S]*?\}\s*catch[\s\S]*?\}\s*\}/,
    () => recipe_replace
);

// F. generateDailyScoreExplanation
content = content.replace(
    /export const generateDailyScoreExplanation[\s\S]*?const model = genAI[\s\S]*?result = await model\.generateContent[\s\S]*?return null;[\s\S]*?\}\s*\}/,
    () => score_replace.split(/\r?\n\r?\nexport const generateDailyRecommendations/)[0]
);

// G. generateDailyRecommendations
content = content.replace(
    /export const generateDailyRecommendations[\s\S]*?const model = genAI[\s\S]*?result = await model\.generateContent[\s\S]*?\}\s*catch\s*\(e[\s\S]*?\}\s*\}/,
    () => score_replace.split(/\r?\n\r?\nexport const generateDailyRecommendations/)[1] ? 'export const generateDailyRecommendations' + score_replace.split(/\r?\n\r?\nexport const generateDailyRecommendations/)[1] : score_replace
);

fs.writeFileSync('c:\\Users\\Ofir\\Desktop\\HealthApp\\utils\\ai_fixed.ts', content);
console.log('✅ Safe File Patch script executed.');
