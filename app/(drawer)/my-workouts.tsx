import { AlertManager as Alert } from '@/components/GlobalAlert';
import { addWorkoutTemplate, deleteWorkoutTemplate, getWorkoutTemplates, updateWorkoutTemplate, WorkoutTemplate } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { generateWorkoutSummary } from '@/utils/ai';
import { DISTANCE_TYPES, getFixedDuration, logTemplateWorkout, parseTemplateMeta, WORKOUT_TYPE_LABELS, WORKOUT_TYPES, WorkoutType } from '@/utils/workoutTemplates';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, I18nManager, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';;
import WorkoutForm, { Exercise } from '../../components/WorkoutForm';

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function MyWorkoutsScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const user = useUserStore(state => state.user);

    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    // Filter by the built-in workout type (gym, running, ...)
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | WorkoutType>('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Modals

    const [isTemplateModalVisible, setTemplateModalVisible] = useState(false);

    const [isLogModalVisible, setLogModalVisible] = useState(false);
    const [logDuration, setLogDuration] = useState('');
    const [logTemplate, setLogTemplate] = useState<WorkoutTemplate | null>(null);
    const [logDistance, setLogDistance] = useState('');
    const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);

    const loadData = async () => {
        try {
            const temps = await getWorkoutTemplates();
            setTemplates(temps);
        } catch (e) {
            console.error('Failed to load my workouts', e);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    // Template Actions (create or edit)
    const handleSaveTemplate = async (name: string, flattenedExercises: Exercise[], descriptionStr?: string | null) => {
        setIsGenerating(true);
        try {
            const exercisesJson = JSON.stringify(flattenedExercises);
            if (editingTemplate) {
                // Only ask the AI for a new summary if the exercises themselves changed
                const strip = (json: string | null | undefined) => {
                    try { return JSON.stringify((JSON.parse(json || '[]') as any[]).map(e => [e.muscleGroup, e.name, e.sets, e.reps, e.weight, e.notes || ''])); }
                    catch { return json || ''; }
                };
                const exercisesChanged = strip(exercisesJson) !== strip(editingTemplate.exercises);
                const summary = exercisesChanged ? await generateWorkoutSummary(flattenedExercises) : null;
                await updateWorkoutTemplate(editingTemplate.id!, {
                    name: name.trim(),
                    exercises: exercisesJson,
                    description: descriptionStr || null,
                    ...(summary ? { summary } : {}),
                });
            } else {
                const summary = await generateWorkoutSummary(flattenedExercises);
                await addWorkoutTemplate({
                    name: name.trim(),
                    category_id: null,
                    exercises: exercisesJson,
                    summary: summary || 'אימון שהוקם על ידי המשתמש',
                    description: descriptionStr || null
                });
            }
            setTemplateModalVisible(false);
            setEditingTemplate(null);
            loadData();
        } catch (e) {
            Alert.alert('שגיאה', 'אירעה שגיאה בשמירת האימון.');
        } finally {
            setIsGenerating(false);
        }
    };

    const openEditTemplate = (template: WorkoutTemplate) => {
        setEditingTemplate(template);
        setTemplateModalVisible(true);
    };

    const handleDeleteTemplate = (id: number) => {
        Alert.alert('מחיקת אימון', 'האם למחוק אימון זה?', [
            { text: 'ביטול', style: 'cancel' },
            { text: 'מחק', style: 'destructive', onPress: async () => { await deleteWorkoutTemplate(id); loadData(); } }
        ]);
    };
    const executeLogWorkout = async (durationMinutes: number, template: WorkoutTemplate, distanceText?: string) => {
        if (!user) return;
        setIsGenerating(true);
        try {
            const { calBurned, summary } = await logTemplateWorkout({
                user,
                template,
                durationMinutes,
                distanceText: distanceText || null,
            });

            setLogModalVisible(false);
            setLogDuration('');
            setLogDistance('');
            loadData();

            Alert.alert('אימון נרשם בהצלחה!', `שרפת כ-${calBurned} קלוריות.${summary ? `\n\n${summary}` : ''}`);
        } catch (e) {
            Alert.alert('שגיאה', 'אירעה שגיאה. נסה שוב.');
        } finally {
            setIsGenerating(false);
        }
    };

    const startLogWorkout = (template: WorkoutTemplate) => {
        const meta = parseTemplateMeta(template);
        const fixed = getFixedDuration(meta);
        const needsDistance = DISTANCE_TYPES.includes(meta.type) && !meta.distance;
        if (fixed && !needsDistance) {
            executeLogWorkout(fixed, template, meta.distance);
            return;
        }
        setLogTemplate(template);
        setLogDuration(fixed ? String(fixed) : '');
        setLogDistance(meta.distance || '');
        setLogModalVisible(true);
    };

    const logMeta = logTemplate ? parseTemplateMeta(logTemplate) : null;
    const logFixedDuration = logMeta ? getFixedDuration(logMeta) : null;
    const logUsesDistance = logMeta ? DISTANCE_TYPES.includes(logMeta.type) : false;

    const handleLogWorkout = async () => {
        if (!logTemplate) return;
        const dur = logFixedDuration ?? Number(logDuration);
        if (!dur || isNaN(dur) || dur <= 0) { Alert.alert('שגיאה', 'הזן משך אימון'); return; }
        await executeLogWorkout(dur, logTemplate, logDistance.trim());
    };

    const toggleFilters = () => {
        if (showFilters) { setSelectedTypeFilter('all'); setShowFilters(false); } 
        else { setShowFilters(true); }
    };

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = selectedTypeFilter === 'all' || parseTemplateMeta(t).type === selectedTypeFilter;
        return matchesSearch && matchesType;
    });

    const renderTemplate = ({ item }: { item: WorkoutTemplate }) => {
        const isExpanded = expandedId === item.id;
        const lastPerformedStr = item.last_performed_date ? new Date(item.last_performed_date).toLocaleDateString('he-IL') : 'טרם בוצע';
        const meta = parseTemplateMeta(item);
        const fixedDuration = getFixedDuration(meta);
        const isGym = meta.type === 'gym';

        return (
            <TouchableOpacity style={styles.card} onPress={() => setExpandedId(isExpanded ? null : item.id!)} activeOpacity={0.8}>
                <View style={[styles.cardHeader, { flexDirection: 'row-reverse' }]}>
                    <View style={styles.cardHeaderCenter}>
                        <Text style={styles.templateName}>{item.name}</Text>
                        <Text style={styles.templateCategory}>
                            {WORKOUT_TYPE_LABELS[meta.type]}
                            {fixedDuration ? ` · ${fixedDuration} דק'` : ''}
                            {meta.distance && DISTANCE_TYPES.includes(meta.type) ? ` · ${meta.distance}` : ''}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); openEditTemplate(item); }} style={{ padding: 4 }}>
                            <Ionicons name="create-outline" size={20} color="#3b82f6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDeleteTemplate(item.id!); }} style={{ padding: 4 }}>
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {isExpanded && (
                    <View style={styles.expandedContent}>
                        <View style={styles.expandedDivider} />
                        
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>בוצע לאחרונה:</Text>
                            <Text style={styles.detailValue}>{lastPerformedStr}</Text>
                        </View>
                        
                        {(item.summary || item.description) && (
                            <View style={styles.descContainer}>
                                <Text style={styles.descText}>{item.summary || item.description}</Text>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row-reverse', gap: 12, marginTop: 16 }}>
                            <TouchableOpacity style={[styles.actionBtnPrimary, { flex: 1, justifyContent: 'center' }]} disabled={isGenerating} onPress={() => startLogWorkout(item)}>
                                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                                <Text style={styles.actionBtnTextPrimary}>רשום אימון</Text>
                            </TouchableOpacity>
                            {/* Live tracking (sets / reps / weights) only makes sense for gym workouts */}
                            {isGym && (
                                <TouchableOpacity style={[styles.actionBtnSecondary, { flex: 1, justifyContent: 'center' }]} onPress={() => router.push({ pathname: '/workout-tracking' as any, params: { id: item.id } })}>
                                    <Ionicons name="analytics-outline" size={18} color="#3b82f6" />
                                    <Text style={styles.actionBtnTextSecondary}>מעקב</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>האימונים שלי</Text>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.backButton}>
                    <Ionicons name="menu" size={32} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => { setEditingTemplate(null); setTemplateModalVisible(true); }}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.actionBtnTextPrimary}>צור אימון</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                    <TextInput style={styles.searchInput} placeholder="חיפוש אימון..." value={searchQuery} onChangeText={setSearchQuery} />
                </View>
                <TouchableOpacity style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]} onPress={toggleFilters}>
                    <Ionicons name="filter-outline" size={20} color={showFilters ? '#fff' : '#3b82f6'} />
                    <Text style={[styles.filterToggleText, showFilters && styles.filterToggleTextActive]}>סינון</Text>
                </TouchableOpacity>
            </View>

            {showFilters && (
                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        <TouchableOpacity style={[styles.filterChip, selectedTypeFilter === 'all' && styles.filterChipActive]} onPress={() => setSelectedTypeFilter('all')}>
                            <Text style={[styles.filterChipText, selectedTypeFilter === 'all' && styles.filterChipTextActive]}>הכל</Text>
                        </TouchableOpacity>
                        {WORKOUT_TYPES.map(t => (
                            <TouchableOpacity key={t.id} style={[styles.filterChip, selectedTypeFilter === t.id && styles.filterChipActive]} onPress={() => setSelectedTypeFilter(t.id)}>
                                <Text style={[styles.filterChipText, selectedTypeFilter === t.id && styles.filterChipTextActive]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {filteredTemplates.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="barbell-outline" size={64} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>לא נמצאו אימונים</Text>
                    <Text style={styles.emptyDesc}>לחץ על "צור אימון" כדי לבנות את הספרייה שלך.</Text>
                </View>
            ) : (
                <FlatList data={filteredTemplates} keyExtractor={item => item.id!.toString()} renderItem={renderTemplate} contentContainerStyle={styles.listContent} />
            )}

            <WorkoutForm 
                visible={isTemplateModalVisible} 
                isGenerating={isGenerating}
                onClose={() => { setTemplateModalVisible(false); setEditingTemplate(null); }}
                onSave={handleSaveTemplate}
                initialTemplate={editingTemplate}
            />

            {/* Modal: Log Workout */}
            <Modal visible={isLogModalVisible} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>רישום אימון "{logTemplate?.name}"</Text>
                        {logFixedDuration ? (
                            <Text style={styles.inputLabel}>זמן קבוע: {logFixedDuration} דקות</Text>
                        ) : (
                            <>
                                <Text style={styles.inputLabel}>כמה זמן לקח האימון בדקות?</Text>
                                <TextInput style={styles.modalInput} keyboardType="decimal-pad" placeholder="למשל: 45" value={logDuration} onChangeText={setLogDuration} autoFocus />
                            </>
                        )}
                        {logUsesDistance && (
                            <>
                                <Text style={styles.inputLabel}>מה היה המרחק?</Text>
                                <TextInput style={styles.modalInput} placeholder='למשל: 5 ק"מ או 800 מטר' value={logDistance} onChangeText={setLogDistance} />
                            </>
                        )}
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => !isGenerating && setLogModalVisible(false)}><Text style={styles.modalCancelText}>ביטול</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.modalSubmit} onPress={handleLogWorkout} disabled={isGenerating}>
                                {isGenerating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>רשום</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },

    actionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff' },
    actionBtnPrimary: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
    actionBtnTextPrimary: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    actionBtnSecondary: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
    actionBtnTextSecondary: { color: '#3b82f6', fontWeight: 'bold', fontSize: 15 },

    searchRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
    searchContainer: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    searchIcon: { marginLeft: 8 },
    searchInput: { flex: 1, height: 44, textAlign: 'right', fontSize: 15, color: '#1e293b' },

    filterToggleBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 16, height: 44, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    filterToggleBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    filterToggleText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },
    filterToggleTextActive: { color: '#fff' },

    filterContainer: { backgroundColor: '#fff', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    filterScroll: { paddingHorizontal: 16, gap: 8, flexDirection: 'row-reverse' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    filterChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    filterChipText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
    filterChipTextActive: { color: '#fff' },

    listContent: { padding: 16, gap: 12 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardHeaderCenter: { flex: 1 },
    templateName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    templateCategory: { fontSize: 13, color: '#3b82f6', marginTop: 4, textAlign: 'right', fontWeight: '600' },

    expandedContent: { marginTop: 16 },
    expandedDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
    detailRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 14, color: '#64748b', fontWeight: '500', textAlign: 'right' },
    detailValue: { fontSize: 14, color: '#1e293b', fontWeight: 'bold' },
    descContainer: { marginTop: 8, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
    descText: { fontSize: 14, color: '#334155', marginTop: 4, textAlign: 'right', lineHeight: 20 },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 16, marginBottom: 8, textAlign: 'center' },
    emptyDesc: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 24 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    modalContentLarge: { backgroundColor: '#fff', borderRadius: 20, padding: 24, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 16, textAlign: 'right' },
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, textAlign: 'right' },
    modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16, textAlign: 'right', marginBottom: 16, color: '#1e293b' },
    inlineInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'right', marginBottom: 8, color: '#1e293b' },

    modalActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
    modalCancel: { flex: 1, padding: 14, alignItems: 'center' },
    modalCancelText: { color: '#64748b', fontWeight: 'bold', fontSize: 16 },
    modalSubmit: { flex: 1, backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, alignItems: 'center' },
    modalSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    fullSubmitBtn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
    fullSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
