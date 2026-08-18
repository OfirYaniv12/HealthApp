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
    console.log('Testing NEW SDK ai.chats.create({ history })...\n');
    try {
        const chat = ai.chats.create({
            model: 'gemini-3.1-flash-lite-preview',
            history: [
                { role: 'user', parts: [{ text: 'My name is Bob' }] },
                { role: 'model', parts: [{ text: 'Hello Bob! How can I help?' }] }
            ],
            config: {
                systemInstruction: "You are consistent."
            }
        });

        const response = await chat.sendMessage({
            message: 'What is my name?'
        });
        console.log('✅ Chat History Success:', response.text);

    } catch (e) {
        console.error('❌ Chat History Failed:', e.message || e);
    }
}

run();
