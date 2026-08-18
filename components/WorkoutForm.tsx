import { WorkoutCategory } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
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
    }[];
}

interface WorkoutFormProps {
    visible: boolean;
    categories: WorkoutCategory[];
    isGenerating: boolean;
    onClose: () => void;
    onSave: (name: string, categoryId: number, flattenedExercises: Exercise[]) => Promise<void>;
}

export default function WorkoutForm({ visible, categories, isGenerating, onClose, onSave }: WorkoutFormProps) {
    const [templateName, setTemplateName] = useState('');
    const [templateCategoryId, setTemplateCategoryId] = useState<number | null>(null);
    const [blocks, setBlocks] = useState<MuscleGroupBlock[]>([
        { id: Date.now().toString(), muscleGroup: '', exercises: [] }
    ]);

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
    };

    const resetForm = () => {
        setTemplateName('');
        setTemplateCategoryId(null);
        setBlocks([{ id: Date.now().toString(), muscleGroup: '', exercises: [] }]);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={styles.modalContentLarge}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>אימון חדש לספרייה</Text>
                        <TouchableOpacity onPress={resetForm} disabled={isGenerating}>
                            <Ionicons name="close" size={26} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        <View style={styles.sectionCard}>
                            <Text style={styles.inputLabel}>שם האימון</Text>
                            <TextInput 
                                style={[styles.modalInput, { fontSize: 18, fontWeight: 'bold' }]} 
                                placeholder="למשל: אימון מתח וגב" 
                                value={templateName} 
                                onChangeText={setTemplateName} 
                            />

                            <Text style={[styles.inputLabel, { marginTop: 8 }]}>קטגוריה</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                                {categories.map(cat => (
                                    <TouchableOpacity 
                                        key={cat.id} 
                                        style={[styles.catSelectChip, templateCategoryId === cat.id && styles.catSelectChipActive]} 
                                        onPress={() => setTemplateCategoryId(cat.id!)}
                                    >
                                        <Text style={[styles.catSelectText, templateCategoryId === cat.id && styles.catSelectTextActive]}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <Text style={styles.sectionHeaderTitle}>תוכנית התרגילים</Text>

                        {blocks.map((block, blockIndex) => (
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

                        <TouchableOpacity style={[styles.actionBtnSecondary, { alignSelf: 'center', marginBottom: 24, paddingVertical: 12, paddingHorizontal: 20 }]} onPress={handleAddBlock}>
                            <Text style={styles.actionBtnTextSecondary}>+ הוסף קבוצת שרירים נוספת</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.fullSubmitBtn} onPress={handleSubmit} disabled={isGenerating}>
                            {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={styles.fullSubmitText}>סכם באמצעות AI ושמור אימון</Text>}
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
