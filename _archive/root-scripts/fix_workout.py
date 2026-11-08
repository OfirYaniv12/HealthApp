import os

path = 'components/WorkoutForm.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Add states
text = text.replace(
    '''    const [blocks, setBlocks] = useState<MuscleGroupBlock[]>([
        { id: Date.now().toString(), muscleGroup: '', exercises: [] }
    ]);''',
    '''    const [blocks, setBlocks] = useState<MuscleGroupBlock[]>([
        { id: Date.now().toString(), muscleGroup: '', exercises: [] }
    ]);
    const [workoutType, setWorkoutType] = useState<'strength' | 'cardio'>('strength');
    const [cardioDesc, setCardioDesc] = useState('');'''
)

# Add Toggle
text = text.replace(
    '''                            <TextInput 
                                style={[styles.modalInput, { fontSize: 18, fontWeight: 'bold' }]} 
                                placeholder="למשל: אימון מתח וגב" 
                                value={templateName} 
                                onChangeText={setTemplateName} 
                            />''',
    '''                            <TextInput 
                                style={[styles.modalInput, { fontSize: 18, fontWeight: 'bold' }]} 
                                placeholder="למשל: אימון כוח או ריצת בוקר" 
                                value={templateName} 
                                onChangeText={setTemplateName} 
                            />

                            <View style={{ flexDirection: 'row-reverse', marginTop: 12, marginBottom: 8, backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4 }}>
                                <TouchableOpacity style={[styles.tabBtn, workoutType === 'strength' && styles.tabBtnActive]} onPress={() => setWorkoutType('strength')}>
                                    <Ionicons name="barbell-outline" size={16} color={workoutType === 'strength' ? '#fff' : '#64748b'} />
                                    <Text style={[styles.tabBtnText, workoutType === 'strength' && styles.tabBtnTextActive]}> כוח</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.tabBtn, workoutType === 'cardio' && styles.tabBtnActive]} onPress={() => setWorkoutType('cardio')}>
                                    <Ionicons name="walk-outline" size={16} color={workoutType === 'cardio' ? '#fff' : '#64748b'} />
                                    <Text style={[styles.tabBtnText, workoutType === 'cardio' && styles.tabBtnTextActive]}> אירובי</Text>
                                </TouchableOpacity>
                            </View>'''
)

# Conditional blocks render
text = text.replace(
    '''                        {blocks.map((block, blockIndex) => (
                            <View key={block.id} style={styles.blockCard}>''',
    '''                        {workoutType === 'cardio' ? (
                            <View style={styles.blockCard}>
                                <Text style={styles.inputLabel}>תיאור האימון האירובי</Text>
                                <TextInput 
                                    style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]} 
                                    placeholder="לדוגמה: ריצת 5 קילומטר ב-25 דקות קצב בינוני."
                                    multiline 
                                    value={cardioDesc} 
                                    onChangeText={setCardioDesc} 
                                />
                            </View>
                        ) : blocks.map((block, blockIndex) => (
                            <View key={block.id} style={styles.blockCard}>'''
)

# Close blocks map ternary
text = text.replace(
    '''                            </View>
                        ))}

                        <TouchableOpacity style={[styles.actionBtnSecondary, { alignSelf: 'center', marginBottom: 24, paddingVertical: 12, paddingHorizontal: 20 }]} onPress={handleAddBlock}>
                            <Text style={styles.actionBtnTextSecondary}>+ הוסף קבוצת שרירים נוספת</Text>
                        </TouchableOpacity>''',
    '''                            </View>
                        ))}
                        
                        {workoutType === 'strength' && (
                            <TouchableOpacity style={[styles.actionBtnSecondary, { alignSelf: 'center', marginBottom: 24, paddingVertical: 12, paddingHorizontal: 20 }]} onPress={handleAddBlock}>
                                <Text style={styles.actionBtnTextSecondary}>+ הוסף קבוצת שרירים נוספת</Text>
                            </TouchableOpacity>
                        )}'''
)

# Handle Save logic
text = text.replace(
    '''    const handleSave = async () => {
        if (!templateName.trim() || !templateCategoryId) return;

        // Flatten blocks into a single array
        const flattenedExercises: Exercise[] = [];
        for (const block of blocks) {
            const mgName = block.muscleGroup.trim() || 'כללי';
            for (const ex of block.exercises) {
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
    };''',
    '''    const handleSave = async () => {
        if (!templateName.trim() || !templateCategoryId) return;

        let flattenedExercises: Exercise[] = [];
        if (workoutType === 'cardio') {
            if (!cardioDesc.trim()) return;
            flattenedExercises.push({
                id: Date.now().toString(),
                muscleGroup: 'Cardio',
                name: cardioDesc.trim(),
                sets: '-',
                reps: '-',
                weight: '-'
            });
        } else {
            for (const block of blocks) {
                const mgName = block.muscleGroup.trim() || 'כללי';
                for (const ex of block.exercises) {
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
        }
        await onSave(templateName, templateCategoryId!, flattenedExercises);
    };'''
)

# Update styles
text = text.replace(
    'modalTitle: { fontSize: 20, fontWeight: \'bold\', color: \'#1e293b\' },',
    '''modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    tabBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 6, gap: 6 },
    tabBtnActive: { backgroundColor: '#3b82f6' },
    tabBtnText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
    tabBtnTextActive: { color: '#fff' },'''
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
