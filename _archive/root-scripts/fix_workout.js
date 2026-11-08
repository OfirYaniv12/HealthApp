const fs = require('fs');
let code = fs.readFileSync('components/WorkoutForm.tsx', 'utf-8');

// 1. Interface
code = code.replace(
  'onSave: (name: string, categoryId: number, flattenedExercises: Exercise[]) => Promise<void>;',
  'onSave: (name: string, categoryId: number, flattenedExercises: Exercise[], description?: string) => Promise<void>;'
);

// 2. States
const oldStates = `    const [workoutType, setWorkoutType] = useState<'strength' | 'cardio'>('strength');
    const [cardioDesc, setCardioDesc] = useState('');`;

const newStates = `    const [workoutType, setWorkoutType] = useState<'gym' | 'running' | 'cycling' | 'walking' | 'other'>('gym');
    const [requireTimeOnLog, setRequireTimeOnLog] = useState(true);
    const [presetDuration, setPresetDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [notes, setNotes] = useState('');`;

code = code.replace(oldStates, newStates);

// 3. Handle Submit
const oldSubmit = `    const handleSubmit = async () => {
        // Flatten the array to precisely match the DB tracking architecture
        const flattenedExercises: Exercise[] = [];
        for (const b of blocks) {
            const mgName = b.muscleGroup.trim() || 'כללי';
            for (const ex of b.exercises) {
                if (ex.name.trim()) {
                    flattenedExercises.push({
                        id: ex.id,
                        muscleGroup: mgName,
                        name: ex.name,
                        sets: ex.sets,
                        reps: ex.reps,
                        weight: ex.weight,
                        notes: ex.notes
                    });
                }
            }
        }

        await onSave(templateName, templateCategoryId!, flattenedExercises);
    };`;

// Wait, the previous fix was overridden or it has `flattenedExercises: Exercise[] = [];`? Let's check `handleSubmit`.
// I'll dynamically find `handleSubmit` and replace it entirely up to `};`
