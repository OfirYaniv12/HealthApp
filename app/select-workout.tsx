import { AlertManager as Alert } from '@/components/GlobalAlert';
import { getWorkoutTemplates, WorkoutTemplate } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { DISTANCE_TYPES, getFixedDuration, logTemplateWorkout, parseTemplateMeta, WORKOUT_TYPE_LABELS, WORKOUT_TYPES, WorkoutType } from '@/utils/workoutTemplates';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, I18nManager, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';;

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function SelectWorkoutModal() {
    const router = useRouter();
    const user = useUserStore(state => state.user);

    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | WorkoutType>('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const [isDurationModalVisible, setDurationModalVisible] = useState(false);
    const [durationInput, setDurationInput] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const [distanceInput, setDistanceInput] = useState('');
    const [selectedTemplateForLog, setSelectedTemplateForLog] = useState<WorkoutTemplate | null>(null);
    const [isProcessingLog, setIsProcessingLog] = useState(false);

    const loadData = async () => {
        try {
            const temps = await getWorkoutTemplates();
            setTemplates(temps);
        } catch (e) {
            console.error('Failed to load my workouts modal', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const selectedMeta = selectedTemplateForLog ? parseTemplateMeta(selectedTemplateForLog) : null;
    const selectedFixedDuration = selectedMeta ? getFixedDuration(selectedMeta) : null;
    const selectedUsesDistance = selectedMeta ? DISTANCE_TYPES.includes(selectedMeta.type) : false;

    const handleSelectForLog = (template: WorkoutTemplate) => {
        const meta = parseTemplateMeta(template);
        const fixed = getFixedDuration(meta);
        const needsDistance = DISTANCE_TYPES.includes(meta.type) && !meta.distance;

        // Fixed-duration workout with everything already known: log it right away, like in "My Workouts"
        if (fixed && !needsDistance) {
            executeLogWorkout(fixed, template, meta.distance, '');
            return;
        }

        setSelectedTemplateForLog(template);
        setDurationInput(fixed ? String(fixed) : '');
        setDistanceInput(meta.distance || '');
        setNotesInput('');
        setDurationModalVisible(true);
    };

    const executeLogWorkout = async (durationMinutes: number, template: WorkoutTemplate, distanceText?: string, customNotes?: string) => {
        if (!user) return;
        setIsProcessingLog(true);
        try {
            const { calBurned, summary } = await logTemplateWorkout({
                user,
                template,
                durationMinutes,
                distanceText: distanceText || null,
                notes: customNotes || null,
            });

            setDurationModalVisible(false);
            setDurationInput('');
            setDistanceInput('');
            setNotesInput('');

            Alert.alert('אימון נרשם בהצלחה!', `שרפת כ-${calBurned} קלוריות.${summary ? `\n\n${summary}` : ''}`, [
                { text: 'אישור', onPress: () => router.replace('/(drawer)/workout-history') }
            ]);
        } catch (e) {
            Alert.alert('שגיאה', 'ארעה שגיאה בעת רישום האימון.');
        } finally {
            setIsProcessingLog(false);
        }
    };

    const handleConfirmLog = async () => {
        if (!user || !selectedTemplateForLog) return;
        const dur = selectedFixedDuration ?? Number(durationInput);
        if (!dur || isNaN(dur) || dur <= 0) {
            Alert.alert('שגיאה', 'יש להזין משך זמן תקין בדקות.');
            return;
        }
        await executeLogWorkout(dur, selectedTemplateForLog, distanceInput.trim(), notesInput.trim());
    };

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = selectedTypeFilter === 'all' || parseTemplateMeta(t).type === selectedTypeFilter;
        return matchesSearch && matchesType;
    });

    const renderTemplate = ({ item }: { item: WorkoutTemplate }) => {
        const isExpanded = expandedId === item.id;
        const lastPerformedStr = item.last_performed_date ? new Date(item.last_performed_date).toLocaleDateString('he-IL') : 'טרם בוצע';

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => setExpandedId(isExpanded ? null : item.id!)}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.templateName}>{item.name}</Text>
                        <Text style={styles.templateCategory}>{WORKOUT_TYPE_LABELS[parseTemplateMeta(item).type]}</Text>
                    </View>
                    <TouchableOpacity style={styles.selectBtn} onPress={(e) => { e.stopPropagation(); handleSelectForLog(item); }}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.selectBtnText}>בחר אימון</Text>
                    </TouchableOpacity>
                </View>

                {isExpanded && (
                    <View style={styles.expandedContent}>
                        <View style={styles.expandedDivider} />
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>בוצע לאחרונה:</Text>
                            <Text style={styles.detailValue}>{lastPerformedStr}</Text>
                        </View>
                        {item.description && (
                            <View style={styles.descContainer}>
                                <Text style={styles.detailLabel}>פירוט הוצאה / תרגילים:</Text>
                                <Text style={styles.descText}>{item.description}</Text>
                            </View>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.modalBackground}>
            <View style={styles.mainContainer}>

                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>בחירת אימון לתדרוך</Text>
                    <View style={{ width: 28 }} />
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="חיפוש אימון..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        <TouchableOpacity
                            style={[styles.filterChip, selectedTypeFilter === 'all' && styles.filterChipActive]}
                            onPress={() => setSelectedTypeFilter('all')}
                        >
                            <Text style={[styles.filterChipText, selectedTypeFilter === 'all' && styles.filterChipTextActive]}>הכל</Text>
                        </TouchableOpacity>
                        {WORKOUT_TYPES.map(t => (
                            <TouchableOpacity
                                key={t.id}
                                style={[styles.filterChip, selectedTypeFilter === t.id && styles.filterChipActive]}
                                onPress={() => setSelectedTypeFilter(t.id)}
                            >
                                <Text style={[styles.filterChipText, selectedTypeFilter === t.id && styles.filterChipTextActive]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {filteredTemplates.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="barbell-outline" size={48} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>לא נמצאו אימונים</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredTemplates}
                        keyExtractor={item => item.id!.toString()}
                        renderItem={renderTemplate}
                        contentContainerStyle={styles.listContent}
                    />
                )}
            </View>

            {/* Modal: Duration & Notes Selection (When Logging) */}
            <Modal visible={isDurationModalVisible} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackgroundNested}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>הגדרות אימון</Text>
                        <Text style={styles.modalSubTitle}>{selectedTemplateForLog?.name}</Text>

                        {selectedFixedDuration ? (
                            <Text style={[styles.inputLabel, { textAlign: 'center' }]}>זמן קבוע: {selectedFixedDuration} דקות</Text>
                        ) : (
                            <>
                                <Text style={styles.inputLabel}>משך זמן אימון (בדקות):</Text>
                                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', marginVertical: 8 }}>
                                    <TextInput
                                        style={[styles.modalInput, { width: 100, textAlign: 'center', fontSize: 20, marginBottom: 0 }]}
                                        placeholder="0"
                                        keyboardType="decimal-pad"
                                        value={durationInput}
                                        onChangeText={setDurationInput}
                                        autoFocus
                                    />
                                    <Text style={{ fontSize: 18, marginRight: 8, color: '#1e293b', fontWeight: 'bold' }}>דקות</Text>
                                </View>
                            </>
                        )}

                        {selectedUsesDistance && (
                            <>
                                <Text style={[styles.inputLabel, { marginTop: 12 }]}>מרחק (ק"מ):</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder='לדוגמה: 5 ק"מ או 800 מטר'
                                    value={distanceInput}
                                    onChangeText={setDistanceInput}
                                />
                            </>
                        )}

                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>פירוט נוסף/הערות (רשות):</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                            placeholder="שינויים באימון היום, זמנים מדויקים..."
                            value={notesInput}
                            onChangeText={setNotesInput}
                            multiline
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setDurationModalVisible(false)} disabled={isProcessingLog}>
                                <Text style={styles.modalCancelText}>ביטול</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSubmit} onPress={handleConfirmLog} disabled={isProcessingLog}>
                                {isProcessingLog ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitText}>שמור אימון</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    modalBackground: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
    modalBackgroundNested: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },

    mainContainer: { backgroundColor: '#f8fafc', height: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },

    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    closeButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },

    searchContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, marginBottom: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    searchIcon: { marginLeft: 8 },
    searchInput: { flex: 1, height: 44, textAlign: 'right', fontSize: 15, color: '#1e293b' },

    filterContainer: { backgroundColor: '#fff', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    filterScroll: { paddingHorizontal: 16, gap: 8, flexDirection: 'row-reverse' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    filterChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    filterChipText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
    filterChipTextActive: { color: '#fff' },

    listContent: { padding: 16, gap: 12 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
    cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    templateName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    templateCategory: { fontSize: 13, color: '#3b82f6', marginTop: 4, textAlign: 'right', fontWeight: '600' },
    selectBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
    selectBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

    expandedContent: { marginTop: 16 },
    expandedDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
    detailRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 14, color: '#64748b', fontWeight: '500', textAlign: 'right' },
    detailValue: { fontSize: 14, color: '#1e293b', fontWeight: 'bold' },
    descContainer: { marginTop: 8, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
    descText: { fontSize: 14, color: '#334155', marginTop: 4, textAlign: 'right', lineHeight: 20 },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginTop: 16, textAlign: 'center' },

    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'right' },
    modalSubTitle: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 16 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, textAlign: 'right' },
    modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16, textAlign: 'right', marginBottom: 16, color: '#1e293b' },

    modalActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
    modalCancel: { flex: 1, padding: 14, alignItems: 'center' },
    modalCancelText: { color: '#64748b', fontWeight: 'bold', fontSize: 16 },
    modalSubmit: { flex: 1, backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, alignItems: 'center' },
    modalSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
