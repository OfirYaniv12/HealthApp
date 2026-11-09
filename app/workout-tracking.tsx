import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, SafeAreaView, Platform, KeyboardAvoidingView, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getWorkoutTemplateById, updateWorkoutTemplateExercises } from '@/db/database';
import { Exercise } from '@/components/WorkoutForm';
import { AlertManager as Alert } from '@/components/GlobalAlert';
import { useUserStore } from '@/store/useUserStore';
import { computeWorkoutCalories } from '@/utils/workoutCalories';
import { logTemplateWorkout, parseTemplateMeta } from '@/utils/workoutTemplates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator } from 'react-native';

export default function WorkoutTrackingScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    
    const [template, setTemplate] = useState<any>(null);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [isEditingMode, setIsEditingMode] = useState(false);
    
    // Status Modal State
    const [statusModalExIndex, setStatusModalExIndex] = useState<number | null>(null);

    // Auto-save debounce tracker
    const [saveTimeout, setSaveTimeout] = useState<any>(null);

    // ---- Optional workout timer: "started" -> "finished" measures the duration for you ----
    // The start time is stored on the device, so the timer keeps running if you leave the screen or close the app.
    const user = useUserStore(state => state.user);
    const timerKey = `workoutTimer:${id}`;
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [nowTick, setNowTick] = useState(Date.now());
    const [finishVisible, setFinishVisible] = useState(false);
    const [finishMinutes, setFinishMinutes] = useState('');
    const [savingWorkout, setSavingWorkout] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(timerKey).then(v => { if (v) setStartedAt(Number(v)); }).catch(() => { });
    }, [timerKey]);

    useEffect(() => {
        if (!startedAt) return;
        const t = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(t);
    }, [startedAt]);

    const elapsedSec = startedAt ? Math.max(0, Math.floor((nowTick - startedAt) / 1000)) : 0;
    const formatElapsed = (sec: number) => {
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return (h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
    };

    const startTimer = async () => {
        const t = Date.now();
        setStartedAt(t);
        setNowTick(t);
        try { await AsyncStorage.setItem(timerKey, String(t)); } catch (e) { }
    };

    const clearTimer = async () => {
        setStartedAt(null);
        try { await AsyncStorage.removeItem(timerKey); } catch (e) { }
    };

    const finishTimer = () => {
        setFinishMinutes(String(Math.max(1, Math.round(elapsedSec / 60))));
        setFinishVisible(true);
    };

    const finishMinutesNum = parseFloat(finishMinutes.replace(',', '.'));
    const templateMeta = template ? parseTemplateMeta(template) : null;
    const finishPreview = templateMeta && finishMinutesNum > 0
        ? computeWorkoutCalories({
            type: templateMeta.type,
            minutes: finishMinutesNum,
            weightKg: user?.weight || 70,
            exercises,
            restSeconds: templateMeta.restSeconds ?? null,
        })
        : null;

    const saveFinishedWorkout = async () => {
        if (!user || !template || !(finishMinutesNum > 0)) return;
        setSavingWorkout(true);
        try {
            // Make sure the latest weights/sets from this screen are saved on the template first
            if (saveTimeout) clearTimeout(saveTimeout);
            await updateWorkoutTemplateExercises(template.id, JSON.stringify(exercises));
            const { calBurned, summary } = await logTemplateWorkout({
                user,
                template: { ...template, exercises: JSON.stringify(exercises) },
                durationMinutes: Math.round(finishMinutesNum),
            });
            await clearTimer();
            setFinishVisible(false);
            Alert.alert('אימון נשמר!', `שרפת כ-${calBurned} קלוריות.\n\n${summary}`, [{ text: 'אישור', onPress: () => router.back() }]);
        } catch (e) {
            Alert.alert('שגיאה', 'לא הצלחנו לשמור את האימון. נסה שוב.');
        } finally {
            setSavingWorkout(false);
        }
    };

    const loadData = async () => {
        if (!id) return;
        try {
            const data = await getWorkoutTemplateById(parseInt(id as string, 10));
            if (data) {
                setTemplate(data);
                const parsed = JSON.parse(data.exercises || '[]');
                setExercises(parsed);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => { loadData(); }, [id]);

    // Grouping helper
    const getGroupedExercises = () => {
        return exercises.reduce((groups, ex, index) => {
            const key = ex.muscleGroup;
            if (!groups[key]) groups[key] = [];
            groups[key].push({ ...ex, originalIndex: index });
            return groups;
        }, {} as Record<string, (Exercise & { originalIndex: number })[]>);
    };

    const grouped = getGroupedExercises();

    // Auto Persistence Logic (Only applies outside edit mode)
    const triggerAutoSave = (updatedExercises: Exercise[]) => {
        if (saveTimeout) clearTimeout(saveTimeout);
        const timeout = setTimeout(async () => {
            try {
                const json = JSON.stringify(updatedExercises);
                await updateWorkoutTemplateExercises(template.id, json);
            } catch (e) {
                console.error("Auto save failed", e);
            }
        }, 500);
        setSaveTimeout(timeout);
    };

    const handleUpdateField = (index: number, field: keyof Exercise, value: string | null) => {
        const updated = [...exercises];
        updated[index] = { ...updated[index], [field]: value };
        setExercises(updated);
        
        // Auto-save automatically if NOT in edit mode
        if (!isEditingMode) {
            triggerAutoSave(updated);
        }
    };

    const handleUpdateStatus = (status: 'easy' | 'good' | 'hard' | null) => {
        if (statusModalExIndex === null) return;
        handleUpdateField(statusModalExIndex, 'status', status as any);
        setStatusModalExIndex(null);
    };

    const renderStatusBox = (status?: string, onPress?: () => void) => {
        let emoji = '';
        let color = '#e2e8f0'; // Gray
        if (status === 'easy') { emoji = '💪'; color = '#22c55e'; /* Green */ }
        else if (status === 'good') { emoji = '🔥'; color = '#eab308'; /* Yellow */ }
        else if (status === 'hard') { emoji = '😫'; color = '#ef4444'; /* Red */ }

        return (
            <TouchableOpacity style={[styles.statusBox, { borderColor: color }]} onPress={onPress} activeOpacity={0.7}>
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
            </TouchableOpacity>
        );
    };

    // Edit Mode Structural Actions
    const handleAddExercise = (muscleGroup: string) => {
        setExercises(prev => [...prev, { id: Date.now().toString(), muscleGroup, name: '', sets: '', reps: '', weight: '', notes: '' }]);
    };
    
    const handleAddGroup = () => {
        const groupName = `קבוצה חדשה ${Object.keys(grouped).length + 1}`;
        setExercises(prev => [...prev, { id: Date.now().toString(), muscleGroup: groupName, name: '', sets: '', reps: '', weight: '', notes: '' }]);
    };

    const handleRemoveExercise = (index: number) => {
        setExercises(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveEditMode = async () => {
        try {
            const cleaned = exercises.filter(e => e.name.trim());
            const json = JSON.stringify(cleaned);
            await updateWorkoutTemplateExercises(template.id, json);
            setExercises(cleaned);
            setIsEditingMode(false);
        } catch(e) { console.error(e); }
    };

    const handleCancelEditMode = () => {
        loadData(); // Revert back to DB state
        setIsEditingMode(false);
    };

    if (!template) return <SafeAreaView style={styles.safeArea}><Text style={{ textAlign: 'center', marginTop: 40 }}>טוען...</Text></SafeAreaView>;

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                {/* Left Side: Back Arrow OR Save/Cancel */}
                {isEditingMode ? (
                    <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
                        <TouchableOpacity onPress={handleSaveEditMode}><Text style={styles.saveText}>שמור</Text></TouchableOpacity>
                        <TouchableOpacity onPress={handleCancelEditMode}><Text style={styles.cancelText}>ביטול</Text></TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={26} color="#1e293b" />
                    </TouchableOpacity>
                )}

                {/* Center Title */}
                <Text style={styles.headerTitle} numberOfLines={1}>{template.name}</Text>
                
                {/* Right Side: Edit Button OR Empty Spacer */}
                {isEditingMode ? (
                    <View style={{ width: 40 }} />
                ) : (
                    <TouchableOpacity onPress={() => setIsEditingMode(true)} style={styles.iconButtonRight}>
                        <Text style={{ color: '#3b82f6', fontSize: 14, fontWeight: 'bold', marginLeft: 4 }}>עריכה</Text>
                        <Ionicons name="create-outline" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                )}
            </View>

            {!isEditingMode && (
                <View style={styles.timerBar}>
                    {startedAt ? (
                        <>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.timerLabel}>האימון רץ</Text>
                                <Text style={styles.timerValue}>{formatElapsed(elapsedSec)}</Text>
                            </View>
                            <TouchableOpacity style={styles.finishBtn} onPress={finishTimer}>
                                <Ionicons name="stop-circle-outline" size={22} color="#fff" />
                                <Text style={styles.timerBtnText}>סיימתי אימון</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Alert.alert('לבטל את המדידה?', 'הזמן שנמדד יימחק והאימון לא יירשם.', [
                                { text: 'המשך למדוד', style: 'cancel' },
                                { text: 'בטל מדידה', style: 'destructive', onPress: clearTimer },
                            ])}>
                                <Text style={styles.cancelTimerText}>בטל</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity style={styles.startBtn} onPress={startTimer}>
                                <Ionicons name="play-circle-outline" size={22} color="#fff" />
                                <Text style={styles.timerBtnText}>התחלתי אימון</Text>
                            </TouchableOpacity>
                            <Text style={styles.timerHint}>אופציונלי: נמדוד את זמן האימון בשבילך, ובסיום תאשר שמירה</Text>
                        </>
                    )}
                </View>
            )}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {Object.entries(grouped).map(([groupName, exs]) => (
                        <View key={groupName} style={styles.groupContainer}>
                            {isEditingMode ? (
                                <TextInput 
                                    style={styles.groupHeaderInput}
                                    value={groupName}
                                    onChangeText={(t) => {
                                        const updated = exercises.map(e => e.muscleGroup === groupName ? { ...e, muscleGroup: t } : e);
                                        setExercises(updated);
                                    }}
                                />
                            ) : (
                                <Text style={styles.groupHeaderTitle}>{groupName}</Text>
                            )}

                            {exs.map((ex) => (
                                <View key={ex.id} style={styles.exerciseCard}>
                                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        {/* Name / Sets / Reps Display */}
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            {isEditingMode ? (
                                                <View style={{ gap: 6, marginBottom: 8 }}>
                                                    <TextInput style={[styles.inlineInput, { fontSize: 18, fontWeight: 'bold' }]} placeholder="שם תרגיל" value={ex.name} onChangeText={(t) => handleUpdateField(ex.originalIndex, 'name', t)} />
                                                    <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                                                        <TextInput style={[styles.inlineInput, { flex: 1 }]} placeholder="סטים" keyboardType="decimal-pad" value={ex.sets} onChangeText={(t) => handleUpdateField(ex.originalIndex, 'sets', t)} />
                                                        <TextInput style={[styles.inlineInput, { flex: 1 }]} placeholder="חזרות" keyboardType="decimal-pad" value={ex.reps} onChangeText={(t) => handleUpdateField(ex.originalIndex, 'reps', t)} />
                                                    </View>
                                                </View>
                                            ) : (
                                                <View>
                                                    <Text style={styles.exName}>{ex.name}</Text>
                                                    <Text style={styles.exDetails}>סטים: {ex.sets} | חזרות: {ex.reps}</Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Status & Weight Block (Reversed Order) */}
                                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                                            <View style={{ width: 110 }}>
                                                {!isEditingMode && <Text style={styles.weightLabel}>משקל:</Text>}
                                                <TextInput 
                                                    style={[styles.inlineInput, { textAlign: 'center', height: 44, marginBottom: 0, fontSize: 16 }]} 
                                                    placeholder="-"
                                                    value={ex.weight}
                                                    onChangeText={(t) => handleUpdateField(ex.originalIndex, 'weight', t)}
                                                />
                                            </View>
                                            {!isEditingMode && renderStatusBox(ex.status as string | undefined, () => setStatusModalExIndex(ex.originalIndex))}
                                        </View>
                                    </View>
                                    
                                    {/* Notes Field */}
                                    {(!isEditingMode && !ex.notes) ? (
                                        <TextInput 
                                            style={[styles.notesInput, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }]}
                                            placeholder="הערות"
                                            placeholderTextColor="#94a3b8"
                                            value=""
                                            onChangeText={(t) => handleUpdateField(ex.originalIndex, 'notes', t)}
                                        />
                                    ) : (
                                        <TextInput 
                                            style={styles.notesInput}
                                            placeholder="הערות"
                                            placeholderTextColor="#94a3b8"
                                            value={ex.notes || ''}
                                            onChangeText={(t) => handleUpdateField(ex.originalIndex, 'notes', t)}
                                        />
                                    )}

                                    {/* Structural Destroy Block */}
                                    {isEditingMode && (
                                        <TouchableOpacity onPress={() => handleRemoveExercise(ex.originalIndex)} style={styles.deleteBtn}>
                                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                            <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>מחק</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            {isEditingMode && (
                                <TouchableOpacity style={styles.addBtn} onPress={() => handleAddExercise(groupName)}>
                                    <Ionicons name="add" size={18} color="#3b82f6" />
                                    <Text style={styles.addBtnText}>הוסף תרגיל ל-"{groupName}"</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}

                    {isEditingMode && (
                        <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, marginBottom: 40 }]} onPress={handleAddGroup}>
                            <Ionicons name="albums-outline" size={18} color="#3b82f6" />
                            <Text style={styles.addBtnText}>הוסף קבוצת שרירים</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Mini Drawer for Status Selection */}
            <Modal visible={statusModalExIndex !== null} transparent animationType="fade">
                <TouchableOpacity style={styles.statusModalOverlay} activeOpacity={1} onPress={() => setStatusModalExIndex(null)}>
                    <View style={styles.statusModalContent}>
                        <Text style={styles.statusModalTitle}>איך היה המשקל?</Text>
                        <TouchableOpacity style={styles.statusOption} onPress={() => handleUpdateStatus('easy')}>
                            <Text style={styles.statusEmoji}>💪</Text>
                            <Text style={[styles.statusText, { color: '#22c55e' }]}>קל מדי</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statusOption} onPress={() => handleUpdateStatus('good')}>
                            <Text style={styles.statusEmoji}>🔥</Text>
                            <Text style={[styles.statusText, { color: '#eab308' }]}>משקל טוב</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.statusOption} onPress={() => handleUpdateStatus('hard')}>
                            <Text style={styles.statusEmoji}>😫</Text>
                            <Text style={[styles.statusText, { color: '#ef4444' }]}>קשה מדי</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.statusOption, { borderBottomWidth: 0, justifyContent: 'center' }]} onPress={() => handleUpdateStatus(null)}>
                            <Text style={[styles.statusText, { color: '#64748b', textAlign: 'center' }]}>ניקוי סטטוס</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            {/* Finished: confirm saving the workout */}
            <Modal visible={finishVisible} transparent animationType="fade" onRequestClose={() => setFinishVisible(false)}>
                <View style={styles.finishOverlay}>
                    <View style={styles.finishCard}>
                        <Text style={styles.finishTitle}>לשמור את האימון?</Text>
                        <Text style={styles.finishSub}>{template.name}</Text>
                        <Text style={styles.finishLabel}>משך האימון (דקות)</Text>
                        <TextInput
                            style={styles.finishInput}
                            value={finishMinutes}
                            onChangeText={setFinishMinutes}
                            keyboardType="decimal-pad"
                        />
                        {elapsedSec > 4 * 3600 && (
                            <Text style={styles.finishWarn}>הטיימר רץ יותר מ-4 שעות – אולי שכחת לעצור? אפשר לתקן את הדקות.</Text>
                        )}
                        {finishPreview && (
                            <Text style={styles.finishPreview}>כ-{finishPreview.kcal} קק"ל · {finishPreview.explanation}</Text>
                        )}
                        <TouchableOpacity style={[styles.finishSave, (!(finishMinutesNum > 0) || savingWorkout) && { opacity: 0.5 }]} disabled={!(finishMinutesNum > 0) || savingWorkout} onPress={saveFinishedWorkout}>
                            {savingWorkout ? <ActivityIndicator color="#fff" /> : <Text style={styles.finishSaveText}>שמור אימון</Text>}
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 12 }}>
                            <TouchableOpacity onPress={() => setFinishVisible(false)} disabled={savingWorkout}>
                                <Text style={styles.finishLink}>המשך אימון</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={async () => { await clearTimer(); setFinishVisible(false); }} disabled={savingWorkout}>
                                <Text style={[styles.finishLink, { color: '#ef4444' }]}>סגור בלי לשמור</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    timerBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexWrap: 'wrap' },
    startBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#10b981', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
    finishBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#ef4444', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
    timerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    timerHint: { fontSize: 12, color: '#64748b', textAlign: 'center', flexBasis: '100%' },
    timerLabel: { fontSize: 11, color: '#64748b' },
    timerValue: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', fontVariant: ['tabular-nums'] },
    cancelTimerText: { color: '#64748b', fontSize: 14, textDecorationLine: 'underline' },
    finishOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
    finishCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22 },
    finishTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
    finishSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 4, marginBottom: 16 },
    finishLabel: { fontSize: 14, fontWeight: '600', color: '#475569', textAlign: 'right', marginBottom: 6 },
    finishInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 20, textAlign: 'center', color: '#1e293b' },
    finishWarn: { fontSize: 13, color: '#b45309', textAlign: 'right', marginTop: 8 },
    finishPreview: { fontSize: 13, color: '#334155', textAlign: 'right', marginTop: 12, lineHeight: 19 },
    finishSave: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 16 },
    finishSaveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    finishLink: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
    safeArea: { flex: 1, backgroundColor: '#f1f5f9', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', flex: 1, textAlign: 'center' },
    iconButton: { padding: 4, alignItems: 'center', width: 40 },
    iconButtonRight: { flexDirection: 'row', alignItems: 'center', padding: 4 },
    
    saveText: { color: '#22c55e', fontWeight: 'bold', fontSize: 16, padding: 4 },
    cancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16, padding: 4 },

    scrollContent: { padding: 16, gap: 24, paddingBottom: 60 },
    
    groupContainer: { marginBottom: 12 },
    groupHeaderTitle: { fontSize: 26, fontWeight: '900', color: '#1e293b', marginBottom: 16, textAlign: 'center' },
    groupHeaderInput: { fontSize: 26, fontWeight: '900', color: '#3b82f6', marginBottom: 16, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: '#bfdbfe', paddingVertical: 4 },

    exerciseCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    
    exName: { fontSize: 20, fontWeight: '800', color: '#1e293b', textAlign: 'right', marginBottom: 6 },
    exDetails: { fontSize: 14, color: '#64748b', textAlign: 'right', fontWeight: '600' },
    
    statusBox: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginTop: 19 },
    weightLabel: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 4, fontWeight: '600' },
    
    inlineInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: '#1e293b', textAlign: 'right' },
    notesInput: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#ffedd5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#9a3412', textAlign: 'right', marginTop: 14 },
    
    deleteBtn: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 12, backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    
    addBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#e0e7ff', padding: 14, borderRadius: 12, justifyContent: 'center', gap: 6 },
    addBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 15 },

    statusModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
    statusModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    statusModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 16 },
    statusOption: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 12 },
    statusEmoji: { fontSize: 24 },
    statusText: { fontSize: 18, fontWeight: 'bold', textAlign: 'right' }
});
