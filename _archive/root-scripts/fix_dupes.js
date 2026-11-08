const fs = require('fs');
let lines = fs.readFileSync('components/WorkoutForm.tsx', 'utf-8').split('\n');

lines = lines.filter(l => !l.includes("useState<'strength' | 'cardio'>('strength')") && !l.includes("const [cardioDesc, setCardioDesc] = useState('')"));

fs.writeFileSync('components/WorkoutForm.tsx', lines.join('\n'), 'utf-8');
