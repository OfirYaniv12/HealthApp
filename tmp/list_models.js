const https = require('https');

const key = 'AIzaSyB8eUKfnAUxKLP0uTzC7iLYkmP7cMu7shs';

// List available models for this key
const url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.log('ERROR:', JSON.stringify(json.error, null, 2));
                return;
            }
            const models = json.models || [];
            console.log(`Found ${models.length} models:\n`);
            models.forEach(m => {
                const supportsGenerate = m.supportedGenerationMethods?.includes('generateContent');
                if (supportsGenerate) {
                    console.log(`✅ ${m.name} | ${m.displayName}`);
                }
            });
        } catch(e) {
            console.log('Parse error:', e.message);
            console.log('Raw response:', data.substring(0, 500));
        }
    });
}).on('error', (e) => console.log('Request error:', e.message));
