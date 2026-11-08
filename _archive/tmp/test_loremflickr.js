const http = require('https');

console.log('Testing LoremFlickr accessibility...');

const url = 'https://loremflickr.com/320/240/pancake,food';

http.get(url, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers['content-type']);
    if (res.statusCode === 200 || res.statusCode === 302) {
        console.log('✅ Success! Image endpoint is active and redirecting.');
    } else {
        console.log('❌ Failed response status.');
    }
}).on('error', (e) => {
    console.error(`❌ Error: ${e.message}`);
});
