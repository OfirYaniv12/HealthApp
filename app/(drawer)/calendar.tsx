import { getLogicalDayMeals, getLogicalDayWorkouts } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { calculateDailyScore } from '@/utils/dailyScore';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MONTH_NAMES = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export default function CalendarScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { user } = useUserStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [scores, setScores] = useState<Record<number, number>>({});

    // Generate Calendar Grid Data
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const numRows = Math.ceil((firstDay + daysInMonth) / 7);

    useEffect(() => {
        async function loadMonthScores() {
            if (!user?.daily_targets) return;

            const newScores: Record<number, number> = {};
            const today = new Date();
            const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

            const promises = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const cellDate = new Date(year, month, d, 12); // Noon

                // Do not calculate scores for today or future days
                const startOfCellDay = new Date(year, month, d).getTime();
                if (startOfCellDay >= startOfToday) {
                    continue;
                }

                promises.push((async () => {
                    try {
                        const startOfDay = new Date(year, month, d, 0, 0, 0);
                        const endOfDay = new Date(startOfDay.getTime() + (24 * 60 * 60 * 1000));
                        const m = await getLogicalDayMeals(startOfDay.toISOString(), endOfDay.toISOString());
                        const w = await getLogicalDayWorkouts(startOfDay.toISOString(), endOfDay.toISOString());

                        // Only rate days where the user actually tracked activity
                        if (m.length > 0 || w.length > 0) {
                            const scoreData = calculateDailyScore(
                                m,
                                w,
                                user.daily_targets!,
                                user.trackedNutrients,
                                user.goal,
                                cellDate.getTime(),
                                user.resetTime
                            );
                            newScores[d] = scoreData.totalScore;
                        }
                    } catch (err) {
                        console.error('Error loading score for day', d, err);
                    }
                })());
            }

            await Promise.all(promises);
            setScores(newScores);
        }

        loadMonthScores();
    }, [currentDate, user]);

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const getScoreColor = (score: number) => {
        if (score >= 8.0) return '#10b981'; // Green
        if (score >= 5.0) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    };

    const handleDayPress = (d: number) => {
        const clickedDate = new Date(year, month, d, 12);
        router.push({ pathname: '/(drawer)/daily-summary', params: { date: clickedDate.toISOString() } });
    };

    // Render Grid Cells
    const renderGrid = () => {
        const cells = [];

        // Empty cells before the 1st
        for (let i = 0; i < firstDay; i++) {
            cells.push(<View key={`empty-${i}`} style={[styles.cell, { height: `${100 / numRows}%` }]} />);
        }

        // Days of the month
        const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

        for (let d = 1; d <= daysInMonth; d++) {
            const score = scores[d];
            const startOfCellDay = new Date(year, month, d).getTime();
            const isPastDay = startOfCellDay < startOfToday;

            cells.push(
                <TouchableOpacity
                    key={`day-${d}`}
                    style={[styles.cell, { height: `${100 / numRows}%` }]}
                    disabled={!isPastDay}
                    onPress={() => handleDayPress(d)}
                >
                    <Text style={styles.dayText}>{d}</Text>
                    {score !== undefined ? (
                        <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(score) }]}>
                            <Text style={styles.scoreText}>{score.toFixed(1)}</Text>
                        </View>
                    ) : (
                        <View style={styles.placeholderBadge} />
                    )}
                </TouchableOpacity>
            );
        }

        // Empty cells at the end to complete the grid lines
        const remainingCells = (numRows * 7) - (firstDay + daysInMonth);
        for (let i = 0; i < remainingCells; i++) {
            cells.push(<View key={`empty-end-${i}`} style={[styles.cell, { height: `${100 / numRows}%` }]} />);
        }

        return cells;
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>לוח השנה שלי</Text>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.backButton}>
                    <Ionicons name="menu" size={32} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <View style={styles.container}>
                {/* Month Navigation */}
                <View style={styles.monthNav}>
                    <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtnWrapper}>
                        <Text style={styles.navLabel}>{MONTH_NAMES[(month - 1 + 12) % 12]}</Text>
                        <View style={styles.navBtn}>
                            <Ionicons name="arrow-forward" size={24} color="#3b82f6" />
                        </View>
                    </TouchableOpacity>

                    <Text style={styles.monthText}>{`${MONTH_NAMES[month]} ${year}`}</Text>

                    <TouchableOpacity onPress={handleNextMonth} style={styles.navBtnWrapper}>
                        <Text style={styles.navLabel}>{MONTH_NAMES[(month + 1) % 12]}</Text>
                        <View style={styles.navBtn}>
                            <Ionicons name="arrow-back" size={24} color="#3b82f6" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Weekdays Header */}
                <View style={styles.weekdaysRow}>
                    {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map((day, i) => (
                        <Text key={i} style={styles.weekdayText}>{day}</Text>
                    ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.grid}>
                    {renderGrid()}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    container: { flex: 1, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 16 },

    monthNav: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 20, marginHorizontal: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    navBtnWrapper: { alignItems: 'center', gap: 4 },
    navLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    navBtn: { padding: 6, backgroundColor: '#eff6ff', borderRadius: 8 },
    monthText: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },

    weekdaysRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12, marginHorizontal: 8 },
    weekdayText: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: '#64748b' },

    grid: { flex: 1, flexDirection: 'row-reverse', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    cell: { width: '14.28%', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 10, paddingBottom: 6, borderWidth: 0.5, borderColor: '#f1f5f9' },
    dayText: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 6 },
    scoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    scoreText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
    placeholderBadge: { height: 24 }
});
