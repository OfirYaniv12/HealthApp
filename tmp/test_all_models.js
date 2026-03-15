const https = require('https');
const key = 'AIzaSyB8eUKfnAUxKLP0uTzC7iLYkmP7cMu7shs';

const models = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.0-flash-001',
];

const postData = JSON.stringify({ contents: [{ parts: [{ text: 'Reply: WORKING' }] }] });

function testModel(model) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1/models/${model}:generateContent?key=${key}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    if (j.error) {
                        resolve(`❌ ${model}: ${j.error.code} - limit:0=${j.error.message.includes('limit: 0')}`);
                    } else {
                        const text = j.candidates?.[0]?.content?.parts?.[0]?.text || 'no text';
                        resolve(`✅ ${model}: SUCCESS - "${text.substring(0,30)}"`);
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
    console.log('Testing all models for API key...\n');
    for (const model of models) {
        const result = await testModel(model);
        console.log(result);
        await new Promise(r => setTimeout(r, 500)); // small delay between
    }
    console.log('\nDone.');
})();
