import StepsGuideModal from '@/components/StepsGuideModal';
import { useUserStore } from '@/store/useUserStore';
import { calculateStepsGoal, getStepsStatus, isStepsEnabled, StepsStatus } from '@/utils/steps';
import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';
import { pushUserSettings } from '@/utils/userSettingsSync';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export const formatAgo = (ms: number) => {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'עכשיו';
    if (min < 60) return `לפני ${min} דק'`;
    const h = Math.round(min / 60);
    if (h < 24) return `לפני ${h} שע'`;
    return new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
};

/** Settings card for the optional steps tracking (on by default). */
export default function StepsSettingsCard({ openGuideInitially = false }: { openGuideInitially?: boolean }) {
    const user = useUserStore(state => state.user);
    const setUser = useUserStore(state => state.setUser);
    const [status, setStatus] = useState<StepsStatus | null>(null);
    const [guideVisible, setGuideVisible] = useState(false);

    useEffect(() => { if (openGuideInitially) setGuideVisible(true); }, [openGuideInitially]);

    const refresh = useCallback(() => { getStepsStatus().then(setStatus); }, []);
    useFocusEffect(refresh);

    if (!user) return null;
    const enabled = isStepsEnabled(user);
    const goal = calculateStepsGoal(user);

    const toggle = (value: boolean) => {
        setUser({ ...user, stepsEnabled: value, settingsUpdatedAt: Date.now() });
        pushUserSettings();
        triggerScoreExplanationUpdate();
    };

    return (
        <View style={styles.card}>
            <View style={styles.row}>
                <View style={styles.iconWrap}><Ionicons name="footsteps" size={22} color="#10b981" /></View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>מעקב צעדים</Text>
                    <Text style={styles.sub}>מאפליקציית "בריאות" באייפון</Text>
                </View>
                <Switch
                    value={enabled}
                    onValueChange={toggle}
                    trackColor={{ false: '#e2e8f0', true: '#10b981' }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="#e2e8f0"
                    {...(Platform.OS === 'web' ? { activeThumbColor: '#ffffff', activeTrackColor: '#10b981' } as any : {})}
                />
            </View>

            {enabled ? (
                <>
                    <View style={styles.infoRow}>
                        <View style={[styles.dot, { backgroundColor: status?.connected ? '#10b981' : '#f59e0b' }]} />
                        <Text style={styles.infoText}>
                            {status === null ? 'בודק חיבור...'
                                : status.connected && status.lastSyncAt ? `מחובר · עודכן ${formatAgo(status.lastSyncAt)}`
                                    : 'עדיין לא מחובר – עד החיבור הצעדים לא נכנסים לציון'}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="flag-outline" size={16} color="#64748b" />
                        <Text style={styles.infoText}>יעד יומי: {goal.toLocaleString('he-IL')} צעדים (לפי התוכנית והפרטים שלך)</Text>
                    </View>
                    <TouchableOpacity style={styles.guideBtn} onPress={() => setGuideVisible(true)}>
                        <Ionicons name="book-outline" size={18} color="#10b981" />
                        <Text style={styles.guideText}>{status?.connected ? 'מדריך והגדרות החיבור' : 'איך מחברים? מדריך שלב-שלב'}</Text>
                        <Ionicons name="chevron-back" size={18} color="#a7f3d0" />
                    </TouchableOpacity>
                </>
            ) : (
                <Text style={[styles.infoText, { marginTop: 10 }]}>המעקב כבוי: הצעדים לא מוצגים במסך הבית ולא נכנסים לציון היומי.</Text>
            )}

            <StepsGuideModal visible={guideVisible} onClose={() => { setGuideVisible(false); refresh(); }} />
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center' },
    label: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    sub: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 2 },
    infoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 12 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    infoText: { fontSize: 13, color: '#475569', textAlign: 'right', flex: 1 },
    guideBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 14, backgroundColor: '#ecfdf5', borderRadius: 12, padding: 12 },
    guideText: { flex: 1, color: '#047857', fontWeight: 'bold', fontSize: 14, textAlign: 'right' },
});
