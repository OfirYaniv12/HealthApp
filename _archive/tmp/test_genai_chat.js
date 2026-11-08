const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: key });

async function run() {
    console.log('Testing NEW SDK ai.chats.create()...\n');
    try {
        const chat = ai.chats.create({
            model: 'gemini-3.1-flash-lite-preview',
            config: {
                systemInstruction: "You are helpful."
            }
        });

        const response = await chat.sendMessage({
            message: 'Hello! I am Ofir.'
        });
        console.log('✅ Chat 1 Success:', response.text);

        const response2 = await chat.sendMessage({
            message: 'What is my name?'
        });
        console.log('✅ Chat 2 Success:', response2.text);

    } catch (e) {
        console.error('❌ Chat Failed:', e.message || e);
    }
}

run();
