import { AlertManager as Alert } from '@/components/GlobalAlert';
import ProgressUpdateModal from '@/components/ProgressUpdateModal';
import { clearAllMeals } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { DAILY_LIMIT } from '@/utils/ai';
import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';
import { pushUserSettings } from '@/utils/userSettingsSync';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import StepsSettingsCard from '@/components/StepsSettingsCard';
import React, { useEffect, useState } from 'react';
import { I18nManager, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function SettingsScreen() {
    const router = useRouter();
    const { stepsGuide } = useLocalSearchParams<{ stepsGuide?: string }>();
    const navigation = useNavigation();
    const { user, setUser, updateTrackedNutrients } = useUserStore();
    const [tempResetTime, setTempResetTime] = useState(user?.resetTime || '00:00');
    const [progressVisible, setProgressVisible] = useState(false);

    // The saved profile can load a moment after the screen (e.g. refreshing the page on Settings):
    // keep the clock in sync with the saved day-reset time.
    useEffect(() => {
        setTempResetTime(user?.resetTime || '00:00');
    }, [user?.resetTime]);

    const tracked = user?.trackedNutrients || {};

    const toggleNutrient = (key: string) => {
        const isCurrentlyOn = tracked[key] !== false; // true if true or undefined
        updateTrackedNutrients({ [key]: !isCurrentlyOn });
        pushUserSettings();
    };

    const renderToggle = (key: string, label: string) => {
        const isOn = tracked[key] !== false;
        return (
            <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Switch
                    value={isOn}
                    onValueChange={() => toggleNutrient(key)}
                    trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="#e2e8f0"
                    // On the website the switch otherwise draws a green knob on the blue track
                    {...(Platform.OS === 'web' ? { activeThumbColor: '#ffffff', activeTrackColor: '#3b82f6' } as any : {})}
                />
            </View>
        );
    };

    const [resetHour, resetMinute] = tempResetTime.split(':').map(n => parseInt(n, 10) || 0);

    // Moves the time by the given number of minutes, wrapping around midnight
    const shiftTime = (deltaMinutes: number) => {
        const total = (((resetHour * 60 + resetMinute + deltaMinutes) % 1440) + 1440) % 1440;
        const h = Math.floor(total / 60);
        const m = total % 60;
        setTempResetTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    };

    const handleSaveResetTime = () => {
        if (!user) return;
        setUser({ ...user, resetTime: tempResetTime, settingsUpdatedAt: Date.now() });
        pushUserSettings();
        triggerScoreExplanationUpdate();
        Alert.alert('הצלחה', 'שעת החלפת יום עודכנה בהצלחה!');
    };

    const handleClearData = () => {
        Alert.alert('אזהרה: איפוס נתונים', 'כל הארוחות שנשמרו ביומן יימחקו לצמיתות. האם אתה בטוח?', [
            { text: 'ביטול', style: 'cancel' },
            {
                text: 'מחק הכל',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await clearAllMeals();
                        Alert.alert('נמחק', 'כל הארוחות נמחקו מיומן המעקב.');
                    } catch (e) {
                        Alert.alert('שגיאה', 'לא הצלחנו למחוק את הנתונים.');
                    }
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>הגדרות</Text>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.backButton}>
                    <Ionicons name="menu" size={32} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>

                {/* Profile: two different actions – progress (weight changed thanks to the plan) vs fixing details */}
                {user && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>הפרופיל שלי</Text>
                        <View style={styles.settingCard}>
                            <View style={styles.profileRow}>
                                <View style={styles.profileAvatar}>
                                    <Ionicons name="person" size={26} color="#3b82f6" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.profileName}>{user.full_name}</Text>
                                    <Text style={styles.profileMeta}>{user.goal} · {user.weight} ק"ג · {user.daily_targets?.calories} קק"ל ליום</Text>
                                </View>
                            </View>

                            <TouchableOpacity style={styles.profilePrimaryBtn} onPress={() => setProgressVisible(true)}>
                                <Ionicons name="trending-up-outline" size={20} color="#fff" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.profilePrimaryText}>עדכון התקדמות</Text>
                                    <Text style={styles.profilePrimarySub}>המשקל השתנה בזכות התוכנית – נשמור את ההתקדמות ונעדכן יעדים</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.profileSecondaryBtn} onPress={() => router.push('/(drawer)/edit-profile' as any)}>
                                <Ionicons name="create-outline" size={20} color="#3b82f6" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.profileSecondaryText}>תיקון פרטים אישיים</Text>
                                    <Text style={styles.profileSecondarySub}>תיקון טעות בפרטים או שינוי המטרה</Text>
                                </View>
                                <Ionicons name="chevron-back" size={18} color="#cbd5e1" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Optional steps tracking (on by default) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>צעדים</Text>
                    <StepsSettingsCard openGuideInitially={stepsGuide === '1'} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>מעקב תזונתי (הצג/הסתר)</Text>
                    <View style={styles.settingCard}>
                        {renderToggle('calories', 'קלוריות')}
                        <View style={styles.divider} />
                        {renderToggle('protein', 'חלבון')}
                        <View style={styles.divider} />
                        {renderToggle('carbs', 'פחמימות')}
                        <View style={styles.divider} />
                        {renderToggle('fat', 'שומן')}
                        <View style={styles.divider} />
                        {renderToggle('fiber', 'סיבים תזונתיים')}
                        <View style={styles.divider} />
                        {renderToggle('sodium', 'נתרן')}
                        <View style={styles.divider} />
                        {renderToggle('sugar', 'סוכר')}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>התאמה אישית</Text>

                    <View style={styles.settingCard}>
                        <View style={styles.settingRow}>
                            <View style={styles.settingTextContent}>
                                <Text style={styles.settingLabel}>שעת החלפת יום</Text>
                                <Text style={styles.settingDesc}>הגדר מתי מתחיל יום חדש ביומן. (למשל: 02:00 עבור 2 בלילה)</Text>
                            </View>
                            <Ionicons name="time-outline" size={24} color="#3b82f6" />
                        </View>

                        {/* Clock-style picker: hours on the left, minutes on the right (always LTR like a clock) */}
                        <View style={styles.clockRow}>
                            <View style={styles.clockColumn}>
                                <TouchableOpacity style={styles.clockArrow} onPress={() => shiftTime(60)} accessibilityLabel="הוסף שעה">
                                    <Ionicons name="chevron-up" size={26} color="#3b82f6" />
                                </TouchableOpacity>
                                <Text style={styles.clockDigits}>{String(resetHour).padStart(2, '0')}</Text>
                                <TouchableOpacity style={styles.clockArrow} onPress={() => shiftTime(-60)} accessibilityLabel="הורד שעה">
                                    <Ionicons name="chevron-down" size={26} color="#3b82f6" />
                                </TouchableOpacity>
                                <Text style={styles.clockUnit}>שעה</Text>
                            </View>
                            <Text style={styles.clockColon}>:</Text>
                            <View style={styles.clockColumn}>
                                <TouchableOpacity style={styles.clockArrow} onPress={() => shiftTime(15)} accessibilityLabel="הוסף רבע שעה">
                                    <Ionicons name="chevron-up" size={26} color="#3b82f6" />
                                </TouchableOpacity>
                                <Text style={styles.clockDigits}>{String(resetMinute).padStart(2, '0')}</Text>
                                <TouchableOpacity style={styles.clockArrow} onPress={() => shiftTime(-15)} accessibilityLabel="הורד רבע שעה">
                                    <Ionicons name="chevron-down" size={26} color="#3b82f6" />
                                </TouchableOpacity>
                                <Text style={styles.clockUnit}>דקות</Text>
                            </View>
                        </View>

                        <Text style={styles.clockHint}>
                            {tempResetTime === '00:00'
                                ? 'היום מתחלף בחצות.'
                                : `כל מה שתאכל בין 00:00 ל-${tempResetTime} יירשם ליום הקודם.`}
                        </Text>

                        <TouchableOpacity
                            style={[styles.saveTimeBtn, tempResetTime === (user?.resetTime || '00:00') && styles.saveTimeBtnDisabled]}
                            onPress={handleSaveResetTime}
                            disabled={tempResetTime === (user?.resetTime || '00:00')}
                        >
                            <Ionicons name="checkmark" size={18} color="#fff" />
                            <Text style={styles.saveTimeBtnText}>שמור שעה</Text>
                        </TouchableOpacity>
                    </View>
                </View>



                {/* AI usage today (counted on this device; the app's own daily safety limit) */}
                {user && (() => {
                    const today = new Date().toISOString().split('T')[0];
                    const used = user.aiDailyCount?.dateStr === today ? user.aiDailyCount.count : 0;
                    const pct = Math.min(used / DAILY_LIMIT, 1);
                    return (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>שימוש ב-AI</Text>
                            <View style={styles.settingCard}>
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <Text style={styles.settingLabel}>בקשות היום</Text>
                                    <Text style={styles.aiUsageValue}>{used} / {DAILY_LIMIT}</Text>
                                </View>
                                <View style={styles.aiUsageTrack}>
                                    <View style={[styles.aiUsageFill, { width: `${Math.max(pct * 100, used > 0 ? 2 : 0)}%`, backgroundColor: pct > 0.9 ? '#ef4444' : pct > 0.7 ? '#f59e0b' : '#3b82f6' }]} />
                                </View>
                                <Text style={styles.settingDesc}>
                                    נותרו {Math.max(DAILY_LIMIT - used, 0)} בקשות להיום (מתאפס כל יום). כל הודעה בצ'אט, ניתוח מתכון, הסבר ציון והמלצות נחשבים בקשה. בנוסף יש מגבלה של 15 בקשות בדקה. הספירה היא במכשיר הזה.
                                </Text>
                            </View>
                        </View>
                    );
                })()}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>נתונים והיסטוריה</Text>

                    <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
                        <Ionicons name="trash-outline" size={24} color="#ef4444" />
                        <Text style={styles.dangerButtonText}>מחיקת כל הנתונים</Text>
                    </TouchableOpacity>
                    <Text style={styles.helperText}>פעולה זו מוחקת את כל הארוחות שהזנת לאפליקציה.</Text>
                </View>

            </ScrollView>
            <ProgressUpdateModal visible={progressVisible} onClose={() => setProgressVisible(false)} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },

    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#64748b', marginBottom: 12, textAlign: 'right' },

    settingCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    settingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 16 },
    settingTextContent: { flex: 1 },
    settingLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 4 },
    settingDesc: { fontSize: 13, color: '#64748b', textAlign: 'right', lineHeight: 20 },

    aiUsageValue: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    aiUsageTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginVertical: 10 },
    aiUsageFill: { height: 8, borderRadius: 4 },
    profileRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 16 },
    profileAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
    profileName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    profileMeta: { fontSize: 13, color: '#64748b', textAlign: 'right', marginTop: 2 },
    profilePrimaryBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, marginBottom: 10 },
    profilePrimaryText: { color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'right' },
    profilePrimarySub: { color: '#dbeafe', fontSize: 12, textAlign: 'right', marginTop: 2 },
    profileSecondaryBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    profileSecondaryText: { color: '#1e293b', fontWeight: 'bold', fontSize: 15, textAlign: 'right' },
    profileSecondarySub: { color: '#64748b', fontSize: 12, textAlign: 'right', marginTop: 2 },
    toggleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    toggleLabel: { fontSize: 16, fontWeight: '500', color: '#1e293b' },
    divider: { height: 1, backgroundColor: '#f1f5f9' },

    // Clocks always read left-to-right (HH:MM), also when the app layout is RTL
    clockRow: { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: '#f8fafc', borderRadius: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    clockColumn: { alignItems: 'center', minWidth: 72 },
    clockArrow: { padding: 6 },
    clockDigits: { fontSize: 40, fontWeight: 'bold', color: '#1e293b', fontVariant: ['tabular-nums'] },
    clockColon: { fontSize: 40, fontWeight: 'bold', color: '#94a3b8', marginBottom: 22 },
    clockUnit: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    clockHint: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 12 },
    saveTimeBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 12, marginTop: 16 },
    saveTimeBtnDisabled: { backgroundColor: '#cbd5e1' },
    saveTimeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    dangerButton: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fee2e2', padding: 16, borderRadius: 16, gap: 12 },
    dangerButtonText: { fontSize: 18, fontWeight: 'bold', color: '#ef4444' },
    helperText: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'right', paddingHorizontal: 4 },

    rowButton: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    rowButtonText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' }
});
