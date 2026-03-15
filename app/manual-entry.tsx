import { addMeal } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, I18nManager, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Force RTL
if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function ManualEntryScreen() {
    const user = useUserStore(state => state.user);
    const tracked = user?.trackedNutrients || {};
    const router = useRouter();

    const [foodName, setFoodName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [calories, setCalories] = useState('');
    const [protein, setProtein] = useState('');
    const [carbs, setCarbs] = useState('');
    const [fat, setFat] = useState('');
    const [fiber, setFiber] = useState('');
    const [sodium, setSodium] = useState('');
    const [sugar, setSugar] = useState('');

    const handleSave = async () => {
        if (!foodName || !calories || !protein || !carbs || !fat) {
            Alert.alert('שגיאה', 'יש למלא לפחות שם, קלוריות וכל הערכים התזונתיים.');
            return;
        }

        try {
            // Timestamp in ISO datetime format
            const timestamp = new Date().toISOString();

            await addMeal({
                name: foodName,
                calories: Number(calories),
                protein: Number(protein),
                carbs: Number(carbs),
                fat: Number(fat),
                fiber: fiber ? Number(fiber) : 0,
                sodium: sodium ? Number(sodium) : 0,
                sugar: sugar ? Number(sugar) : 0,
                timestamp: timestamp,
                image_uri: null
            });

            // Trigger background AI explanation caching without waiting
            triggerScoreExplanationUpdate();

            Alert.alert('הצלחה', 'הארוחה נרשמה בהצלחה!', [
                {
                    text: 'אישור', onPress: () => {
                        if (router.canDismiss()) {
                            router.dismissAll();
                        } else {
                            router.replace('/');
                        }
                    }
                }
            ]);
        } catch (e) {
            console.error(e);
            Alert.alert('שגיאה', 'שגיאה בשמירת הארוחה למסד הנתונים.');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>הזנה ידנית</Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>שם המאכל / ארוחה</Text>
                        <TextInput style={styles.textInput} value={foodName} onChangeText={setFoodName} placeholder="לדוגמה: חזה עוף ואורז" placeholderTextColor="#94a3b8" textAlign="right" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>כמות (לא חובה)</Text>
                        <TextInput style={styles.textInput} value={quantity} onChangeText={setQuantity} placeholder="לדוגמה: 200 גרם" placeholderTextColor="#94a3b8" textAlign="right" />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>קלוריות</Text>
                            <TextInput style={styles.textInput} value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" textAlign="right" />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>חלבון (גרם)</Text>
                            <TextInput style={styles.textInput} value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" textAlign="right" />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>פחמימות (גרם)</Text>
                            <TextInput style={styles.textInput} value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" textAlign="right" />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>שומן (גרם)</Text>
                            <TextInput style={styles.textInput} value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" textAlign="right" />
                        </View>
                    </View>

                    {tracked.fiber !== false && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>סיבים תזונתיים (גרם)</Text>
                            <TextInput style={styles.textInput} value={fiber} onChangeText={setFiber} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" textAlign="right" />
                        </View>
                    )}

                    {tracked.sodium !== false && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>נתרן (מ"ג)</Text>
                            <TextInput style={styles.textInput} value={sodium} onChangeText={setSodium} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" textAlign="right" />
                        </View>
                    )}

                    {tracked.sugar !== false && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>סוכר (גרם)</Text>
                            <TextInput style={styles.textInput} value={sugar} onChangeText={setSugar} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" textAlign="right" />
                        </View>
                    )}

                    <TouchableOpacity style={styles.submitButton} onPress={handleSave}>
                        <Text style={styles.submitButtonText}>שמור ארוחה</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    closeButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    container: { flex: 1 },
    content: { padding: 24, paddingBottom: 60 },
    row: { flexDirection: 'row-reverse', gap: 16 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333', textAlign: 'right' },
    textInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#f8fafc', color: '#1e293b', textAlign: 'right' },
    submitButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 12, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
