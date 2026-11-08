const fs = require('fs');

let code1 = fs.readFileSync('app/select-workout.tsx', 'utf-8');
code1 = code1.replace(/notes: customNotes \|\| undefined,?/g, '');
fs.writeFileSync('app/select-workout.tsx', code1, 'utf-8');

let code2 = fs.readFileSync('app/(drawer)/my-workouts.tsx', 'utf-8');
code2 = code2.replace(/notes: customNotes \|\| undefined,?/g, '');
fs.writeFileSync('app/(drawer)/my-workouts.tsx', code2, 'utf-8');
