const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\Ofir\\Desktop\\HealthApp\\utils\\ai.ts';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original Length:', content.length);

// 1. Update Imports
content = content.replace(
    /import \{ GoogleGenerativeAI \} from '@google\/generative-ai';/,
    `import { GoogleGenAI } from '@google/genai';`
);

content = content.replace(
    /const genAI = new GoogleGenerativeAI\(apiKey\);/,
    `const ai = new GoogleGenAI({ apiKey });`
);

// 2. Insert Guard After WorkoutPlan
const workoutPlanMatch = /export type WorkoutPlan = \{[\s\S]*?\}\;/;
const insertedGuards = `const RPM_LIMIT = 15;
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
    workoutPlanMatch,
    match => `${match}\n\n${insertedGuards}`
);

// 3. Update generateNutritionResponse 
const nutritionMatch = /export const generateNutritionResponse[\s\S]*?const model = genAI\.getGenerativeModel[\s\S]*?responseText = result\.response\.text\(\)\;/;
content = content.replace(
    /if \(\!apiKey\) \{[\s\S]*?\}[\s\S]*?try \{[\s\S]*?const model = genAI\.getGenerativeModel\(\{ model: 'gemini-2\.5-flash-lite', systemInstruction: SYSTEM_PROMPT \}\);[\s\S]*?const apiPromise = model\.generateContent\(\{[\s\S]*?contents: \[\{ role: 'user', parts: parts \}\],[\s\S]*?generationConfig: \{ temperature: 0\.1 \}[\s\S]*?\}\);[\s\S]*?const result = await Promise\.race\(\[apiPromise, timeoutPromise\]\);[\s\S]*?const responseText = result\.response\.text\(\);/,
    `if (!apiKey) { return { isMeal: false, textResponse: 'מפתח API חסר.' }; }
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
        const responseText = result.text || '';`
);

fs.writeFileSync('c:\\Users\\Ofir\\Desktop\\HealthApp\\utils\\ai_safe_backup.ts', content);
console.log('✅ Safety Patch script executed.');
