import { AlertManager as Alert } from '@/components/GlobalAlert';
import { addWorkout } from '@/db/database';
import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { I18nManager, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';;

// Force RTL
if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function ManualWorkoutScreen() {
    const router = useRouter();

    const [workoutName, setWorkoutName] = useState('');
    const [duration, setDuration] = useState('');
    const [calories, setCalories] = useState('');
    const [description, setDescription] = useState('');

    const handleSave = async () => {
        if (!workoutName || !calories || !duration) {
            Alert.alert('שגיאה', 'יש למלא את שם האימון, זמן האימון ושרפת הקלוריות.');
            return;
        }

        try {
            const timestamp = new Date().toISOString();

            await addWorkout({
                name: workoutName,
                duration_minutes: Number(duration),
                calories_burned: Number(calories),
                description: description || null,
                timestamp: timestamp
            });

            // Trigger background AI explanation caching without waiting
            triggerScoreExplanationUpdate();

            Alert.alert('הצלחה', 'האימון נרשם בהצלחה!', [
                {
                    text: 'אישור', onPress: () => {
                        if (router.canDismiss()) {
                            router.dismissAll();
                            router.replace('/(drawer)/workout-history' as any);
                        } else {
                            router.replace('/(drawer)/workout-history' as any);
                        }
                    }
                }
            ]);
        } catch (e) {
            console.error(e);
            Alert.alert('שגיאה', 'שגיאה בשמירת האימון למסד הנתונים.');
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
                        <Text style={styles.label}>שם האימון</Text>
                        <TextInput style={styles.textInput} value={workoutName} onChangeText={setWorkoutName} placeholder="לדוגמה: ריצת בוקר / חדר כושר כוח" placeholderTextColor="#94a3b8" textAlign="right" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>פירוט האימון (לא חובה)</Text>
                        <TextInput style={[styles.textInput, { height: 80 }]} value={description} onChangeText={setDescription} placeholder="הערות אישיות על האימון..." placeholderTextColor="#94a3b8" textAlign="right" multiline />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>זמני אימון (דקות)</Text>
                            <TextInput style={styles.textInput} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="45" placeholderTextColor="#94a3b8" textAlign="right" />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>קלוריות שנשרפו</Text>
                            <TextInput style={styles.textInput} value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="300" placeholderTextColor="#94a3b8" textAlign="right" />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.submitButton} onPress={handleSave}>
                        <Text style={styles.submitButtonText}>שמור אימון</Text>
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
