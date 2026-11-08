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
    console.log('Listing available models for your API key...\n');
    try {
        if (!ai.models || !ai.models.list) {
            console.log('❌ list function is NOT available on ai.models');
            return;
        }
        
        const response = await ai.models.list();
        
        if (response.models) {
            console.log('✅ Found Models:');
            response.models.forEach(m => {
                console.log(`- ${m.name} (${m.displayName})`);
                if (m.name.includes('imagen')) {
                    console.log(`  👉 Found Imagen Model! Support: ${m.supportedGenerationMethods.join(', ')}`);
                }
            });
        } else {
            console.log('❌ No models returned in response.');
        }
    } catch (e) {
        console.error('❌ Listing Failed:', e.message || e);
    }
}

run();
