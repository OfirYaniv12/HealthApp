const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env
if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
if (!key) {
    console.error('EXPO_PUBLIC_GEMINI_API_KEY is missing');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(key);

async function run() {
    try {
        // List models is not a standard genAI method always, we use REST
        const https = require('https');
        const url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const j = JSON.parse(data);
                if (j.models) {
                    j.models.forEach(m => console.log(`👉 ${m.name} (${m.displayName})`));
                } else {
                    console.log('No models or Error:', data);
                }
            });
        });
    } catch(e) { console.error(e); }
}
run();
