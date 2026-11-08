import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

if (!apiKey) {
    console.error('API Key is missing');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testConnection() {
    try {
        console.log('Testing gemini-2.0-flash on v1 endpoint...');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }, { apiVersion: 'v1' });
        
        const result = await model.generateContent('Say exactly: API IS WORKING');
        console.log('Success Response:', result.response.text());
        
    } catch (e: any) {
        console.error('API Error:', e.message || e);
        if (e.status) console.error('Status:', e.status);
    }
}

testConnection();
