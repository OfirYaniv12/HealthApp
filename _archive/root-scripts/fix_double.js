const fs = require('fs');

let code = fs.readFileSync('components/WorkoutForm.tsx', 'utf-8');
const regex = /const \[workoutType, setWorkoutType\] = useState<'strength' \| 'cardio'>\('strength'\);\n\s*const \[cardioDesc, setCardioDesc\] = useState\(''\);/;
code = code.replace(regex, '');
code = code.replace(
  "{workoutType === 'strength' && (",
  "{workoutType === 'gym' && ("
);
fs.writeFileSync('components/WorkoutForm.tsx', code, 'utf-8');
