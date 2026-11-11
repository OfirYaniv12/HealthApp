import { formatAgo } from '@/components/StepsSettingsCard';
import { useUserStore } from '@/store/useUserStore';
import { getLogicalDayKey } from '@/utils/calculators';
import { calculateStepsGoal, getStepsForDay, getStepsStatus, isStepsEnabled, StepsStatus } from '@/utils/steps';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Today's steps on the home screen (only when steps tracking is on).
 * The iPhone shortcut usually runs right when the app (or WhatsApp) is opened, so we check again a few
 * seconds after the screen appears to pick up the fresh numbers.
 */
export default function StepsHomeCard({ onUpdated }: { onUpdated?: () => void }) {
    const router = useRouter();
    const user = useUserStore(state => state.user);
    const [status, setStatus] = useState<StepsStatus | null>(null);
    const [steps, setSteps] = useState<number | null>(null);

    const load = useCallback(async () => {
        const u = useUserStore.getState().user;
        if (!u || !isStepsEnabled(u)) return;
        const st = await getStepsStatus();
        setStatus(prev => {
            if (prev?.lastSyncAt && st.lastSyncAt && st.lastSyncAt > prev.lastSyncAt) onUpdated?.();
            return st;
        });
        if (st.connected) setSteps(await getStepsForDay(getLogicalDayKey(new Date(), u.resetTime), u.resetTime));
    }, [onUpdated]);

    useFocusEffect(useCallback(() => {
        load();
        const t1 = setTimeout(load, 8000);
        const t2 = setTimeout(load, 25000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [load]));

    if (!user || !isStepsEnabled(user) || status === null || !status.available) return null;

    if (!status.connected) {
        return (
            <TouchableOpacity style={[styles.card, styles.connectCard]} onPress={() => router.push('/(drawer)/settings?stepsGuide=1' as any)}>
                <View style={styles.iconWrap}><Ionicons name="footsteps-outline" size={22} color="#10b981" /></View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.connectTitle}>חבר את הצעדים מהאייפון</Text>
                    <Text style={styles.connectSub}>הגדרה חד-פעמית של כמה דקות · לחץ למדריך</Text>
                </View>
                <Ionicons name="chevron-back" size={20} color="#a7f3d0" />
            </TouchableOpacity>
        );
    }

    const goal = calculateStepsGoal(user);
    const count = steps ?? 0;
    const pct = Math.min(count / goal, 1);
    const over = count >= goal;

    return (
        <View style={styles.card}>
            <View style={styles.row}>
                <View style={[styles.iconWrap, over && { backgroundColor: '#fef3c7' }]}>
                    <Ionicons name="footsteps" size={22} color={over ? '#d97706' : '#10b981'} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>צעדים היום</Text>
                    <Text style={styles.sub}>{status.lastSyncAt ? `עודכן ${formatAgo(status.lastSyncAt)}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-start' }}>
                    <Text style={[styles.count, over && { color: '#d97706' }]}>{steps === null ? '–' : count.toLocaleString('he-IL')}</Text>
                    <Text style={styles.goal}>מתוך {goal.toLocaleString('he-IL')}</Text>
                </View>
            </View>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(pct * 100, count > 0 ? 2 : 0)}%`, backgroundColor: over ? '#f59e0b' : '#10b981' }]} />
            </View>
            {over && <Text style={styles.overText}>🎉 עברת את היעד היומי{count >= goal * 1.2 ? ' – בונוס לציון!' : '!'}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    connectCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#d1fae5', borderStyle: 'dashed' },
    row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 17, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    sub: { fontSize: 12, color: '#94a3b8', textAlign: 'right', marginTop: 2 },
    count: { fontSize: 26, fontWeight: 'bold', color: '#1e293b', fontVariant: ['tabular-nums'] },
    goal: { fontSize: 12, color: '#64748b' },
    track: { height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden', marginTop: 14 },
    fill: { height: 10, borderRadius: 5 },
    overText: { fontSize: 13, color: '#b45309', textAlign: 'right', marginTop: 8, fontWeight: '600' },
    connectTitle: { fontSize: 15, fontWeight: 'bold', color: '#047857', textAlign: 'right' },
    connectSub: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 2 },
});
