import { isNewFormat, RecsSections } from '@/components/RecommendationsCard';
import { getLogicalDayKey } from '@/utils/calculators';
import { refreshDailyRecommendations } from '@/utils/recommendations';
import { useUserStore } from '@/store/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RecommendationsScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const user = useUserStore((state) => state.user);
    const [refreshing, setRefreshing] = useState(false);

    const todayKey = getLogicalDayKey(new Date(), user?.resetTime);
    const cache = user?.dailyRecommendations?.dateStr === todayKey ? user.dailyRecommendations : undefined;
    const recs = cache?.data;
    const failed = !!recs?.short?.[0]?.includes('לא זמינות כרגע');

    const refresh = async () => {
        setRefreshing(true);
        try { await refreshDailyRecommendations({ force: true }); } finally { setRefreshing(false); }
    };

    // The explanation: one line per paragraph; lines starting with "•"/"-" become bullets
    const lines = (recs?.full || '').split('\n').map(l => l.trim()).filter(Boolean);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={26} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>המלצות להמשך היום</Text>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.headerBtn}>
                    <Ionicons name="menu" size={32} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
                {!recs || failed ? (
                    <View style={styles.card}>
                        <Text style={styles.empty}>{failed ? 'ההמלצות לא זמינות כרגע (עומס על ה-AI). אפשר לנסות שוב בעוד כמה דקות.' : 'עדיין אין המלצות להיום.'}</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.card}>
                            {isNewFormat(recs)
                                ? <RecsSections recs={recs} large onRecipePress={() => router.push('/(drawer)/my-recipes')} />
                                : recs.short.map((t, i) => <Text key={i} style={styles.body}>• {t}</Text>)}
                        </View>

                        {!!recs.weekTip && (
                            <View style={[styles.card, styles.weekCard]}>
                                <View style={styles.sectionHead}>
                                    <Ionicons name="calendar-outline" size={18} color="#7c3aed" />
                                    <Text style={styles.sectionTitle}>השבוע שלך</Text>
                                </View>
                                <Text style={styles.body}>{recs.weekTip}</Text>
                            </View>
                        )}

                        {lines.length > 0 && (
                            <View style={styles.card}>
                                <View style={styles.sectionHead}>
                                    <Ionicons name="bulb-outline" size={18} color="#f59e0b" />
                                    <Text style={styles.sectionTitle}>למה דווקא זה?</Text>
                                </View>
                                {lines.map((l, i) => /^[•\-*]/.test(l)
                                    ? <View key={i} style={styles.bulletRow}><View style={styles.bulletDot} /><Text style={[styles.body, { flex: 1 }]}>{l.replace(/^[•\-*]\s*/, '')}</Text></View>
                                    : <Text key={i} style={styles.body}>{l}</Text>)}
                            </View>
                        )}
                    </>
                )}

                <TouchableOpacity style={styles.refreshBtn} onPress={refresh} disabled={refreshing}>
                    {refreshing ? <ActivityIndicator color="#3b82f6" /> : <Ionicons name="refresh" size={18} color="#3b82f6" />}
                    <Text style={styles.refreshText}>{refreshing ? 'מכין המלצות חדשות...' : 'רענן המלצות'}</Text>
                </TouchableOpacity>

                {cache?.timestamp ? (
                    <Text style={styles.timestamp}>
                        עודכן בשעה {new Date(cache.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} · מתעדכן לבד כשמוסיפים ארוחה או אימון
                    </Text>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    headerBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
    content: { padding: 20, paddingBottom: 60, gap: 14 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    weekCard: { borderWidth: 1, borderColor: '#ede9fe' },
    sectionHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    body: { fontSize: 15, color: '#475569', lineHeight: 24, textAlign: 'right' },
    bulletRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 },
    bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6', marginTop: 9 },
    empty: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },
    refreshBtn: { flexDirection: 'row-reverse', alignSelf: 'center', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#eff6ff' },
    refreshText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },
    timestamp: { textAlign: 'center', color: '#94a3b8', fontSize: 12 },
});
