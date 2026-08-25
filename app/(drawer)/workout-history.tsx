import { AlertManager as Alert } from '@/components/GlobalAlert';
import { Workout, deleteWorkout, getAllWorkouts } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { getLogicalDayBounds } from '@/utils/calculators';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, I18nManager, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';;

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';

export default function WorkoutHistoryScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const user = useUserStore((state) => state.user);
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useFocusEffect(
        useCallback(() => {
            loadWorkouts();
        }, [user])
    );

    const loadWorkouts = async () => {
        if (!user) return;
        try {
            const data = await getAllWorkouts();
            setWorkouts(data);
        } catch (e) {
            console.error('Error loading workouts:', e);
        }
    };

    const handleDeleteWorkout = (id: number) => {
        Alert.alert(
            'מחיקת אימון',
            'האם אתה בטוח שברצונך למחוק אימון זה מההיסטוריה?',
            [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteWorkout(id);
                            loadWorkouts();
                            triggerScoreExplanationUpdate(); // Sync globally
                        } catch (e) {
                            console.error('Failed to delete workout:', e);
                            Alert.alert('שגיאה', 'לא הצלחנו למחוק את האימון.');
                        }
                    }
                }
            ]
        );
    };

    const renderWorkout = ({ item }: { item: Workout }) => {
        const isExpanded = expandedId === item.id;
        const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
        const exactTimeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';

        return (
            <TouchableOpacity
                style={styles.workoutCard}
                onPress={() => setExpandedId(isExpanded ? null : item.id!)}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.workoutName}>{item.name}</Text>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                        <Text style={styles.timeText}>{timeStr}</Text>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDeleteWorkout(item.id!); }}>
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statBadge}>
                        <Ionicons name="flame-outline" size={16} color="#ef4444" />
                        <Text style={styles.statText}>{item.calories_burned} קק"ל</Text>
                    </View>
                    <View style={styles.statBadge}>
                        <Ionicons name="time-outline" size={16} color="#3b82f6" />
                        <Text style={styles.statText}>{item.duration_minutes} דקות</Text>
                    </View>
                </View>

                {isExpanded && (
                    <View style={styles.expandedContent}>
                        <View style={styles.expandedDivider} />
                        <Text style={styles.expandedTitle}>פרטי האימון:</Text>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>קלוריות שנשרפו:</Text>
                            <Text style={styles.detailValue}>{item.calories_burned} קק"ל</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>זמן אימון:</Text>
                            <Text style={styles.detailValue}>{item.duration_minutes} דקות</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>תאריך:</Text>
                            <Text style={styles.detailValue}>{timeStr}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>שעה:</Text>
                            <Text style={styles.detailValue}>{exactTimeStr}</Text>
                        </View>

                        {item.description && (
                            <View style={styles.descriptionContainer}>
                                <Text style={styles.detailLabel}>פירוט נוסף:</Text>
                                <Text style={styles.descriptionText}>{item.description}</Text>
                            </View>
                        )}
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
                <Text style={styles.headerTitle}>היסטוריית אימונים</Text>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.backButton}>
                    <Ionicons name="menu" size={32} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <View style={styles.container}>
                {workouts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="fitness-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>טרם נרשמו אימונים</Text>
                        <Text style={styles.emptyDesc}>כאן יופיעו פרטי כלל הפעילויות הגופניות שלך לאורך הזמן.</Text>

                        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/add-workout' as any)}>
                            <Ionicons name="add" size={20} color="#fff" />
                            <Text style={styles.addButtonText}>הוסף אימון חדש</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={workouts}
                        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                        renderItem={renderWorkout}
                        contentContainerStyle={styles.listContent}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    container: { flex: 1 },
    listContent: { padding: 16, gap: 12 },

    workoutCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
    cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    workoutName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    timeText: { fontSize: 14, color: '#64748b' },

    statsRow: { flexDirection: 'row-reverse', gap: 12 },
    statBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    statText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 16, marginBottom: 8, textAlign: 'center' },
    emptyDesc: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
    addButton: { flexDirection: 'row-reverse', backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', gap: 8 },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    expandedContent: { marginTop: 16 },
    expandedDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
    expandedTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12, textAlign: 'right' },
    detailRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 14, color: '#64748b', fontWeight: '500', textAlign: 'right' },
    detailValue: { fontSize: 14, color: '#1e293b', fontWeight: 'bold' },
    descriptionContainer: { marginTop: 8, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
    descriptionText: { fontSize: 14, color: '#334155', marginTop: 4, textAlign: 'right', lineHeight: 20 },
});
