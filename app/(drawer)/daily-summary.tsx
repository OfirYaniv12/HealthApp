import { Meal, Workout } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { getLogicalDayKey } from '@/utils/calculators';
import { getFinalDaySummary } from '@/utils/scoreUpdater';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function DailySummaryScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { date } = useLocalSearchParams<{ date: string }>();
    const { user } = useUserStore();

    const [meals, setMeals] = useState<Meal[]>([]);
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [scoreData, setScoreData] = useState<any>(null);
    const [aiExplanation, setAiExplanation] = useState<string | null>(null);
    const [explanationLoading, setExplanationLoading] = useState(false);
    const [loading, setLoading] = useState(true);

    // The calendar passes the logical day as YYYY-MM-DD (older links passed a full ISO date)
    const dayKey = date
        ? (/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getLogicalDayKey(new Date(date), user?.resetTime))
        : getLogicalDayKey(new Date(), user?.resetTime);
    const [ky, km, kd] = dayKey.split('-').map(Number);
    const targetDate = new Date(ky, km - 1, kd, 12);

    const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

    const formattedDateTitle = `יום ${DAYS_HE[targetDate.getDay()]}, ${targetDate.getDate()} ב${MONTHS_HE[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

    useEffect(() => {
        let cancelled = false;
        async function loadDayData() {
            if (!user?.daily_targets) return;
            setLoading(true);
            setAiExplanation(null);

            try {
                // Final state of the day as it stood at the day-reset time (no AI call yet: fast)
                const summary = await getFinalDaySummary(dayKey);
                if (!summary || cancelled) return;
                setMeals(summary.meals as Meal[]);
                setWorkouts(summary.workouts as Workout[]);
                const hasData = summary.meals.length > 0 || summary.workouts.length > 0;
                setScoreData(hasData ? summary.score : null);
                setAiExplanation(summary.explanation);
                setLoading(false);

                // If there is no final AI summary for this day yet (or the data changed), write one now
                if (hasData && !summary.explanation) {
                    setExplanationLoading(true);
                    const withAi = await getFinalDaySummary(dayKey, { generateExplanation: true });
                    if (!cancelled && withAi?.explanation) setAiExplanation(withAi.explanation);
                }
            } catch (err) {
                console.error('Error loading daily summary', err);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setExplanationLoading(false);
                }
            }
        }

        loadDayData();
        return () => { cancelled = true; };
    }, [dayKey, user?.daily_targets, user?.resetTime]);

    const getScoreColor = (s: number) => {
        if (s >= 7) return '#10b981'; // Green
        if (s >= 4) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            </SafeAreaView>
        );
    }

    const consumedCals = meals.reduce((sum, m) => sum + m.calories, 0);
    const consumedPro = meals.reduce((sum, m) => sum + m.protein, 0);
    const consumedCarb = meals.reduce((sum, m) => sum + m.carbs, 0);
    const consumedFat = meals.reduce((sum, m) => sum + m.fat, 0);
    const consumedFiber = meals.reduce((sum, m) => sum + (m.fiber || 0), 0);
    const consumedSodium = meals.reduce((sum, m) => sum + (m.sodium || 0), 0);
    const consumedSugar = meals.reduce((sum, m) => sum + (m.sugar || 0), 0);

    const trackedMacros = [
        { label: 'קלוריות', value: Math.round(consumedCals) },
        { label: 'חלבון', value: Math.round(consumedPro) + 'g' },
        { label: 'פחמימה', value: Math.round(consumedCarb) + 'g' },
        { label: 'שומן', value: Math.round(consumedFat) + 'g' },
        { label: 'סיבים', value: Math.round(consumedFiber) + 'g' },
        { label: 'נתרן', value: Math.round(consumedSodium) + 'mg' },
        { label: 'סוכר', value: Math.round(consumedSugar) + 'g' }
    ];

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/(drawer)/calendar')} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{formattedDateTitle}</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>

                {/* Score Header Card */}
                {scoreData ? (
                    <View style={styles.scoreHeaderCard}>
                        <Text style={styles.sectionTitleCenter}>ציון יום סופי</Text>
                        <View style={[styles.mainScoreCircle, { backgroundColor: getScoreColor(scoreData.totalScore) }]}>
                            <Text style={styles.mainScoreText}>{scoreData.totalScore.toFixed(1)}</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.scoreHeaderCard}>
                        <Text style={styles.sectionTitleCenter}>אין נתונים</Text>
                        <Text style={styles.emptyText}>לא הוזנו ארוחות או אימונים ביום זה.</Text>
                    </View>
                )}

                {/* AI Explanation Card */}
                {(aiExplanation || explanationLoading) && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>סיכום היום (AI)</Text>
                        {aiExplanation
                            ? <Text style={styles.aiText}>{aiExplanation}</Text>
                            : (
                                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                                    <ActivityIndicator size="small" color="#3b82f6" />
                                    <Text style={styles.aiText}>כותב סיכום סופי ליום...</Text>
                                </View>
                            )}
                    </View>
                )}

                {/* Macro Conclusion Array */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>סיכום ערכים</Text>
                    <View style={styles.macroRow}>
                        {trackedMacros.map((mac, idx) => (
                            <View key={idx} style={styles.macroBox}>
                                <Text style={styles.macroValue}>{mac.value}</Text>
                                <Text style={styles.macroLabel}>{mac.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Meals Log */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>יומן ארוחות</Text>
                    {meals.length > 0 ? meals.map((m, i) => (
                        <View key={i} style={styles.logItem}>
                            <View>
                                <Text style={styles.logName}>{m.name}</Text>
                                <Text style={styles.logDetails}>{Math.round(m.calories)} קק"ל | {Math.round(m.protein)}g חלבון</Text>
                            </View>
                            <Text style={styles.logTime}>
                                {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </Text>
                        </View>
                    )) : (
                        <Text style={styles.emptyText}>לא תועדו ארוחות.</Text>
                    )}
                </View>

                {/* Steps of this day (only when steps tracking is on and data arrived) */}
                {typeof scoreData?.steps === 'number' && scoreData?.stepsGoal ? (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>צעדים</Text>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={styles.logName}>{scoreData.steps.toLocaleString('he-IL')} צעדים</Text>
                            <Text style={styles.logDetails}>
                                יעד {scoreData.stepsGoal.toLocaleString('he-IL')} · {Math.round((scoreData.steps / scoreData.stepsGoal) * 100)}%
                                {scoreData.steps >= scoreData.stepsGoal ? ' 🎉' : ''}
                            </Text>
                        </View>
                    </View>
                ) : null}

                {/* Workouts Log */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>אימונים</Text>
                    {workouts.length > 0 ? workouts.map((w, i) => (
                        <View key={i} style={styles.logItem}>
                            <View>
                                <Text style={styles.logName}>{w.name}</Text>
                                <Text style={styles.logDetails}>{w.duration_minutes} דקות | {Math.round(w.calories_burned)} קק"ל</Text>
                            </View>
                            <Text style={styles.logTime}>
                                {w.timestamp ? new Date(w.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </Text>
                        </View>
                    )) : (
                        <Text style={styles.emptyText}>לא תועדו אימונים.</Text>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    container: { flex: 1 },
    content: { padding: 16, paddingBottom: 60, gap: 16 },

    scoreHeaderCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    sectionTitleCenter: { fontSize: 18, fontWeight: 'bold', color: '#64748b', marginBottom: 16 },
    mainScoreCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
    mainScoreText: { fontSize: 42, fontWeight: 'bold', color: '#fff' },

    card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 16 },
    aiText: { fontSize: 15, color: '#334155', lineHeight: 24, textAlign: 'right' },
    emptyText: { fontSize: 15, color: '#94a3b8', textAlign: 'right', fontStyle: 'italic' },

    macroRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, gap: 12 },
    macroBox: { alignItems: 'center', width: '22%', marginBottom: 8 },
    macroValue: { fontSize: 16, fontWeight: 'bold', color: '#3b82f6' },
    macroLabel: { fontSize: 13, color: '#64748b', marginTop: 4 },

    logItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    logName: { fontSize: 16, fontWeight: '600', color: '#1e293b', textAlign: 'right' },
    logDetails: { fontSize: 13, color: '#64748b', textAlign: 'right', marginTop: 4 },
    logTime: { fontSize: 13, color: '#94a3b8', fontWeight: '500' }
});
