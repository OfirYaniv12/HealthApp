import { ConfettiBurst, GOLD, TrophyBadge } from '@/components/GoalCelebration';
import { useUserStore } from '@/store/useUserStore';
import { getWeekWorkoutProgress, WeekWorkoutProgress } from '@/utils/weeklyWorkouts';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * This week's workouts (Sunday -> Saturday) against the weekly goal from the user's plan.
 * Only "significant" workouts count (same rule as the daily score); light activities are shown separately.
 * Hidden for users whose plan says they don't train regularly.
 */
export default function WeeklyWorkoutsCard() {
    const user = useUserStore(state => state.user);
    const [p, setP] = useState<WeekWorkoutProgress | null>(null);

    const freq = user?.workout_frequency;
    const resetTime = user?.resetTime;
    useFocusEffect(useCallback(() => {
        let alive = true;
        getWeekWorkoutProgress({ workout_frequency: freq, resetTime }).then(r => { if (alive) setP(r); }).catch(() => { });
        return () => { alive = false; };
    }, [freq, resetTime]));

    if (!user || !p || p.target.max <= 0) return null;

    const { significant, light, target, daysLeft } = p;
    const reached = significant >= target.min;
    const maxed = significant >= target.max;
    const targetText = target.min === target.max ? `${target.min}` : `${target.min}-${target.max}`;
    const remaining = Math.max(target.min - significant, 0);
    const daysIncludingToday = daysLeft + 1;
    const dots = Math.max(target.max, significant);

    let message: string;
    if (maxed) message = '🏆 השלמת את יעד האימונים של השבוע!';
    else if (reached) message = `✨ עמדת ביעד השבועי! עוד אימון אחד ותגיע ל-${target.max}`;
    else if (remaining > daysIncludingToday) message = `עוד ${remaining} אימונים עד היעד, ונשארו ${daysIncludingToday} ימים. כל אימון נחשב 💪`;
    else message = remaining === 1
        ? `עוד אימון אחד עד היעד · נשארו ${daysIncludingToday === 1 ? 'היום בלבד' : `${daysIncludingToday} ימים`}`
        : `עוד ${remaining} אימונים עד היעד · נשארו ${daysIncludingToday} ימים`;

    const weekKey = `w${Math.floor((Date.now() / 86400000 + 4) / 7)}`;

    return (
        <View style={[styles.card, reached && styles.cardGold]}>
            <ConfettiBurst play={reached} celebrateKey={`workouts:${weekKey}:${maxed ? 'max' : 'min'}`} />
            <View style={styles.row}>
                {reached ? <TrophyBadge /> : (
                    <View style={styles.iconWrap}><Ionicons name="barbell" size={22} color="#8b5cf6" /></View>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>אימונים השבוע</Text>
                    <Text style={styles.sub}>יעד לפי התוכנית: {targetText} בשבוע</Text>
                </View>
                <View style={{ alignItems: 'flex-start' }}>
                    <Text style={[styles.count, reached && { color: GOLD.text }]}>{significant}</Text>
                    <Text style={styles.of}>מתוך {targetText}</Text>
                </View>
            </View>

            <View style={styles.dots}>
                {Array.from({ length: dots }, (_, i) => {
                    const done = i < significant;
                    const optional = i >= target.min; // the "extra" part of a range like 3-4
                    return (
                        <View key={i} style={[
                            styles.dot,
                            optional && !done && styles.dotOptional,
                            done && { backgroundColor: reached ? GOLD.fill : '#8b5cf6', borderColor: reached ? GOLD.fill : '#8b5cf6' },
                        ]}>
                            {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                    );
                })}
            </View>

            <Text style={[styles.message, reached && { color: GOLD.text, fontWeight: 'bold' }]}>{message}</Text>
            {light > 0 && (
                <Text style={styles.light}>+ {light === 1 ? 'פעילות קלה אחת' : `${light} פעילויות קלות`} השבוע (טוב לגוף, לא נספר ליעד)</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, position: 'relative', borderWidth: 1.5, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    cardGold: { backgroundColor: GOLD.bg, borderColor: GOLD.border, shadowColor: GOLD.fill, shadowOpacity: 0.25, shadowRadius: 12 },
    row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f3ff', justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 17, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    sub: { fontSize: 12, color: '#94a3b8', textAlign: 'right', marginTop: 2 },
    count: { fontSize: 26, fontWeight: 'bold', color: '#1e293b', fontVariant: ['tabular-nums'] },
    of: { fontSize: 12, color: '#64748b' },
    dots: { flexDirection: 'row-reverse', gap: 8, marginTop: 14, flexWrap: 'wrap' },
    dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#ddd6fe', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    dotOptional: { borderStyle: 'dashed', borderColor: '#e2e8f0' },
    message: { fontSize: 14, color: '#475569', textAlign: 'right', marginTop: 10 },
    light: { fontSize: 12, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
});
