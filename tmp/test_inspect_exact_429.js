const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

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
                    resolve(j);
                } catch(e) { resolve({ error: { message: 'Parse failed', data } }); }
            });
        });
        req.on('error', (e) => resolve({ error: { message: e.message } }));
        req.write(postData);
        req.end();
    });
}

(async () => {
    console.log('Inspecting exact 429 response body...\n');
    const result = await testModel('gemini-2.5-flash-lite');
    console.log(JSON.stringify(result, null, 2));
})();
