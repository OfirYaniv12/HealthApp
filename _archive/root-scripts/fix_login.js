const fs = require('fs');

const code = `import { AlertManager as Alert } from '@/components/GlobalAlert';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, I18nManager } from 'react-native';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/store/useUserStore';

// Force RTL
if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRegister, setIsRegister] = useState(false);
    const router = useRouter();

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('שגיאה', 'אנא הזן אימייל וסיסמה');
            return;
        }

        setLoading(true);
        
        if (isRegister) {
            // Registration Flow
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                Alert.alert('שגיאת הרשמה', error.message);
                setLoading(false);
                return;
            }

            if (data?.session) {
                // Instantly logged in (email confirmation disabled)
                router.replace('/onboarding' as any);
            } else {
                // Email confirmation required or automatic login failed
                Alert.alert('הרשמה בוצעה בהצלחה!', 'אנא בדוק את תיבת המייל שלך (כולל דואר זבל) לאימות החשבון. לאחר מכן, התחבר.');
                setIsRegister(false);
            }
            setLoading(false);

        } else {
            // Login Flow
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                Alert.alert('שגיאת התחברות', 'אימייל או סיסמה שגויים');
                setLoading(false);
                return;
            }

            // Fetch user data from Supabase users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (userData && !userError) {
                useUserStore.getState().setUser(userData);
                router.replace('/(drawer)' as any);
            } else {
                router.replace('/onboarding' as any);
            }
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.container}>
                <Text style={styles.title}>{isRegister ? 'יצירת חשבון' : 'ברוכים הבאים'}</Text>
                <Text style={styles.subtitle}>{isRegister ? 'הרשמה לחשבון חדש באפליקציה' : 'התחברות לחשבון הענן שלך'}</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>אימייל</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>סיסמה</Text>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegister ? 'הרשם' : 'התחברות'}</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setIsRegister(!isRegister)}>
                    <Text style={{ color: '#3b82f6', textAlign: 'center', fontSize: 15 }}>
                        {isRegister ? 'כבר יש לך חשבון? התחבר כאן' : 'אין לך חשבון? הרשם כאן'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
    title: { fontSize: 32, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, textAlign: 'right' },
    subtitle: { fontSize: 16, color: '#64748b', marginBottom: 32, textAlign: 'right' },
    inputContainer: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, textAlign: 'right' },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 16, textAlign: 'right' },
    button: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
`;

fs.writeFileSync('app/login.tsx', code, 'utf-8');
