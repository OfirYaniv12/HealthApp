const fs = require('fs');
let code = fs.readFileSync('app/select-workout.tsx', 'utf-8');
code = code.replace(
  'template.exercises || template.description,',
  'template.exercises || template.description || null,'
);
fs.writeFileSync('app/select-workout.tsx', code, 'utf-8');
