const qrcode = require('qrcode');

const url = 'exp://192.168.1.196:8081';
const outputPath = 'C:\\Users\\Ofir\\.gemini\\antigravity\\brain\\782b9feb-4473-4a84-bc78-31b55d1ed149\\qr.png';

qrcode.toFile(outputPath, url, {
    color: { dark: '#000000', light: '#ffffff' },
    width: 400
}, function (err) {
    if (err) throw err;
    console.log('QR Code generated at', outputPath);
});
