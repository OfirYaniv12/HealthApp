const fs = require('fs');
let code = fs.readFileSync('components/WorkoutForm.tsx', 'utf-8');

// 1. Props
code = code.replace(
  'onSave: (name: string, categoryId: number, flattenedExercises: Exercise[]) => Promise<void>;',
  'onSave: (name: string, categoryId: number, flattenedExercises: Exercise[], description?: string | null) => Promise<void>;'
);

// 2. States
const oldStates = `    const [workoutType, setWorkoutType] = useState<'strength' | 'cardio'>('strength');
    const [cardioDesc, setCardioDesc] = useState('');`;

const newStates = `    const [workoutType, setWorkoutType] = useState<'gym' | 'running' | 'cycling' | 'walking' | 'other'>('gym');
    const [requireTimeOnLog, setRequireTimeOnLog] = useState(true);
    const [presetDuration, setPresetDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [notes, setNotes] = useState('');`;

code = code.replace(oldStates, newStates) || code;
if (!code.includes('requireTimeOnLog')) {
  // If replacement failed, fallback
  code = code.replace(
      `    const [blocks, setBlocks] = useState<MuscleGroupBlock[]>([
        { id: Date.now().toString(), muscleGroup: '', exercises: [] }
    ]);`,
      `    const [blocks, setBlocks] = useState<MuscleGroupBlock[]>([
        { id: Date.now().toString(), muscleGroup: '', exercises: [] }
    ]);\n${newStates}`
  );
}

// 3. Reset Form
code = code.replace(
    `setBlocks([{ id: Date.now().toString(), muscleGroup: '', exercises: [] }]);`,
    `setBlocks([{ id: Date.now().toString(), muscleGroup: '', exercises: [] }]);
        setWorkoutType('gym');
        setRequireTimeOnLog(true);
        setPresetDuration('');
        setDistance('');
        setNotes('');`
);

// 4. Submit
const submitStart = code.indexOf('const handleSubmit = async () => {');
const submitEnd = code.indexOf('};', submitStart) + 2;

const newSubmit = `const handleSubmit = async () => {
        if (!templateName.trim() || !templateCategoryId) {
            return;
        }

        const flattenedExercises: Exercise[] = [];
        
        let descObj = null;

        if (workoutType !== 'gym') {
            let nameDesc = '';
            if (workoutType === 'running') nameDesc = 'ריצה. ';
            if (workoutType === 'cycling') nameDesc = 'רכיבה. ';
            if (workoutType === 'walking') nameDesc = 'הליכה. ';
            if (workoutType === 'other') nameDesc = 'אחר. ';
            
            if (distance) nameDesc += 'מרחק: ' + distance + ' ק"מ. ';
            if (!requireTimeOnLog && presetDuration) nameDesc += 'זמן קבוע: ' + presetDuration + ' דקות. ';
            if (notes) nameDesc += 'הערות: ' + notes;

            flattenedExercises.push({
                id: Date.now().toString(),
                muscleGroup: workoutType,
                name: nameDesc,
                sets: '-', reps: '-', weight: '-'
            });
            
            descObj = {
                type: workoutType,
                requireTimeOnLog,
                presetDuration,
                distance,
                notes
            };
        } else {
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
            
            // Gym could also use the preset duration!
            descObj = {
                type: 'gym',
                requireTimeOnLog,
                presetDuration
            };
        }

        const descriptionStr = descObj ? JSON.stringify(descObj) : null;
        await onSave(templateName, templateCategoryId, flattenedExercises, descriptionStr);
    };`;

code = code.substring(0, submitStart) + newSubmit + code.substring(submitEnd);

// 5. Tabs & UI
const toggleRegex = /<View style={{ flexDirection: 'row-reverse', marginTop: 12.*?<\/View>/s;
const newTabs = `
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 8 }} contentContainerStyle={{ gap: 8, flexDirection: 'row-reverse' }}>
                                {[
                                    { id: 'gym', label: 'חדר כושר', icon: 'barbell-outline' },
                                    { id: 'running', label: 'ריצה', icon: 'walk-outline' },
                                    { id: 'cycling', label: 'רכיבה', icon: 'bicycle-outline' },
                                    { id: 'walking', label: 'הליכה', icon: 'footsteps-outline' },
                                    { id: 'other', label: 'אחר', icon: 'list-outline' }
                                ].map(t => (
                                    <TouchableOpacity 
                                        key={t.id} 
                                        style={[styles.tabBtn, workoutType === t.id && styles.tabBtnActive, { paddingHorizontal: 12 }]} 
                                        onPress={() => setWorkoutType(t.id as any)}>
                                        <Ionicons name={t.icon as any} size={16} color={workoutType === t.id ? '#fff' : '#64748b'} />
                                        <Text style={[styles.tabBtnText, workoutType === t.id && styles.tabBtnTextActive]}> {t.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={{ marginBottom: 16, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 }}>
                                <TouchableOpacity 
                                    style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }} 
                                    onPress={() => setRequireTimeOnLog(!requireTimeOnLog)}>
                                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name={requireTimeOnLog ? "square-outline" : "checkbox"} size={24} color="#3b82f6" />
                                        <Text style={{ fontSize: 15, color: '#334155' }}>הזן זמן עכשיו (ולא בכל פעם שמתאמנים)</Text>
                                    </View>
                                </TouchableOpacity>
                                
                                {!requireTimeOnLog && (
                                    <View style={{ marginTop: 12 }}>
                                        <Text style={styles.inputLabel}>משך זמן האימון (דקות)</Text>
                                        <TextInput 
                                            style={styles.modalInput} 
                                            placeholder="לדוגמה: 45" 
                                            keyboardType="decimal-pad" 
                                            value={presetDuration} 
                                            onChangeText={setPresetDuration} 
                                        />
                                    </View>
                                )}
                            </View>
`;
code = code.replace(toggleRegex, newTabs);

const cardioRegex = /\{workoutType === 'cardio' \? \(.*?\) : blocks\.map/s;
const newCardio = `{workoutType !== 'gym' ? (
                            <View style={styles.blockCard}>
                                {['running', 'cycling', 'walking'].includes(workoutType) && (
                                    <View style={{ marginBottom: 12 }}>
                                        <Text style={styles.inputLabel}>מרחק (ק"מ / מטרים)</Text>
                                        <TextInput 
                                            style={styles.modalInput} 
                                            placeholder="לדוגמה: 5 ק״מ" 
                                            value={distance} 
                                            onChangeText={setDistance} 
                                        />
                                    </View>
                                )}
                                <Text style={styles.inputLabel}>הערות (אופציונלי)</Text>
                                <TextInput 
                                    style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} 
                                    placeholder="פרטים נוספים, קצב, הרגשה..."
                                    multiline 
                                    value={notes} 
                                    onChangeText={setNotes} 
                                />
                            </View>
                        ) : blocks.map`;
code = code.replace(cardioRegex, newCardio);

fs.writeFileSync('components/WorkoutForm.tsx', code, 'utf-8');
