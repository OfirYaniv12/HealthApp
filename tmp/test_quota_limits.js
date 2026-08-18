const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const models = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
];

const postData = JSON.stringify({ contents: [{ parts: [{ text: 'Reply with "OK"' }] }] });

function testModel(model) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1/models/${model}:generateContent?key=${key}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    if (j.error) {
                        resolve(`❌ ${model}: ${j.error.status} - ${j.error.message.substring(0, 40)}`);
                    } else {
                        resolve(`✅ ${model}: SUCCESS`);
                    }
                } catch(e) { resolve(`❓ ${model}: parse error`); }
            });
        });
        req.on('error', (e) => resolve(`❌ ${model}: ${e.message}`));
        req.write(postData);
        req.end();
    });
}

(async () => {
    console.log('Verifying model rate limits...\n');
    for (const model of models) {
        const result = await testModel(model);
        console.log(result);
        await new Promise(r => setTimeout(r, 400));
    }
})();
