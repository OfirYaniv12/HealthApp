import { WorkoutTemplate } from '@/db/database';
import { AlertManager as Alert } from '@/components/GlobalAlert';
import { DISTANCE_TYPES, parseTemplateMeta, WORKOUT_TYPE_LABELS, WORKOUT_TYPES, WorkoutType } from '@/utils/workoutTemplates';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface Exercise {
    id: string;
    muscleGroup: string;
    name: string;
    sets: string;
    reps: string;
    weight: string;
    notes?: string;
    status?: 'easy' | 'good' | 'hard' | null;
}

interface MuscleGroupBlock {
    id: string;
    muscleGroup: string; // The title of the section (e.g. "חזה")
    exercises: {
        id: string;
        name: string;
        sets: string;
        reps: string;
        weight: string;
        notes?: string;
        status?: Exercise['status'];
    }[];
}

interface WorkoutFormProps {
    visible: boolean;
    isGenerating: boolean;
    onClose: () => void;
    onSave: (name: string, flattenedExercises: Exercise[], description?: string | null) => Promise<void>;
    /** When set, the form opens in edit mode pre-filled with this template. */
    initialTemplate?: WorkoutTemplate | null;
}

export default function WorkoutForm({ visible, isGenerating, onClose, onSave, initialTemplate }: WorkoutFormProps) {
    const isEditMode = !!initialTemplate;
    const wasEditingRef = useRef(false);
    const [templateName, setTemplateName] = useState('');
    const [blocks, setBlocks] = useState<MuscleGroupBlock[]>([
        { id: Date.now().toString(), muscleGroup: '', exercises: [] }
    ]);
    const [workoutType, setWorkoutType] = useState<WorkoutType>('gym');
    const [requireTimeOnLog, setRequireTimeOnLog] = useState(true);
    const [presetDuration, setPresetDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [notes, setNotes] = useState('');

    const clearFields = () => {
        setTemplateName('');
        setBlocks([{ id: Date.now().toString(), muscleGroup: '', exercises: [] }]);
        setWorkoutType('gym');
        setRequireTimeOnLog(true);
        setPresetDuration('');
        setDistance('');
        setNotes('');
    };

    // Load the template into the form when opening in edit mode
    useEffect(() => {
        if (!visible) return;
        if (initialTemplate) {
            const meta = parseTemplateMeta(initialTemplate);
            setTemplateName(initialTemplate.name || '');
            setWorkoutType(meta.type);
            setRequireTimeOnLog(meta.requireTimeOnLog);
            setPresetDuration(meta.presetDuration || '');
            setDistance(meta.distance || '');
            setNotes(meta.notes || '');

            let loadedBlocks: MuscleGroupBlock[] = [];
            if (meta.type === 'gym') {
                try {
                    const exs: Exercise[] = JSON.parse(initialTemplate.exercises || '[]');
                    (Array.isArray(exs) ? exs : []).forEach((ex, i) => {
                        const group = ex.muscleGroup || 'כללי';
                        let block = loadedBlocks.find(b => b.muscleGroup === group);
                        if (!block) {
                            block = { id: `b${i}-${Date.now()}`, muscleGroup: group, exercises: [] };
                            loadedBlocks.push(block);
                        }
                        block.exercises.push({
                            id: ex.id || `e${i}-${Date.now()}`,
                            name: ex.name || '',
                            sets: ex.sets || '',
                            reps: ex.reps || '',
                            weight: ex.weight || '',
                            notes: ex.notes || '',
                            status: ex.status,
                        });
                    });
                } catch (e) { }
            }
            setBlocks(loadedBlocks.length > 0 ? loadedBlocks : [{ id: Date.now().toString(), muscleGroup: '', exercises: [] }]);
        } else if (wasEditingRef.current) {
            clearFields();
        }
        wasEditingRef.current = !!initialTemplate;
    }, [visible, initialTemplate]);

    const handleAddBlock = () => {
        setBlocks(prev => [...prev, { id: Date.now().toString(), muscleGroup: '', exercises: [] }]);
    };

    const handleRemoveBlock = (blockId: string) => {
        setBlocks(prev => prev.filter(b => b.id !== blockId));
    };

    const handleAddExerciseToBlock = (blockId: string) => {
        setBlocks(prev => prev.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    exercises: [...b.exercises, { id: Date.now().toString() + Math.random(), name: '', sets: '', reps: '', weight: '', notes: '' }]
                };
            }
            return b;
        }));
    };

    const handleRemoveExerciseFromBlock = (blockId: string, exId: string) => {
        setBlocks(prev => prev.map(b => {
            if (b.id === blockId) {
                return { ...b, exercises: b.exercises.filter(e => e.id !== exId) };
            }
            return b;
        }));
    };

    const updateBlockTitle = (blockId: string, text: string) => {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, muscleGroup: text } : b));
    };

    const updateExercise = (blockId: string, exId: string, field: 'name' | 'sets' | 'reps' | 'weight' | 'notes', value: string) => {
        setBlocks(prev => prev.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    exercises: b.exercises.map(e => e.id === exId ? { ...e, [field]: value } : e)
                };
            }
            return b;
        }));
    };

    const handleSubmit = async () => {
        if (!templateName.trim()) {
            Alert.alert('חסר שם', 'יש לתת שם לאימון.');
            return;
        }

        const flattenedExercises: Exercise[] = [];
        
        let descObj = null;

        if (workoutType !== 'gym') {
            let nameDesc = WORKOUT_TYPE_LABELS[workoutType] + '. ';
            
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
                            notes: ex.notes,
                            ...(ex.status ? { status: ex.status } : {})
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
        await onSave(templateName, flattenedExercises, descriptionStr);
    };

    const resetForm = () => {
        clearFields();
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContentLarge}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{isEditMode ? 'עריכת אימון' : 'אימון חדש לספרייה'}</Text>
                        <TouchableOpacity onPress={resetForm} disabled={isGenerating}>
                            <Ionicons name="close" size={26} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        <View style={styles.sectionCard}>
                            <Text style={styles.inputLabel}>שם האימון</Text>
                            <TextInput 
                                style={[styles.modalInput, { fontSize: 18, fontWeight: 'bold' }]} 
                                placeholder="למשל: אימון כוח או ריצת בוקר" 
                                value={templateName} 
                                onChangeText={setTemplateName} 
                            />

                            
                            <View style={{ marginTop: 12, marginBottom: 8, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                                {WORKOUT_TYPES.map(t => (
                                    <TouchableOpacity 
                                        key={t.id} 
                                        style={[styles.tabBtn, workoutType === t.id && styles.tabBtnActive, { paddingHorizontal: 12, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', backgroundColor: workoutType === t.id ? '#3b82f6' : '#f1f5f9' }]} 
                                        onPress={() => setWorkoutType(t.id as any)}>
                                        <Ionicons name={t.icon as any} size={16} color={workoutType === t.id ? '#fff' : '#64748b'} />
                                        <Text style={[styles.tabBtnText, workoutType === t.id && styles.tabBtnTextActive]}> {t.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

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


                        </View>

                        <Text style={styles.sectionHeaderTitle}>תוכנית התרגילים</Text>

                        {workoutType !== 'gym' ? (
                            <View style={styles.blockCard}>
                                {DISTANCE_TYPES.includes(workoutType) && (
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
                        ) : blocks.map((block, blockIndex) => (
                            <View key={block.id} style={styles.blockCard}>
                                {/* Block Header */}
                                <View style={styles.blockHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>קבוצת שרירים (למשל: חזה, רגליים)</Text>
                                        <TextInput
                                            style={[styles.modalInput, { backgroundColor: '#fff', marginBottom: 0 }]}
                                            placeholder="הזן שם קבוצה"
                                            value={block.muscleGroup}
                                            onChangeText={(t) => updateBlockTitle(block.id, t)}
                                        />
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.deleteBlockBtn}
                                        onPress={() => handleRemoveBlock(block.id)}
                                    >
                                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>

                                {/* Exercises inside Block */}
                                <View style={styles.exercisesContainer}>
                                    {block.exercises.map((ex, exIndex) => (
                                        <View key={ex.id} style={styles.exerciseRow}>
                                            <View style={styles.exerciseNumber}>
                                                <Text style={styles.exerciseNumberText}>{exIndex + 1}</Text>
                                            </View>
                                            <View style={{ flex: 1, gap: 8 }}>
                                                <TextInput 
                                                    style={styles.inlineInput} 
                                                    placeholder="שם התרגיל (למשל סקוואט)" 
                                                    value={ex.name} 
                                                    onChangeText={t => updateExercise(block.id, ex.id, 'name', t)} 
                                                />
                                                <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                                                    <TextInput style={[styles.inlineInput, { flex: 1, textAlign: 'center' }]} placeholder="סטים (3)" value={ex.sets} keyboardType="numeric" onChangeText={t => updateExercise(block.id, ex.id, 'sets', t)} />
                                                    <TextInput style={[styles.inlineInput, { flex: 1, textAlign: 'center' }]} placeholder="חזרות (12)" value={ex.reps} keyboardType="numeric" onChangeText={t => updateExercise(block.id, ex.id, 'reps', t)} />
                                                    <TextInput style={[styles.inlineInput, { flex: 1.5, textAlign: 'center' }]} placeholder="משקל" value={ex.weight} onChangeText={t => updateExercise(block.id, ex.id, 'weight', t)} />
                                                </View>
                                                <TextInput 
                                                    style={styles.inlineInput} 
                                                    placeholder="הערות אישיות (למשל: לא להעמיס על הגב...)" 
                                                    value={ex.notes || ''} 
                                                    onChangeText={t => updateExercise(block.id, ex.id, 'notes', t)} 
                                                />
                                            </View>
                                            <TouchableOpacity 
                                                style={styles.deleteExerciseBtn}
                                                onPress={() => handleRemoveExerciseFromBlock(block.id, ex.id)}
                                            >
                                                <Ionicons name="close-circle" size={22} color="#cbd5e1" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>

                                <TouchableOpacity 
                                    style={styles.addExerciseBtn} 
                                    onPress={() => handleAddExerciseToBlock(block.id)}
                                >
                                    <Ionicons name="add" size={16} color="#3b82f6" />
                                    <Text style={styles.addExerciseText}>הוסף תרגיל ל{block.muscleGroup ? `"${block.muscleGroup}"` : 'קבוצה זו'}</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                        
                        {workoutType === 'gym' && (
                            <TouchableOpacity style={[styles.actionBtnSecondary, { alignSelf: 'center', marginBottom: 24, paddingVertical: 12, paddingHorizontal: 20 }]} onPress={handleAddBlock}>
                                <Text style={styles.actionBtnTextSecondary}>+ הוסף קבוצת שרירים נוספת</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.fullSubmitBtn} onPress={handleSubmit} disabled={isGenerating}>
                            {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={styles.fullSubmitText}>{isEditMode ? 'שמור שינויים' : 'סכם באמצעות AI ושמור אימון'}</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 16 },
    modalContentLarge: { backgroundColor: '#f1f5f9', borderRadius: 24, flex: 1, marginTop: 40, marginBottom: 20 },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    tabBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 6, gap: 6 },
    tabBtnActive: { backgroundColor: '#3b82f6' },
    tabBtnText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
    tabBtnTextActive: { color: '#fff' },
    
    sectionCard: { backgroundColor: '#fff', padding: 20, marginBottom: 16 },
    inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8, textAlign: 'right', textTransform: 'uppercase' },
    modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 16, textAlign: 'right', color: '#1e293b' },
    
    catSelectChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    catSelectChipActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 1 },
    catSelectText: { color: '#64748b', fontWeight: '500', fontSize: 14 },
    catSelectTextActive: { color: '#2563eb', fontWeight: 'bold' },

    sectionHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', textAlign: 'right', marginHorizontal: 20, marginBottom: 16, marginTop: 8 },

    blockCard: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
    blockHeader: { flexDirection: 'row-reverse', padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'flex-end', gap: 12 },
    deleteBlockBtn: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 8, marginBottom: 2 },
    
    exercisesContainer: { padding: 16, gap: 16 },
    exerciseRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: '#fff' },
    exerciseNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8 },
    exerciseNumberText: { color: '#4f46e5', fontWeight: 'bold', fontSize: 13 },
    
    inlineInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, fontSize: 14, color: '#1e293b', textAlign: 'right' },
    deleteExerciseBtn: { alignSelf: 'flex-start', marginTop: 16 },

    addExerciseBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafafa', gap: 6 },
    addExerciseText: { color: '#3b82f6', fontWeight: '600', fontSize: 14 },

    actionBtnSecondary: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    actionBtnTextSecondary: { color: '#3b82f6', fontWeight: 'bold', fontSize: 15 },

    fullSubmitBtn: { backgroundColor: '#3b82f6', borderRadius: 16, padding: 18, alignItems: 'center', marginHorizontal: 16, marginTop: 8 },
    fullSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
