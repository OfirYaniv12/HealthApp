const https = require('https');
const key = 'AIzaSyB8eUKfnAUxKLP0uTzC7iLYkmP7cMu7shs';

// Test gemini-2.0-flash-lite with a simple prompt
const postData = JSON.stringify({ contents: [{ parts: [{ text: 'Reply with just: WORKING' }] }] });
const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.log('ERROR:', json.error.code, json.error.message);
                if (json.error.details) json.error.details.forEach(d => d.violations?.forEach(v => console.log(' - Violation:', v.quotaMetric, '| limit:', v.quotaDimensions)));
            } else {
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                console.log('SUCCESS! Response:', text);
            }
        } catch(e) {
            console.log('Raw:', data.substring(0, 300));
        }
    });
});
req.on('error', (e) => console.log('Error:', e.message));
req.write(postData);
req.end();
