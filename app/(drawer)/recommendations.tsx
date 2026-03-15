import { useUserStore } from '@/store/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React from 'react';
import { I18nManager, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RecommendationsScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const user = useUserStore((state) => state.user);

    const fullText = user?.dailyRecommendations?.data?.full || "אין המלצות זמינות כרגע. AI עדיין מנתח את הנתונים שלך להיום.";

    // Parse the full text into sections/paragraphs for structured display
    const sections = fullText.split('\n').filter(line => line.trim().length > 0);

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header - back arrow always on LEFT side for Hebrew RTL */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={26} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>המלצות להמשך היום</Text>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.backButton}>
                    <Ionicons name="menu" size={32} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Icon & Subtitle */}
                <View style={styles.heroContainer}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="sparkles" size={44} color="#f59e0b" />
                    </View>
                    <Text style={styles.heroSubtitle}>ניתוח AI אישי להיום שלך</Text>
                </View>

                {/* Structured Content Card */}
                <View style={styles.card}>
                    {sections.map((line, idx) => {
                        const trimmed = line.trim();
                        // Section headers (lines ending with ':' or starting with emoji headers)
                        const isSectionHeader = trimmed.endsWith(':') || /^(🍗|🥗|⚠️|🏃|💪|🧠|📊|✅|❌|🔥|💧|🎯)/.test(trimmed) && trimmed.length < 60;
                        // Bullet points
                        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
                        
                        if (isSectionHeader) {
                            return (
                                <Text key={idx} style={styles.sectionHeader}>{trimmed}</Text>
                            );
                        } else if (isBullet) {
                            return (
                                <View key={idx} style={styles.bulletRow}>
                                    <View style={styles.bulletDot} />
                                    <Text style={styles.bulletText}>{trimmed.replace(/^[•\-*]\s*/, '')}</Text>
                                </View>
                            );
                        } else {
                            return (
                                <Text key={idx} style={styles.bodyText}>{trimmed}</Text>
                            );
                        }
                    })}
                </View>

                {/* Timestamp */}
                {user?.dailyRecommendations?.timestamp ? (
                    <Text style={styles.timestamp}>
                        עודכן בשעה {new Date(user.dailyRecommendations.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    heroContainer: { alignItems: 'center', marginBottom: 20 },
    iconContainer: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: '#fffbeb',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 10,
        shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    },
    heroSubtitle: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
    card: {
        backgroundColor: '#fff', borderRadius: 20, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
        gap: 10,
    },
    sectionHeader: {
        fontSize: 16, fontWeight: '700', color: '#1e293b',
        textAlign: 'right', marginTop: 8, marginBottom: 2,
    },
    bulletRow: {
        flexDirection: 'row-reverse',
        alignItems: 'flex-start',
        gap: 8,
    },
    bulletDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: '#3b82f6', marginTop: 8, flexShrink: 0,
    },
    bulletText: {
        flex: 1, fontSize: 15, color: '#334155',
        lineHeight: 24, textAlign: 'right',
    },
    bodyText: {
        fontSize: 15, color: '#475569',
        lineHeight: 26, textAlign: 'right',
    },
    timestamp: {
        textAlign: 'center', color: '#94a3b8',
        fontSize: 12, marginTop: 16,
    },
});

