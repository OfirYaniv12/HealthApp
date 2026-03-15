import { useUserStore } from '@/store/useUserStore';
import { getLogicalDayBounds } from '@/utils/calculators';
import { refreshDailyScoreData, triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, I18nManager, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function DailyScoreScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const user = useUserStore(state => state.user);

    const [popupInfo, setPopupInfo] = useState<'nutrition' | 'workout' | null>(null);

    const todayDateStr = new Date().toISOString().split('T')[0];
    const rawExplanation = user?.dailyScoreExplanations?.[todayDateStr];
    const hasError = rawExplanation?.includes('שגיאה') || rawExplanation?.includes('API') || rawExplanation?.includes('מנסה שוב');
    const aiExplanation = hasError || !rawExplanation
        ? 'ה-AI מכין עבורך הסבר מותאם אישית... הוא יופיע כאן בעוד מספר שניות לאחר שתוסיף ארוחה או תחזור למסך זה.'
        : rawExplanation;

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                const currentUser = useUserStore.getState().user;
                if (!currentUser) return;

                await refreshDailyScoreData();

                // Trigger AI explanation only if cache is stale (>1 hour)
                const lastUpdatedTimestamp = useUserStore.getState().user?.dailyScoreLastUpdated?.[todayDateStr] || 0;
                const ONE_HOUR_MS = 60 * 60 * 1000;
                if (Date.now() - lastUpdatedTimestamp > ONE_HOUR_MS) {
                    triggerScoreExplanationUpdate(); // Background, does not block render
                }
            };
            loadData();
        }, []) // ✅ Empty deps: fires once per focus, not on every store update
    );

    const scoreData = user?.dailyScoreData?.[todayDateStr] || {
        totalScore: 0,
        nutritionScore: 0,
        workoutBonus: 0,
        progressExpected: 0,
        progressActual: 0
    };

    const getScoreColor = (s: number) => {
        if (s >= 7) return '#10b981'; // Green
        if (s >= 4) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    };

    const getNutritionPopupText = () => {
        const goal = user?.goal || 'אורח חיים בריא יותר';

        if (goal === 'עלייה במסת שריר') {
            return `הציון במטרה שלך (עלייה במסת שריר) בנוי ככה:\n\n• קלוריות וחלבון: 65% מהציון\n• שאר הערכים (פחמימות, שומן): 15% מהציון\n• איכות האוכל וגיוון: 20% מהציון\n\nדברים כמו מלח וסוכר פוגעים בציון רק אם הגזמת בהם ממש.`;
        } else if (goal === 'ירידה במשקל') {
            return `הציון במטרה שלך (ירידה במשקל) בנוי ככה:\n\n• שמירה קפדנית על קלוריות: 50% מהציון\n• שאר הערכים (חלבון, פחמימות, שומן): 30% מהציון\n• איכות האוכל וגיוון (ירקות, אוכל אמיתי): 20% מהציון\n\nאם אכלת יותר מדי סוכר או שומן רווי, זה יוריד לך ניקוד כי זה פוגע בחיטוב.`;
        } else if (goal === 'שילוב מתון') {
            return `הציון במטרה שלך (שילוב מתון) בנוי ככה:\n\n• איזון בין חלבון לקלוריות: 55% מהציון\n• שאר הערכים התזונתיים: 25% מהציון\n• איכות האוכל וגיוון: 20% מהציון\n\nהמערכת בודקת שאתה שומר על יציבות ולא מגזים לשום כיוון.`;
        } else {
            return `הציון במטרה שלך (אורח חיים בריא) בנוי ככה:\n\n• איזון כל הנתונים יחד: 80% מהציון\n• איכות האוכל וגיוון: 20% מהציון\n\nאנחנו שמים דגש על להימנע מהרבה סוכר מעובד או מלח.`;
        }
    };

    const getWorkoutPopupText = () => {
        const goal = user?.goal || 'אורח חיים בריא יותר';

        let customText = '';
        if (goal === 'ירידה במשקל') {
            customText = 'אימון עוזר מאוד לשרוף יותר קלוריות ונותן לך "מרחב נשימה" אם אכלת קצת יותר מדי.';
        } else if (goal === 'עלייה במסת שריר') {
            customText = 'אימון הוא זה שעוזר לבנות שריר ביחד עם החלבון שאתה אוכל - ולכן הוא נותן בונוס חזק.';
        } else {
            customText = 'להתאמן באופן קבוע פשוט שומר לך על ציון גבוה ונותן גמישות באוכל.';
        }

        return `בגדול, הציון במקור מחושב עד 10 נקודות רק לפי מה שאתה אוכל. בימי מנוחה אתה לגמרי יכול לקבל 10 עגול רק מתזונה.\n\nאם עשית אימון, אתה מקבל בונוס של עד 2 נקודות לציון היומי.\n\n${customText}`;
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>הציון היומי שלך</Text>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.backButton}>
                    <Ionicons name="menu" size={32} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>

                {scoreData ? (
                    <>
                        <View style={styles.scoreCircleContainer}>
                            <View style={[styles.scoreCircle, { borderColor: getScoreColor(scoreData.totalScore) }]}>
                                <Text style={[styles.scoreText, { color: getScoreColor(scoreData.totalScore) }]}>
                                    {scoreData.totalScore}
                                </Text>
                                <Text style={styles.scoreMaxText}>מתוך 10</Text>
                            </View>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>הסבר לציון</Text>

                            <View style={styles.aiContainer}>
                                <Text style={styles.aiExplanationText}>{aiExplanation}</Text>
                            </View>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>פירוט הציון</Text>

                            <View style={styles.breakdownRow}>
                                <TouchableOpacity style={styles.breakdownItem} onPress={() => setPopupInfo('nutrition')}>
                                    <Ionicons name="restaurant" size={24} color="#3b82f6" style={{ marginBottom: 8 }} />
                                    <Text style={styles.breakdownValue}>{scoreData.nutritionScore} נק׳</Text>
                                    <Text style={styles.breakdownLabel}>בסיס תזונה</Text>
                                </TouchableOpacity>

                                <View style={styles.breakdownDivider} />

                                <TouchableOpacity style={styles.breakdownItem} onPress={() => setPopupInfo('workout')}>
                                    <Ionicons name="barbell" size={24} color="#10b981" style={{ marginBottom: 8 }} />
                                    <Text style={styles.breakdownValue}>+ {scoreData.workoutBonus} נק׳</Text>
                                    <Text style={styles.breakdownLabel}>בונוס אימונים</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Modal
                            animationType="fade"
                            transparent={true}
                            visible={popupInfo !== null}
                            onRequestClose={() => setPopupInfo(null)}
                        >
                            <Pressable style={styles.modalOverlay} onPress={() => setPopupInfo(null)}>
                                <View style={styles.modalContent}>
                                    <Text style={styles.modalTitle}>
                                        {popupInfo === 'nutrition' ? 'בסיס תזונה - חישוב' : 'בונוס אימונים - חישוב'}
                                    </Text>
                                    <Text style={styles.modalText}>
                                        {popupInfo === 'nutrition'
                                            ? getNutritionPopupText()
                                            : getWorkoutPopupText()}
                                    </Text>
                                    <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPopupInfo(null)}>
                                        <Text style={styles.modalCloseText}>סגור</Text>
                                    </TouchableOpacity>
                                </View>
                            </Pressable>
                        </Modal>
                    </>
                ) : (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={styles.loadingText}>מחשב ציון...</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    loadingText: { marginTop: 16, fontSize: 16, color: '#64748b' },

    scoreCircleContainer: { alignItems: 'center', marginVertical: 32 },
    scoreCircle: {
        width: 180, height: 180, borderRadius: 90,
        borderWidth: 12,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#fff',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
    },
    scoreText: { fontSize: 64, fontWeight: 'bold', marginTop: 10 },
    scoreMaxText: { fontSize: 16, color: '#94a3b8', fontWeight: '500' },

    card: {
        backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3
    },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', textAlign: 'center', marginBottom: 16 },

    aiContainer: { flexDirection: 'row-reverse', backgroundColor: '#f5f3ff', padding: 16, borderRadius: 16, alignItems: 'center' },
    aiIcon: { marginLeft: 12, alignSelf: 'flex-start' },
    aiExplanationText: { fontSize: 16, color: '#334155', textAlign: 'right', lineHeight: 28 },

    aiLoadingContainer: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', padding: 16 },
    aiLoadingText: { marginRight: 12, fontSize: 15, color: '#64748b' },

    breakdownRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', alignItems: 'center', marginVertical: 12 },
    breakdownItem: { alignItems: 'center', flex: 1 },
    breakdownValue: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
    breakdownLabel: { fontSize: 14, color: '#64748b', marginTop: 4 },
    breakdownDivider: { width: 1, height: 40, backgroundColor: '#e2e8f0' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 12 },
    modalText: { fontSize: 16, color: '#334155', textAlign: 'center', lineHeight: 24 },
    modalCloseButton: { marginTop: 20, paddingVertical: 10, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center' },
    modalCloseText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
