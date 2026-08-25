import { Meal, deleteMeal, getLogicalDayMeals } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { getLogicalDayBounds } from '@/utils/calculators';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, I18nManager, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';

export default function DailyLogScreen() {
    const router = useRouter();
    const [meals, setMeals] = useState<Meal[]>([]);
    const user = useUserStore(state => state.user);

    useFocusEffect(
        useCallback(() => {
            loadLogs();
        }, [user])
    );

    const loadLogs = async () => {
        try {
            if (!user) return;
            const { start, end } = getLogicalDayBounds(user.resetTime || '00:00');
            const logs = await getLogicalDayMeals(start, end);
            setMeals(logs);
        } catch (e) {
            console.error('Error loading logs', e);
        }
    };

    const handleDelete = (id?: number) => {
        if (!id) return;
        if (Platform.OS === 'web') {
            if (window.confirm('האם אתה בטוח שברצונך למחוק מנה זו?')) {
                setMeals(prev => prev.filter(m => m.id !== id));
                deleteMeal(id).then(() => {
                    loadLogs();
                    triggerScoreExplanationUpdate();
                }).catch(async (e) => {
                    console.error('Failed to delete meal', e);
                    window.alert('שגיאה: לא ניתן למחוק את הארוחה.');
                    await loadLogs();
                });
            }
        } else {
            Alert.alert('מחיקת ארוחה', 'האם אתה בטוח שברצונך למחוק מנה זו?', [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: async () => {
                        // Instantly update UI for immediate feedback
                        setMeals(prev => prev.filter(m => m.id !== id));

                        try {
                            await deleteMeal(id);
                            await loadLogs();
                            triggerScoreExplanationUpdate(); // Sync globally
                        } catch (e) {
                            console.error('Failed to delete meal', e);
                            Alert.alert('שגיאה', 'לא ניתן למחוק את הארוחה.');
                            await loadLogs(); // Revert on failure
                        }
                    }
                }
            ]);
        }
    };

    const totalCals = meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#1e293b" style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
                </TouchableOpacity>

                <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' }}>
                    <Text style={styles.headerTitle}>יומן ארוחות להיום</Text>
                </View>

                <View style={{ width: 36 }} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>סיכום יומי</Text>
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryValue}>{totalCals}</Text>
                            <Text style={styles.summaryLabel}>קק"ל</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: '#10b981' }]}>{totalProtein}g</Text>
                            <Text style={styles.summaryLabel}>חלבון</Text>
                        </View>
                    </View>
                </View>

                {meals.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="fast-food-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyStateText}>עוד לא הוספת ארוחות היום.</Text>
                    </View>
                ) : (
                    <View style={styles.timeline}>
                        {meals.map((meal, index) => {
                            const timeStr = meal.timestamp ? new Date(meal.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
                            return (
                                <View key={meal.id || index} style={styles.timelineItem}>
                                    <View style={styles.timeColumn}>
                                        <Text style={styles.timeText}>{timeStr}</Text>
                                        <View style={styles.timelineLine} />
                                    </View>
                                    <View style={styles.mealCard}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.mealName}>{meal.name}</Text>
                                            <View style={styles.mealMacros}>
                                                <Text style={styles.macroText}>{meal.calories} קק"ל</Text>
                                                <Text style={styles.macroSeparator}>•</Text>
                                                <Text style={styles.macroText}>{meal.protein}g חלבון</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => handleDelete(meal.id)} style={styles.deleteButton}>
                                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },

    summaryCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    summaryTitle: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 12, fontWeight: '600' },
    summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center' },
    summaryValue: { fontSize: 28, fontWeight: 'bold', color: '#3b82f6' },
    summaryLabel: { fontSize: 14, color: '#94a3b8', marginTop: 4 },

    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyStateText: { fontSize: 16, color: '#94a3b8', marginTop: 16 },

    timeline: { paddingRight: 8 },
    timelineItem: { flexDirection: 'row-reverse', marginBottom: 20, gap: 16 },
    timeColumn: { width: 60, alignItems: 'center' },
    timeText: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
    timelineLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', borderRadius: 1 },

    mealCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, flexDirection: 'row-reverse', alignItems: 'center' },
    mealName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'right' },
    mealMacros: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
    macroText: { fontSize: 14, color: '#64748b' },
    macroSeparator: { fontSize: 14, color: '#cbd5e1' },
    deleteButton: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 12, marginLeft: 12 }
});
