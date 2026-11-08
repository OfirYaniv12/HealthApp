const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const postData = JSON.stringify({ contents: [{ parts: [{ text: 'Reply with "OK"' }] }] });

function testModel(model, version = 'v1') {
    return new Promise((resolve) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/${version}/models/${model}:generateContent?key=${key}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    resolve({ model, version, response: j });
                } catch(e) { resolve({ model, version, response: { error: { message: 'Parse failed', data } } }); }
            });
        });
        req.on('error', (e) => resolve({ model, version, response: { error: { message: e.message } } }));
        req.write(postData);
        req.end();
    });
}

(async () => {
    console.log('Testing 1.5-flash and others with v1beta...\n');
    console.log(await testModel('gemini-1.5-flash', 'v1beta'));
    console.log(await testModel('gemini-1.5-flash-8b', 'v1beta'));
})();
