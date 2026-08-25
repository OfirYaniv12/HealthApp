import { AlertManager as Alert } from '@/components/GlobalAlert';
import { clearAllMeals } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { I18nManager, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';;

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function SettingsScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { user, setUser, updateTrackedNutrients } = useUserStore();
    const [tempResetTime, setTempResetTime] = useState(user?.resetTime || '00:00');

    const tracked = user?.trackedNutrients || {};

    const toggleNutrient = (key: string) => {
        const isCurrentlyOn = tracked[key] !== false; // true if true or undefined
        updateTrackedNutrients({ [key]: !isCurrentlyOn });
    };

    const renderToggle = (key: string, label: string) => {
        const isOn = tracked[key] !== false;
        return (
            <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Switch
                    value={isOn}
                    onValueChange={() => toggleNutrient(key)}
                    trackColor={{ false: '#cbd5e1', true: '#3b82f6' }}
                    thumbColor="#fff"
                />
            </View>
        );
    };

    const handleSaveResetTime = () => {
        if (!user) return;

        // Simple validation
        if (!/^\d{2}:\d{2}$/.test(tempResetTime)) {
            Alert.alert('שגיאה', 'אנא הזן תצורה חוקית, למשל 02:00 או 00:00');
            return;
        }

        setUser({ ...user, resetTime: tempResetTime });
        Alert.alert('הצלחה', 'שעת החלפת יום עודכנה בהצלחה!');
        router.back();
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

                        <View style={styles.timeInputRow}>
                            <TextInput
                                style={styles.timeInput}
                                value={tempResetTime}
                                onChangeText={setTempResetTime}
                                placeholder="00:00"
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                            />
                            <TouchableOpacity style={styles.saveTimeBtn} onPress={handleSaveResetTime}>
                                <Text style={styles.saveTimeBtnText}>שמור זמנים</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>



                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>נתונים והיסטוריה</Text>

                    <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
                        <Ionicons name="trash-outline" size={24} color="#ef4444" />
                        <Text style={styles.dangerButtonText}>מחיקת כל הנתונים</Text>
                    </TouchableOpacity>
                    <Text style={styles.helperText}>פעולה זו מוחקת את כל הארוחות שהזנת לאפליקציה.</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>חשבון</Text>

                    <TouchableOpacity style={styles.rowButton} onPress={() => router.replace('/onboarding')}>
                        <Ionicons name="person-outline" size={24} color="#3b82f6" />
                        <Text style={styles.rowButtonText}>ערוך פרטים אישיים</Text>
                        <View style={{ flex: 1 }} />
                        <Ionicons name="chevron-back" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                </View>

            </ScrollView>
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

    toggleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    toggleLabel: { fontSize: 16, fontWeight: '500', color: '#1e293b' },
    divider: { height: 1, backgroundColor: '#f1f5f9' },

    timeInputRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    timeInput: { backgroundColor: '#f8fafc', flex: 1, padding: 12, borderRadius: 12, fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    saveTimeBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12 },
    saveTimeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    dangerButton: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fee2e2', padding: 16, borderRadius: 16, gap: 12 },
    dangerButtonText: { fontSize: 18, fontWeight: 'bold', color: '#ef4444' },
    helperText: { fontSize: 13, color: '#94a3b8', marginTop: 8, textAlign: 'right', paddingHorizontal: 4 },

    rowButton: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    rowButtonText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' }
});
