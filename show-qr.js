const qrcode = require('qrcode-terminal');
qrcode.generate('exp://192.168.1.202:8081', { small: true });
