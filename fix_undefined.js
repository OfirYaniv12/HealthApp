const fs = require('fs');

let code1 = fs.readFileSync('app/select-workout.tsx', 'utf-8');
code1 = code1.replace('customNotes || null,', 'customNotes || null,'); // wait, let's fix the line dynamically
code1 = code1.replace('customNotes || undefined', 'customNotes || null');
fs.writeFileSync('app/select-workout.tsx', code1, 'utf-8');
