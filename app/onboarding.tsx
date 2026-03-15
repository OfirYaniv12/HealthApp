import { UserData, useUserStore } from '@/store/useUserStore';
import { generatePersonalizedPlan } from '@/utils/ai';
import { ActivityLevel, BodyType, GenderType, GoalType, TargetPace, WorkoutFrequency } from '@/utils/calculators';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, I18nManager, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Force RTL layout since the app is entirely in Hebrew
if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function OnboardingScreen() {
    const router = useRouter();
    const setUser = useUserStore((state) => state.setUser);
    const resetUser = useUserStore((state) => state.resetUser);

    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState<GenderType | ''>('');
    const [age, setAge] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [goal, setGoal] = useState<GoalType | ''>('');
    const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>('');
    const [workoutFreq, setWorkoutFreq] = useState<WorkoutFrequency | ''>('');
    const [bodyType, setBodyType] = useState<BodyType | ''>('');
    const [targetPace, setTargetPace] = useState<TargetPace | ''>('');
    const [isGenerating, setIsGenerating] = useState(false);

    const shouldShowPace = goal === 'ירידה במשקל' || goal === 'עלייה במסת שריר';

    const maleBodyTypes = ['רזה', 'ממוצע', 'אתלטי', 'שרירי', 'מלא'];
    const femaleBodyTypes = ['רזה', 'ממוצע', 'חטוב', 'מלא'];

    const handleReset = () => {
        resetUser();
        setFullName('');
        setGender('');
        setAge('');
        setHeight('');
        setWeight('');
        setGoal('');
        setActivityLevel('');
        setWorkoutFreq('');
        setBodyType('');
        setTargetPace('');
        Alert.alert('הנתונים אופסו', 'ניתן להתחיל מחדש.');
    };

    const handleComplete = async () => {
        if (!fullName || !gender || !age || !height || !weight || !goal || !activityLevel || !workoutFreq || !bodyType) {
            Alert.alert('שגיאה', 'אנא מלא/י את כל השדות החסרים.');
            return;
        }

        if (shouldShowPace && !targetPace) {
            Alert.alert('שגיאה', 'אנא בחר/י קצב התקדמות ליעד שלך.');
            return;
        }

        const ageNum = parseInt(age, 10);
        const heightNum = Number(height);
        const weightNum = Number(weight);

        if (isNaN(ageNum) || isNaN(heightNum) || isNaN(weightNum)) {
            Alert.alert('קלט לא תקין', 'גיל, גובה ומשקל חייבים להיות מספרים תקינים.');
            return;
        }

        setIsGenerating(true);

        const baseUser: UserData = {
            id: new Date().getTime().toString(),
            full_name: fullName,
            gender,
            age: ageNum,
            height: heightNum,
            weight: weightNum,
            goal,
            activity_level: activityLevel,
            workout_frequency: workoutFreq,
            body_type: bodyType,
            target_pace: shouldShowPace ? (targetPace as TargetPace) : undefined,
            daily_targets: { calories: 0, protein: 0, carbs: 0, fat: 0 } // Temporary fallback
        };

        try {
            const plan = await generatePersonalizedPlan(baseUser);
            if (plan) {
                baseUser.daily_targets = plan.targets;
                baseUser.aiPlanExplanation = plan.explanation;
            } else {
                throw new Error('AI Generation failed');
            }
        } catch (e) {
            setIsGenerating(false);
            Alert.alert('שגיאה', 'תקלה בתקשורת מול מערכת ה-AI. אנא נסה שוב.');
            return;
        }

        setUser(baseUser);
        router.replace('/(drawer)' as any);
    };

    const renderHebrewOptionButtons = (
        options: string[],
        selectedValue: string,
        onSelect: (value: any) => void
    ) => (
        <View style={styles.buttonCol}>
            {options.map((opt) => (
                <TouchableOpacity
                    key={opt}
                    style={[styles.optionButtonCol, selectedValue === opt && styles.optionButtonSelected]}
                    onPress={() => onSelect(opt)}
                >
                    <Text style={[styles.optionText, selectedValue === opt && styles.optionTextSelected]}>
                        {opt}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderHebrewRowButtons = (
        options: { label: string; value: any }[] | string[],
        selectedValue: string,
        onSelect: (value: any) => void
    ) => (
        <View style={styles.buttonRow}>
            {options.map((opt) => {
                const isObj = typeof opt === 'object';
                const label = isObj ? opt.label : opt;
                const val = isObj ? opt.value : opt;

                return (
                    <TouchableOpacity
                        key={val}
                        style={[styles.optionButton, selectedValue === val && styles.optionButtonSelected]}
                        onPress={() => onSelect(val)}
                    >
                        <Text style={[styles.optionText, selectedValue === val && styles.optionTextSelected, { fontSize: 14 }]}>
                            {label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>

                <View style={styles.headerContainer}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>HealthApp</Text>
                        <Text style={styles.subtitle}>על מנת להתאים בצורה המיטבית יש למלא את הפרטים הבאים:</Text>
                    </View>
                    <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                        <Text style={styles.resetText}>איפוס נתונים</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>שם מלא</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="לדוגמה: ישראל ישראלי"
                        value={fullName}
                        onChangeText={setFullName}
                        textAlign="right"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>מין</Text>
                    {renderHebrewRowButtons(
                        [{ label: 'זכר', value: 'Male' }, { label: 'נקבה', value: 'Female' }],
                        gender, (g) => {
                            setGender(g);
                            setBodyType(''); // Reset body type when gender changes
                        }
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>גיל</Text>
                    <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        placeholder="לדוגמה 30"
                        value={age}
                        onChangeText={setAge}
                        textAlign="right"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>גובה (ס"מ)</Text>
                    <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        placeholder="לדוגמה 175"
                        value={height}
                        onChangeText={setHeight}
                        textAlign="right"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>משקל (ק"ג)</Text>
                    <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        placeholder="לדוגמה 70"
                        value={weight}
                        onChangeText={setWeight}
                        textAlign="right"
                    />
                </View>

                {gender !== '' && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>מבנה גוף</Text>
                        {renderHebrewRowButtons(gender === 'Male' ? maleBodyTypes : femaleBodyTypes, bodyType, setBodyType)}
                    </View>
                )}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>רמת פעילות יומיומית</Text>
                    {renderHebrewOptionButtons([
                        'לא פעיל כלל',
                        'פעיל באופן נמוך',
                        'פעיל באופן ממוצע',
                        'פעיל באופן גבוה'
                    ], activityLevel, setActivityLevel)}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>תדירות אימונים</Text>
                    {renderHebrewOptionButtons([
                        'כלל לא מתאמן',
                        '1-2 בשבוע',
                        '3-4 בשבוע',
                        '5-7 בשבוע'
                    ], workoutFreq, setWorkoutFreq)}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>מטרה עיקרית</Text>
                    {renderHebrewOptionButtons([
                        'ירידה במשקל',
                        'עלייה במסת שריר',
                        'שילוב מתון',
                        'אורח חיים בריא יותר'
                    ], goal, (g) => {
                        setGoal(g);
                        if (g !== 'ירידה במשקל' && g !== 'עלייה במסת שריר') {
                            setTargetPace('');
                        }
                    })}
                </View>

                {shouldShowPace && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>קצב התקדמות</Text>
                        {renderHebrewOptionButtons([
                            'מתון',
                            'בינוני',
                            'אגרסיבי'
                        ], targetPace, setTargetPace)}
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.submitButton, isGenerating && { opacity: 0.7 }]}
                    onPress={handleComplete}
                    disabled={isGenerating}
                >
                    <Text style={styles.submitButtonText}>{isGenerating ? "מנתח פרופיל (AI)..." : "בואו נתחיל"}</Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { padding: 24, paddingBottom: 60, paddingTop: 60 },
    headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8, color: '#1a1a1a', textAlign: 'right' },
    subtitle: { fontSize: 16, color: '#666', textAlign: 'right', marginTop: 8 },
    resetButton: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 },
    resetText: { color: '#ef4444', fontWeight: 'bold' },
    inputGroup: { marginBottom: 24 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#333', textAlign: 'right' },
    textInput: {
        borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 16,
        backgroundColor: '#f8fafc', color: '#1e293b', textAlign: 'right'
    },
    buttonRow: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
    buttonCol: { flexDirection: 'column', gap: 10 },
    optionButton: {
        flex: 1, minWidth: '45%', paddingVertical: 14, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
        alignItems: 'center', backgroundColor: '#f8fafc'
    },
    optionButtonCol: {
        paddingVertical: 14, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
        alignItems: 'center', backgroundColor: '#f8fafc'
    },
    optionButtonSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    optionText: { fontSize: 16, color: '#475569', fontWeight: '500', textAlign: 'center' },
    optionTextSelected: { color: '#ffffff', fontWeight: 'bold' },
    submitButton: {
        backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16,
        shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
    },
    submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
