import { getLogicalDayMeals, getLogicalDayWorkouts, Meal, Workout } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { calculateDailyScore } from '@/utils/dailyScore';
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
    const [loading, setLoading] = useState(true);

    const targetDate = date ? new Date(date) : new Date();

    const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

    const formattedDateTitle = `יום ${DAYS_HE[targetDate.getDay()]}, ${targetDate.getDate()} ב${MONTHS_HE[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

    useEffect(() => {
        async function loadDayData() {
            if (!user?.daily_targets) return;

            try {
                const year = targetDate.getFullYear();
                const month = targetDate.getMonth();
                const d = targetDate.getDate();

                const startOfDay = new Date(year, month, d, 0, 0, 0);
                const endOfDay = new Date(startOfDay.getTime() + (24 * 60 * 60 * 1000));

                const startIso = startOfDay.toISOString();
                const endIso = endOfDay.toISOString();

                const m = await getLogicalDayMeals(startIso, endIso);
                const w = await getLogicalDayWorkouts(startIso, endIso);

                setMeals(m);
                setWorkouts(w);

                // Re-calculate the exact score mathematically
                let calcScore = null;
                if (m.length > 0 || w.length > 0) {
                    calcScore = calculateDailyScore(
                        m, w, user.daily_targets, user.trackedNutrients, user.goal, targetDate.getTime(), user.resetTime
                    );
                }
                setScoreData(calcScore);

                // Fetch AI Explanation from Store if exists
                const dateStr = startIso.split('T')[0];
                if (user.dailyScoreExplanations && user.dailyScoreExplanations[dateStr]) {
                    setAiExplanation(user.dailyScoreExplanations[dateStr]);
                }

            } catch (err) {
                console.error('Error loading daily summary', err);
            } finally {
                setLoading(false);
            }
        }

        loadDayData();
    }, [date, user]);

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
                {aiExplanation && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>סיכום תזונתי (AI)</Text>
                        <Text style={styles.aiText}>{aiExplanation}</Text>
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
