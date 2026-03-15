import { useUserStore } from '@/store/useUserStore';
import { DEFAULT_TRACKED_NUTRIENTS, nutrientLabelsLoc } from '@/utils/nutrients';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    I18nManager,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function CustomizeNutrientsScreen() {
    const router = useRouter();
    const { user, updateTrackedNutrients } = useUserStore();

    // Setup local state from store
    const [localTracked, setLocalTracked] = useState<Record<string, boolean>>(
        user?.trackedNutrients || DEFAULT_TRACKED_NUTRIENTS
    );

    const toggleNutrient = (key: string) => {
        const newValue = !localTracked[key];
        setLocalTracked(prev => ({ ...prev, [key]: newValue }));
        updateTrackedNutrients({ [key]: newValue }); // Instant update
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#1e293b" style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
                </TouchableOpacity>

                <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' }}>
                    <Text style={styles.headerTitle}>התאמה אישית של ערכים</Text>
                </View>

                <View style={{ width: 36 }} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Text style={styles.description}>בחר אילו ערכים תזונתיים יופיעו במעקב היומי שלך. ערכים שתבחר להסתיר ימשיכו להירשם ברקע, אך לא יוצגו במסכים המרכזיים.</Text>
                <View style={styles.card}>
                    {Object.keys(localTracked).map((key, index) => {
                        const isLast = index === Object.keys(localTracked).length - 1;
                        return (
                            <View key={key} style={[styles.settingRow, isLast && styles.lastRow]}>
                                <Text style={styles.settingLabel}>{nutrientLabelsLoc[key] || key}</Text>
                                <Switch
                                    value={localTracked[key]}
                                    onValueChange={() => toggleNutrient(key)}
                                    trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
                                    thumbColor={Platform.OS === 'ios' ? '#fff' : localTracked[key] ? '#fff' : '#f8fafc'}
                                />
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    container: { flex: 1 },
    content: { padding: 20 },
    description: { fontSize: 15, color: '#64748b', textAlign: 'right', marginBottom: 20, lineHeight: 22 },
    card: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    settingRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    lastRow: { borderBottomWidth: 0 },
    settingLabel: { fontSize: 16, color: '#334155', fontWeight: '500' },
});
