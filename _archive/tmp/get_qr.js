const fs = require('fs');
const http = require('http');
const https = require('https');

http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (!json.tunnels || json.tunnels.length === 0) {
                console.log("No tunnel found!");
                return;
            }
            const tunnelUrl = json.tunnels[0].public_url.replace(/^https?:\/\//, '');
            const expUrl = `exp://${tunnelUrl}`;
            console.log("Cleaned Tunnel URL:", expUrl);
            
            const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(expUrl)}`;
            // I will save the QR to the artifacts directory so the AI interface can read it 
            // The App Data Directory is C:\\Users\\Ofir\\.gemini\\antigravity
            // Conversation ID: 9eb4fd72-ed2b-4cb1-82f1-2262e9ea81e5
            const artifactPath = "C:\\Users\\Ofir\\.gemini\\antigravity\\brain\\9eb4fd72-ed2b-4cb1-82f1-2262e9ea81e5\\new_qr.png";
            
            const file = fs.createWriteStream(artifactPath);
            https.get(qrApi, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log("QR Downloaded to artifact:", artifactPath);
                });
            }).on('error', (e) => {
                console.error("Error downloading QR:", e);
            });
        } catch (e) {
            console.error(e);
        }
    });
}).on('error', (e) => {
    console.error("Error reading tunnel API:", e);
});
