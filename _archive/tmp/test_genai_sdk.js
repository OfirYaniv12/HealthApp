const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Initialize SDK
const ai = new GoogleGenAI({ apiKey: key });

async function run() {
    console.log('Testing NEW SDK @google/genai with gemini-2.5-flash-lite...\n');
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: 'Reply with "OK"',
            config: {
                systemInstruction: "You are a helpful assistant."
            }
        });
        console.log('✅ 2.5 Success:', response.text);
    } catch (e) {
        console.error('❌ 2.5 Failed:', e.message || e);
    }

    console.log('\nTesting @google/genai with gemini-3.1-flash-lite-preview...\n');
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: 'Reply with "OK"',
            config: {
                systemInstruction: "You are a helpful assistant.",
                thinkingConfig: {
                     thinkingBudget: 1024
                }
            }
        });
        console.log('✅ 3.1 Success:', response.text);
    } catch (e) {
        console.error('❌ 3.1 Failed:', e.message || e);
    }
}

run();
