const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const j = JSON.parse(data);
            if (j.models) {
                j.models.forEach(m => console.log(`👉 ${m.name} (${m.displayName})`));
            } else { console.log('No models or Error:', data); }
        } catch(e) { console.log('JSON error'); }
    });
});
