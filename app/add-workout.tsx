import { AlertManager as Alert } from '@/components/GlobalAlert';
import { addWorkout } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { useWorkoutChatStore, WorkoutChatMessage as Message } from '@/store/useWorkoutChatStore';
import { generateWorkoutResponse } from '@/utils/ai';
import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, I18nManager, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';;

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}



export default function AddWorkoutChatScreen() {
    const user = useUserStore(state => state.user);
    const tracked = user?.trackedNutrients || {};
    const router = useRouter();
    const { messages, setMessages } = useWorkoutChatStore();
    const [inputText, setInputText] = useState('');
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const addWorkoutToLog = async (workoutData: any) => {
        try {
            await addWorkout({
                name: workoutData.name,
                duration_minutes: workoutData.duration_minutes,
                calories_burned: workoutData.calories_burned,
                description: workoutData.summary,
                timestamp: new Date().toISOString()
            });

            // Trigger background AI explanation caching without waiting
            triggerScoreExplanationUpdate();

            Alert.alert('נרשם בהצלחה!', 'האימון נוסף למעקב שלך.', [
                { text: 'הוסף אימון נוסף', style: 'cancel' },
                { text: 'עבור ליומן האימונים', onPress: () => router.replace('/(drawer)/workout-history' as any) }
            ]);
        } catch (e) {
            console.error('Error saving workout', e);
            Alert.alert('שגיאה', 'לא הצלחנו לשמור את האימון.');
        }
    };

    const pickImage = async (useCamera: boolean) => {
        setShowAttachmentMenu(false);
        let result = useCamera
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8, base64: true })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8, base64: true });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setSelectedImageUri(result.assets[0].uri);
            // In a real app we'd keep the base64 in state for the API:
            // setBase64(`data:image/jpeg;base64,${result.assets[0].base64}`); 
        }
    };

    const sendMessage = async () => {
        if (!inputText.trim() && !selectedImageUri) return;

        const sentText = inputText;
        const sentImage = selectedImageUri || undefined;

        const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: sentText || undefined, image: sentImage };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);

        setInputText('');
        setSelectedImageUri(null);
        setIsTyping(true);
        setShowAttachmentMenu(false);

        // Map complete history to native Gemini API structure
        const history: { role: 'user' | 'model', parts: { text: string }[] }[] = updatedMessages
            .filter(m => m.id !== '1' && m.id !== userMsg.id && !m.image)
            .map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text || (m.workoutData ? JSON.stringify(m.workoutData) : '') }]
            }));

        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const userWeight = user?.weight || 70;
            const aiResponse = await generateWorkoutResponse(history, sentText, userWeight);

            setIsTyping(false);

            if (aiResponse.limitReached) {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    sender: 'bot',
                    text: 'מצטער, הפעולה נכשלה. כל המודלים הגיעו למגבלת השימוש היומית שלהם. אנא נסה שוב מאוחר יותר.'
                }]);
                return;
            }

            if (aiResponse.isWorkout && aiResponse.workoutData) {
                const botMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    sender: 'bot',
                    isWorkoutCard: true,
                    text: `פענחתי את האימון בהצלחה:\n\n${aiResponse.workoutData.summary || 'מבוסס על נתונים מאומתים.'}`,
                    workoutData: aiResponse.workoutData,
                    usedModel: aiResponse.usedModel
                };
                setMessages(prev => [...prev, botMsg]);
            } else {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    sender: 'bot',
                    text: aiResponse.textResponse || 'אוקיי, הבנתי.',
                    usedModel: aiResponse.usedModel
                }]);
            }
        } catch (error) {
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                sender: 'bot',
                text: 'מצטער, חלה שגיאה בחיבור למנוע הניתוח.'
            }]);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerIcon} onPress={() => router.replace('/')}>
                        <Ionicons name="close" size={28} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>רישום אימון</Text>
                    <View style={styles.headerIcon} />
                </View>

                <View style={styles.topNavRow}>
                    <TouchableOpacity style={styles.navChip} onPress={() => router.push('/manual-workout' as any)}>
                        <Ionicons name="pencil-outline" size={18} color="#3b82f6" />
                        <Text style={styles.navChipText}>הזנה ידנית</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navChip} onPress={() => router.push('/select-workout' as any)}>
                        <Ionicons name="barbell-outline" size={18} color="#3b82f6" />
                        <Text style={styles.navChipText}>בחר מהאימונים שלי</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    ref={scrollViewRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={[styles.chatContent, { flexGrow: 1 }]}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                    keyboardShouldPersistTaps="handled"
                >
                    {messages.map(msg => (
                        <View key={msg.id} style={[styles.messageBubble, msg.sender === 'user' ? styles.userBubble : styles.botBubble]}>
                            {msg.image && <Image source={{ uri: msg.image }} style={styles.messageImage} />}
                            {msg.text && <Text style={msg.sender === 'user' ? styles.userText : styles.botText}>{msg.text}</Text>}

                            {msg.isWorkoutCard && msg.workoutData && (
                                <View style={styles.mealCard}>
                                    <View style={styles.mealCardHeader}>
                                        <Ionicons name="sparkles" size={16} color="#8b5cf6" />
                                        <Text style={styles.mealCardTitle}>Gemini AI Analysis</Text>
                                        <View style={{ flex: 1 }} />
                                    </View>
                                    <Text style={styles.mealName}>{msg.workoutData.name}</Text>

                                    <View style={styles.macrosRow}>
                                        <View style={styles.macroBadge}><Text style={styles.macroBadgeText}>{msg.workoutData.calories_burned} קק"ל נשרפו</Text></View>
                                        <View style={styles.macroBadge}><Text style={styles.macroBadgeText}>{msg.workoutData.duration_minutes} דקות</Text></View>
                                    </View>

                                    <TouchableOpacity style={styles.confirmButton} onPress={() => addWorkoutToLog(msg.workoutData)}>
                                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                                        <Text style={styles.confirmButtonText}>הוסף למעקב</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {msg.usedModel && msg.sender === 'bot' && (
                                <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 8 }}>
                                    ⚡ מודל בחירה: {msg.usedModel}
                                </Text>
                            )}
                        </View>
                    ))}
                    {isTyping && (
                        <View style={[styles.messageBubble, styles.botBubble, { paddingVertical: 12 }]}>
                            <ActivityIndicator size="small" color="#3b82f6" />
                        </View>
                    )}
                </ScrollView>

                <View style={styles.inputAreaWrapper}>
                    {selectedImageUri && (
                        <View style={styles.attachmentPreviewContainer}>
                            <Image source={{ uri: selectedImageUri }} style={styles.attachmentPreviewImage} />
                            <TouchableOpacity style={styles.removeAttachmentButton} onPress={() => setSelectedImageUri(null)}>
                                <Ionicons name="close-circle" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {showAttachmentMenu && (
                        <View style={styles.floatingMenu}>
                            <TouchableOpacity style={styles.floatingMenuItem} onPress={() => pickImage(true)}>
                                <Ionicons name="camera-outline" size={20} color="#3b82f6" />
                                <Text style={styles.floatingMenuText}>מצלמה</Text>
                            </TouchableOpacity>
                            <View style={styles.floatingMenuDivider} />
                            <TouchableOpacity style={styles.floatingMenuItem} onPress={() => pickImage(false)}>
                                <Ionicons name="image-outline" size={20} color="#3b82f6" />
                                <Text style={styles.floatingMenuText}>גלריה</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <TouchableOpacity style={styles.cameraButton} onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}>
                            <Ionicons name="camera" size={24} color="#64748b" />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.textInput}
                            placeholder="שתף עם Assistant HealthApp..."
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={sendMessage}
                            returnKeyType="send"
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, { backgroundColor: (inputText.trim() || selectedImageUri) ? '#3b82f6' : '#cbd5e1' }]}
                            onPress={sendMessage}
                            disabled={!inputText.trim() && !selectedImageUri}
                        >
                            <Ionicons name="send" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    headerIcon: { width: 40, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },

    topNavRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    navChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', gap: 6 },
    navChipText: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },

    chatContainer: { flex: 1 },
    chatContent: { padding: 16, paddingBottom: 24, gap: 16 },

    messageBubble: { maxWidth: '85%', padding: 16, borderRadius: 20 },
    userBubble: { alignSelf: 'flex-start', backgroundColor: '#3b82f6', borderBottomLeftRadius: 4 },
    botBubble: { alignSelf: 'flex-end', backgroundColor: '#fff', borderBottomRightRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },

    userText: { color: '#fff', fontSize: 16, textAlign: 'right' },
    botText: { color: '#1e293b', fontSize: 16, textAlign: 'right', lineHeight: 22 },
    messageImage: { width: 220, height: 220, borderRadius: 12, marginBottom: 8 },

    mealCard: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
    mealCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 },
    mealCardTitle: { fontSize: 13, color: '#8b5cf6', fontWeight: 'bold' },
    mealName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12, textAlign: 'right' },
    macrosRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
    macroBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    macroBadgeText: { color: '#1d4ed8', fontSize: 12, fontWeight: 'bold' },
    confirmButton: { flexDirection: 'row-reverse', backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
    confirmButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    inputAreaWrapper: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', position: 'relative' },
    attachmentPreviewContainer: { padding: 12, flexDirection: 'row-reverse', alignItems: 'center', position: 'relative' },
    attachmentPreviewImage: { width: 80, height: 80, borderRadius: 12 },
    removeAttachmentButton: { position: 'absolute', top: 6, right: 6, backgroundColor: '#fff', borderRadius: 12 },

    floatingMenu: { position: 'absolute', bottom: 70, right: 12, backgroundColor: '#fff', borderRadius: 16, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5, zIndex: 10 },
    floatingMenuItem: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 12, minWidth: 120 },
    floatingMenuText: { fontSize: 16, color: '#1e293b', fontWeight: '500' },
    floatingMenuDivider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 8 },

    inputContainer: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12, },
    cameraButton: { padding: 12, backgroundColor: '#f1f5f9', borderRadius: 24, marginLeft: 8 },
    textInput: { flex: 1, height: 48, backgroundColor: '#f1f5f9', borderRadius: 24, paddingHorizontal: 16, fontSize: 16, textAlign: 'right' },
    sendButton: { width: 48, height: 48, backgroundColor: '#3b82f6', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
});


