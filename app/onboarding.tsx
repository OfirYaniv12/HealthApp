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
        setErrorMsg('');
        Alert.alert('הנתונים אופסו', 'ניתן להתחיל מחדש.');
    };

    const handleComplete = async () => {
        setErrorMsg('');
        
        if (!fullName || !gender || !age || !height || !weight || !goal || !activityLevel || !workoutFreq || !bodyType) {
            setErrorMsg('אנא מלאו את כל השדות החובה (כולל בחירת כל האפשרויות).');
            return;
        }

        if (shouldShowPace && !targetPace) {
            setErrorMsg('אנא בחרו קצב ירידה או עלייה במשקל.');
            return;
        }

        const ageNum = parseInt(age, 10);
        const heightNum = Number(height);
        const weightNum = Number(weight);

        if (isNaN(ageNum) || isNaN(heightNum) || isNaN(weightNum)) {
            setErrorMsg('גיל, גובה ומשקל חייבים להיות מספרים תקינים.');
            return;
        }

        setIsGenerating(true);

        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || new Date().getTime().toString();

        const baseUser: UserData = {
            id: userId,
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
            daily_targets: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        };

        try {
            const plan = await generatePersonalizedPlan(baseUser);
            if (plan) {
                baseUser.daily_targets = plan.targets;
                baseUser.aiPlanExplanation = plan.explanation;
            } else {
                console.warn('AI Generation returned null, using fallbacks');
            }
        } catch (e) {
            console.error('AI Error during onboarding:', e);
            // DO NOT return here! Fallback to default values so the user is not permanently blocked from the app!
            baseUser.daily_targets = { calories: 2000, protein: 120, carbs: 200, fat: 60 };
        }

        // Save to Supabase to make sure it persists in the cloud
        if (session?.user?.id) {
            const { error: insertError } = await supabase.from('users').upsert({
                id: session.user.id,
                full_name: baseUser.full_name,
                gender: baseUser.gender,
                age: baseUser.age,
                height: baseUser.height,
                weight: baseUser.weight,
                goal: baseUser.goal,
                activity_level: baseUser.activity_level,
                workout_frequency: baseUser.workout_frequency,
                body_type: baseUser.body_type,
                target_pace: baseUser.target_pace || null,
                daily_targets: baseUser.daily_targets
            });
            if (insertError) {
                console.error("Failed to insert user profile:", insertError);
            }
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

                {errorMsg ? (
                    <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 12, fontSize: 16, fontWeight: 'bold' }}>
                        {errorMsg}
                    </Text>
                ) : null}

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
