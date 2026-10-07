const fs = require('fs');
let code = fs.readFileSync('app/select-workout.tsx', 'utf-8');
code = code.replace(
  'customNotes || undefined',
  'customNotes || null'
);
fs.writeFileSync('app/select-workout.tsx', code, 'utf-8');
