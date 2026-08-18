const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: key });

// Create dummy transparent pixel image
const dummyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function run() {
    console.log('Testing NEW SDK ai.models.generateContent with images...\n');
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: 'Describe if you see an image' },
                        {
                            inlineData: {
                                data: dummyImageBase64,
                                mimeType: 'image/png'
                            }
                        }
                    ]
                }
            ],
            config: {
                systemInstruction: "You are a visual assistant."
            }
        });
        console.log('✅ Image Success:', response.text);
    } catch (e) {
        console.error('❌ Image Failed:', e.message || e);
    }
}

run();
