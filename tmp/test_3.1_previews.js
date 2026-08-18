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
                    resolve({ model, response: j });
                } catch(e) { resolve({ model, response: { error: { message: 'Parse failed' } } }); }
            });
        });
        req.on('error', (e) => resolve({ model, response: { error: { message: e.message } } }));
        req.write(postData);
        req.end();
    });
}

(async () => {
    console.log('Testing 3.1 Models...\n');
    console.log(await testModel('gemini-3.1-flash-lite-preview'));
    console.log(await testModel('gemini-3.1-flash-preview-0514'));
})();
