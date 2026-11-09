import { AlertManager as Alert } from '@/components/GlobalAlert';
import { saveUserProfile } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { calculateDailyTargets } from '@/utils/calculators';
import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

/**
 * "Progress update": the user's weight changed because of the plan (lost / gained weight).
 * Different from "fix details" (correcting a mistake): here we keep a weight history, show the
 * progress, and recalculate the daily targets for the new weight.
 */
export default function ProgressUpdateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const user = useUserStore(state => state.user);
    const setUser = useUserStore(state => state.setUser);
    const [weightInput, setWeightInput] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) setWeightInput('');
    }, [visible]);

    if (!user) return null;

    const history = user.weightHistory && user.weightHistory.length > 0
        ? user.weightHistory
        : [{ date: new Date().toISOString(), weight: user.weight }];
    const startWeight = history[0].weight;
    const lastEntry = history[history.length - 1];

    const newWeight = parseFloat(weightInput.replace(',', '.'));
    const validWeight = isFinite(newWeight) && newWeight >= 30 && newWeight <= 300;
    // Adjust the CURRENT targets only by the effect of the weight change (formula at the new weight minus
    // formula at the old weight). This way a progress update never "jumps" the targets for other reasons
    // (e.g. targets that were set earlier by a different method).
    const preview = (() => {
        if (!validWeight) return null;
        const before = calculateDailyTargets({ ...user, weight: user.weight });
        const after = calculateDailyTargets({ ...user, weight: newWeight });
        const current = user.daily_targets as Record<string, number>;
        const targets: Record<string, number> = {};
        for (const key of Object.keys(after.targets)) {
            const base = typeof current?.[key] === 'number' && current[key] > 0 ? current[key] : (before.targets as any)[key];
            targets[key] = Math.max(0, Math.round(base + (after.targets as any)[key] - (before.targets as any)[key]));
        }
        return { targets: targets as any, explanation: `עדכון התקדמות: משקל ${user.weight} ← ${newWeight} ק"ג. היעדים עודכנו בהתאם לשינוי במשקל.` };
    })();

    const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
    const changeFromStart = validWeight ? newWeight - startWeight : 0;
    const changeFromLast = validWeight ? newWeight - user.weight : 0;

    const progressMessage = () => {
        if (!validWeight) return '';
        const goal = user.goal;
        const delta = Math.abs(changeFromStart);
        if (delta < 0.3) return 'המשקל יציב מאז ההתחלה.';
        if (goal === 'ירידה במשקל') {
            return changeFromStart < 0
                ? `כל הכבוד! ירדת ${fmt(delta)} ק"ג מאז ההתחלה 👏`
                : `עלית ${fmt(delta)} ק"ג מאז ההתחלה. זה קורה – היעדים יתעדכנו בהתאם.`;
        }
        if (goal === 'עלייה במסת שריר') {
            return changeFromStart > 0
                ? `יפה! עלית ${fmt(delta)} ק"ג מאז ההתחלה 💪`
                : `ירדת ${fmt(delta)} ק"ג מאז ההתחלה – כדאי להקפיד להגיע ליעד הקלוריות.`;
        }
        return changeFromStart < 0 ? `ירדת ${fmt(delta)} ק"ג מאז ההתחלה.` : `עלית ${fmt(delta)} ק"ג מאז ההתחלה.`;
    };

    const handleSave = async () => {
        if (!validWeight || !preview) {
            Alert.alert('משקל לא תקין', 'נא להזין משקל בק"ג (30-300).');
            return;
        }
        setSaving(true);
        try {
            const updated = {
                ...user,
                weight: newWeight,
                daily_targets: preview.targets,
                aiPlanExplanation: preview.explanation,
                weightHistory: [...history, { date: new Date().toISOString(), weight: newWeight }].slice(-200),
                settingsUpdatedAt: Date.now(),
            };
            setUser(updated);
            const err = await saveUserProfile(updated);
            triggerScoreExplanationUpdate();
            onClose();
            Alert.alert(
                'ההתקדמות נשמרה',
                `${progressMessage()}\n\nהיעדים היומיים עודכנו: ${preview.targets.calories} קק"ל, ${preview.targets.protein} ג' חלבון.` +
                (err ? '\n\n(השמירה בענן נכשלה, הנתונים נשמרו במכשיר.)' : '')
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Text style={styles.title}>עדכון התקדמות</Text>
                        <TouchableOpacity onPress={onClose} disabled={saving}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={styles.desc}>
                            המשקל השתנה בזכות התוכנית? עדכן כאן. נשמור את ההתקדמות שלך ונחשב מחדש את היעדים היומיים למשקל החדש.
                        </Text>

                        <View style={styles.statsRow}>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{fmt(startWeight)}</Text>
                                <Text style={styles.statLabel}>משקל התחלתי</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{fmt(user.weight)}</Text>
                                <Text style={styles.statLabel}>עדכון אחרון ({new Date(lastEntry.date).toLocaleDateString('he-IL')})</Text>
                            </View>
                        </View>

                        <Text style={styles.label}>המשקל שלך היום (ק"ג)</Text>
                        <TextInput
                            style={styles.input}
                            value={weightInput}
                            onChangeText={setWeightInput}
                            keyboardType="decimal-pad"
                            placeholder={`למשל ${fmt(user.weight)}`}
                            placeholderTextColor="#94a3b8"
                            autoFocus
                        />

                        {validWeight && preview && (
                            <View style={styles.previewBox}>
                                <Text style={styles.previewHeadline}>
                                    {changeFromLast === 0 ? 'ללא שינוי מהעדכון הקודם' : `${changeFromLast < 0 ? 'ירידה' : 'עלייה'} של ${fmt(Math.abs(changeFromLast))} ק"ג מהעדכון הקודם`}
                                </Text>
                                <Text style={styles.previewText}>{progressMessage()}</Text>
                                <View style={styles.targetRow}>
                                    <Text style={styles.targetLabel}>קלוריות ליום</Text>
                                    <Text style={styles.targetValue}>{user.daily_targets.calories} ← {preview.targets.calories}</Text>
                                </View>
                                <View style={styles.targetRow}>
                                    <Text style={styles.targetLabel}>חלבון ליום</Text>
                                    <Text style={styles.targetValue}>{user.daily_targets.protein} ← {preview.targets.protein} ג'</Text>
                                </View>
                            </View>
                        )}

                        <TouchableOpacity style={[styles.saveBtn, (!validWeight || saving) && { opacity: 0.5 }]} onPress={handleSave} disabled={!validWeight || saving}>
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>שמור התקדמות</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 16 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, maxHeight: '90%' },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    desc: { fontSize: 14, color: '#64748b', textAlign: 'right', lineHeight: 20, marginBottom: 16 },
    statsRow: { flexDirection: 'row-reverse', gap: 12, marginBottom: 16 },
    stat: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    statValue: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
    statLabel: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
    label: { fontSize: 14, fontWeight: '600', color: '#475569', textAlign: 'right', marginBottom: 8 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 20, textAlign: 'center', color: '#1e293b', marginBottom: 16 },
    previewBox: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, marginBottom: 16, gap: 6 },
    previewHeadline: { fontSize: 15, fontWeight: 'bold', color: '#1e3a8a', textAlign: 'right' },
    previewText: { fontSize: 14, color: '#1e40af', textAlign: 'right', marginBottom: 4 },
    targetRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    targetLabel: { fontSize: 14, color: '#334155' },
    targetValue: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
    saveBtn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center' },
    saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
