import { DailyRecs } from '@/store/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Kind = NonNullable<DailyRecs['actions']>[number]['kind'];

const KIND_ICON: Record<Kind, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
    food: { icon: 'restaurant-outline', color: '#2563eb', bg: '#eff6ff' },
    workout: { icon: 'barbell-outline', color: '#7c3aed', bg: '#f5f3ff' },
    steps: { icon: 'footsteps-outline', color: '#059669', bg: '#ecfdf5' },
    water: { icon: 'water-outline', color: '#0891b2', bg: '#ecfeff' },
    rest: { icon: 'moon-outline', color: '#4f46e5', bg: '#eef2ff' },
    other: { icon: 'checkmark-circle-outline', color: '#475569', bg: '#f1f5f9' },
};

export const isNewFormat = (recs?: DailyRecs) => !!recs?.headline;

/** "What to eat next" options + concrete actions. Used on the home card and on the recommendations screen. */
export function RecsSections({ recs, large, onRecipePress }: { recs: DailyRecs; large?: boolean; onRecipePress?: () => void }) {
    return (
        <View style={{ gap: 14 }}>
            {!!recs.headline && <Text style={[styles.headline, large && { fontSize: 17 }]}>{recs.headline}</Text>}

            {recs.eatNext && recs.eatNext.options.length > 0 && (
                <View style={styles.eatBox}>
                    <View style={styles.eatHeader}>
                        <Ionicons name="restaurant" size={16} color="#2563eb" />
                        <Text style={styles.eatTitle}>{recs.eatNext.title}</Text>
                    </View>
                    {recs.eatNext.options.map((o, i) => {
                        const body = (
                            <>
                                <View style={styles.optionTop}>
                                    <Text style={styles.optionName}>{o.name}</Text>
                                    {o.fromRecipes && <Text style={styles.recipeBadge}>מהמתכונים שלך</Text>}
                                </View>
                                {!!o.detail && <Text style={styles.optionDetail}>{o.detail}</Text>}
                            </>
                        );
                        return o.fromRecipes && onRecipePress ? (
                            <TouchableOpacity key={i} style={[styles.option, i > 0 && styles.optionDivider]} onPress={onRecipePress}>{body}</TouchableOpacity>
                        ) : (
                            <View key={i} style={[styles.option, i > 0 && styles.optionDivider]}>{body}</View>
                        );
                    })}
                </View>
            )}

            {(recs.actions || []).length > 0 && (
                <View style={{ gap: 10 }}>
                    {(recs.actions || []).map((a, i) => {
                        const k = KIND_ICON[a.kind] || KIND_ICON.other;
                        return (
                            <View key={i} style={styles.actionRow}>
                                <View style={[styles.actionIcon, { backgroundColor: k.bg }]}>
                                    <Ionicons name={k.icon} size={16} color={k.color} />
                                </View>
                                <Text style={styles.actionText}>{a.text}</Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

/** Home-screen card: practical suggestions for the rest of today. Tapping opens the full screen. */
export default function RecommendationsCard({ recs, loading }: { recs?: DailyRecs; loading: boolean }) {
    const router = useRouter();
    const failed = !!recs?.short?.[0]?.includes('לא זמינות כרגע');

    return (
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push('/(drawer)/recommendations')}>
            <View style={styles.header}>
                <Ionicons name="sparkles" size={20} color="#f59e0b" />
                <Text style={styles.title}>מה כדאי לעשות עכשיו</Text>
                {loading && !!recs && !failed && <ActivityIndicator size="small" color="#94a3b8" />}
            </View>

            {!recs || failed ? (
                loading
                    ? <Text style={styles.empty}>מכין המלצות לפי מה שאכלת היום...</Text>
                    : <Text style={styles.empty}>{failed ? 'ההמלצות לא זמינות כרגע. ננסה שוב בעוד כמה דקות.' : 'אין המלצות זמינות כרגע.'}</Text>
            ) : isNewFormat(recs) ? (
                <RecsSections recs={recs} />
            ) : loading ? (
                <Text style={styles.empty}>מעדכן המלצות...</Text>
            ) : (
                <View style={{ gap: 10 }}>
                    {recs.short.map((tip, i) => (
                        <View key={i} style={styles.actionRow}>
                            <View style={styles.dot} />
                            <Text style={styles.actionText}>{tip}</Text>
                        </View>
                    ))}
                </View>
            )}

            {!!recs && !failed && <Text style={styles.more}>לחץ להסבר ולטיפ השבועי</Text>}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 14 },
    title: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    headline: { fontSize: 15, fontWeight: '600', color: '#334155', textAlign: 'right', lineHeight: 22 },
    eatBox: { backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 },
    eatHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 6 },
    eatTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e3a8a', textAlign: 'right' },
    option: { paddingVertical: 8 },
    optionDivider: { borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    optionTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    optionName: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: '#1e293b', textAlign: 'right', lineHeight: 21 },
    recipeBadge: { fontSize: 11, fontWeight: 'bold', color: '#047857', backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
    optionDetail: { fontSize: 13, color: '#64748b', textAlign: 'right', marginTop: 3, lineHeight: 19 },
    actionRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    actionIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    actionText: { flex: 1, fontSize: 14, color: '#334155', textAlign: 'right', lineHeight: 21 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6' },
    empty: { fontSize: 14, color: '#94a3b8', textAlign: 'center', paddingVertical: 8 },
    more: { fontSize: 13, color: '#3b82f6', textAlign: 'center', marginTop: 14, fontWeight: '600' },
});
