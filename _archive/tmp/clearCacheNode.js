const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '..', 'store', 'useUserStore.ts');
console.log('We cannot easily clear AsyncStorage from outside the RN env.');
console.log('The simplest fix for the user is just to change the reset timer temporarily, or wait it out.');
