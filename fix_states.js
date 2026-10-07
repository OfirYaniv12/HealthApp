const fs = require('fs');
let code = fs.readFileSync('components/WorkoutForm.tsx', 'utf-8');

// The states line:
// const [blocks, setBlocks] = useState<MuscleGroupBlock[]>([\n        { id: Date.now().toString(), muscleGroup: '', exercises: [] }\n    ]);
code = code.replace(
    /const \[blocks, setBlocks\] = useState<MuscleGroupBlock\[\]>\(\[\s*\{\s*id: Date.now\(\).toString\(\), muscleGroup: '', exercises: \[\]\s*\}\s*\]\);/,
    `const [blocks, setBlocks] = useState<MuscleGroupBlock[]>([\n        { id: Date.now().toString(), muscleGroup: '', exercises: [] }\n    ]);
    const [workoutType, setWorkoutType] = useState<'gym' | 'running' | 'cycling' | 'walking' | 'other'>('gym');
    const [requireTimeOnLog, setRequireTimeOnLog] = useState(true);
    const [presetDuration, setPresetDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [notes, setNotes] = useState('');`
);

// We need to add the missing styles:
const stylesRegex = /modalTitle: \{ fontSize: 20, fontWeight: 'bold', color: '#1e293b' \},/;
code = code.replace(stylesRegex, `modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    tabBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 6, gap: 6 },
    tabBtnActive: { backgroundColor: '#3b82f6' },
    tabBtnText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
    tabBtnTextActive: { color: '#fff' },`);

fs.writeFileSync('components/WorkoutForm.tsx', code, 'utf-8');
