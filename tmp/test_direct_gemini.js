const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

async function run() {
    console.log('Testing generateContent for gemini-3.1-flash-lite-preview...');
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: 'זהו מבחן חיבור. החזר מילה אחת: OK'
        });
        console.log('Result Text:', result.text);
        if (result.text && result.text.includes('OK')) {
            console.log('✅ Connection Successful!');
        } else {
            console.log('⚠️ Response received but format unexpected:', result.text);
        }
    } catch (e) {
        console.error('❌ Connection Failed:', e.message || e);
    }
}

run();
