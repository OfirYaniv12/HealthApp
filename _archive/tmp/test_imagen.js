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
    console.log('Testing generateImages with @google/genai...\n');
    try {
        if (!ai.models || !ai.models.generateImages) {
            console.log('❌ generateImages function is NOT available on ai.models');
            return;
        }
        
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002', // Standard Imagen 3 model name
            prompt: 'Delicious protein pancake on a plate',
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1'
            }
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            console.log('✅ Success! Image generated.');
            console.log('Image Data Type:', typeof response.generatedImages[0].image.imageBytes);
            console.log('Image Byte Length:', response.generatedImages[0].image.imageBytes.length);
        } else {
            console.log('❌ No image returned in response.');
        }
    } catch (e) {
        console.error('❌ Imagen Failed:', e.message || e);
    }
}

run();
