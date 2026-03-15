import { addMeal, getRecipeCategories, getRecipesWithCategories, Recipe, RecipeCategory, updateRecipeLastCooked } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { generateNutritionResponse } from '@/utils/ai';
import { getActiveNutrients, nutrientLabelsLoc } from '@/utils/nutrients';
import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, I18nManager, Image, KeyboardAvoidingView,
    Modal,
    Platform, SafeAreaView, ScrollView,
    StyleSheet,
    Text, TextInput,
    TouchableOpacity, View
} from 'react-native';

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

type Message = {
    id: string;
    sender: 'user' | 'bot';
    text?: string;
    image?: string;
    isMealCard?: boolean;
    mealData?: { name: string; calories: number; protein: number; carbs: number; fat: number; fiber?: number; sodium?: number; sugar?: number; summary?: string };
};

export default function AddMealChatScreen() {
    const user = useUserStore(state => state.user);
    const tracked = user?.trackedNutrients || {};
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', sender: 'bot', text: 'היי! אני עוזר התזונה מבוסס ה-AI של HealthApp. מה אכלת היום?' }
    ]);
    const [inputText, setInputText] = useState('');
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    // Recipes Selection State
    const [recipeModalVisible, setRecipeModalVisible] = useState(false);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [categories, setCategories] = useState<RecipeCategory[]>([]);
    const [recipeSearchQuery, setRecipeSearchQuery] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [showCategories, setShowCategories] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [recipeModModalVisible, setRecipeModModalVisible] = useState(false);
    const [expandedRecipeId, setExpandedRecipeId] = useState<number | null>(null);
    const [recipeMods, setRecipeMods] = useState('');

    const loadRecipes = async () => {
        const r = await getRecipesWithCategories();
        const c = await getRecipeCategories();
        setRecipes(r);
        setCategories(c);
    };

    useEffect(() => {
        if (recipeModalVisible) {
            loadRecipes();
        }
    }, [recipeModalVisible]);

    const addFoodToLog = async (mealData: any, skipAlert: boolean = false) => {
        try {
            await addMeal({
                name: mealData.name,
                calories: mealData.calories,
                protein: mealData.protein,
                fat: mealData.fat,
                carbs: mealData.carbs,
                fiber: mealData.fiber || 0,
                sodium: mealData.sodium || 0,
                sugar: mealData.sugar || 0,
                timestamp: new Date().toISOString()
            });

            // Trigger background AI explanation caching without waiting
            triggerScoreExplanationUpdate();

            if (skipAlert) {
                router.replace('/');
            } else {
                Alert.alert('נרשם בהצלחה!', 'הארוחה נוספה למעקב היומי שלך.', [
                    { text: 'הוסף מאכל נוסף', style: 'cancel' },
                    { text: 'עבור ליומן הארוחות', onPress: () => router.replace('/daily-log') }
                ]);
            }
        } catch (e) {
            console.error('Error saving meal', e);
            Alert.alert('שגיאה', 'לא הצלחנו לשמור את הארוחה.');
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
            .filter(m => m.id !== '1' && m.id !== userMsg.id && !m.image) // Exclude initial greeting & current message
            .map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text || (m.mealData ? JSON.stringify(m.mealData) : '') }]
            }));

        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            // Note: In Expo, fetching base64 from a URI requires FileSystem. 
            // For MVP LLM Vision, image processing should ideally be passed along here. 
            // To prevent blocking, we just pass the text for this simulation build, or mock it.
            const aiResponse = await generateNutritionResponse(history, sentText);

            setIsTyping(false);

            if (aiResponse.isMeal && aiResponse.mealData) {
                const botMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    sender: 'bot',
                    isMealCard: true,
                    text: `פענחתי את הארוחה בהצלחה באמצעות מנוע הערכת התזונה:\n\n${aiResponse.mealData.summary || 'מבוסס על נתונים מאומתים וניתוח סמנטי.'}`,
                    mealData: aiResponse.mealData
                };
                setMessages(prev => [...prev, botMsg]);
            } else {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    sender: 'bot',
                    text: aiResponse.textResponse || 'אוקיי, הבנתי.'
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

    const handleConfirmRecipe = async () => {
        if (!selectedRecipe) return;
        setRecipeModModalVisible(false);
        setRecipeModalVisible(false);

        try {
            await updateRecipeLastCooked(selectedRecipe.id!, new Date().toISOString());
        } catch (e) { console.error("Failed to update last cooked", e); }

        if (!recipeMods.trim() && selectedRecipe.nutritional_values) {
            // No mods, just add the base recipe totals
            try {
                let calcTotals: any = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 };
                const arr = JSON.parse(selectedRecipe.nutritional_values);
                const ings = Array.isArray(arr) ? arr : Object.values(arr);
                ings.forEach((ing: any) => {
                    calcTotals.calories += (ing.calories || 0);
                    calcTotals.protein += (ing.protein || 0);
                    calcTotals.carbs += (ing.carbs || 0);
                    calcTotals.fat += (ing.fat || 0);
                    calcTotals.fiber += (ing.fiber || 0);
                    calcTotals.sodium += (ing.sodium || 0);
                    calcTotals.sugar += (ing.sugar || 0);
                });

                await addFoodToLog({
                    name: selectedRecipe.name,
                    ...calcTotals
                }, true);
            } catch (e) {
                Alert.alert('שגיאה', 'לא ניתן לקרוא את ערכי המתכון הבסיסיים.');
            }
        } else {
            // Recalculate via Gemini and Auto-Log
            setIsTyping(true);
            const prompt = `הוספתי את המתכון: "${selectedRecipe.name}". מרכיבים מקוריים:\n${selectedRecipe.ingredients_list}\n\nהשינויים שעשיתי לארוחה זו:\n${recipeMods}\n\nאנא התייחס למרכיבים המקוריים, החסר או הוסף לפי השינויים שציינתי, והחזר JSON תקני של הארוחה (isMeal: true) עם סך הכל הקלוריות והערכים התזונתיים עבור מה שאכלתי בפועל.`;

            setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: `מתכון מותאם: ${selectedRecipe.name}\nשינויים: ${recipeMods}` }]);

            const history = [{ role: 'user' as const, parts: [{ text: prompt }] }];
            try {
                const aiResponse = await generateNutritionResponse(history, prompt);
                setIsTyping(false);
                if (aiResponse.isMeal && aiResponse.mealData) {
                    await addFoodToLog(aiResponse.mealData, true);
                } else {
                    Alert.alert('שגיאה', 'מנוע ה-AI לא הצליח לנתח את השינויים ולשמור כארוחה.');
                }
            } catch (error) {
                setIsTyping(false);
                Alert.alert('שגיאה בתקשורת', 'החיבור למנוע הניתוח נכשל.');
            }
        }
        setRecipeMods('');
        setSelectedRecipe(null);
    };

    const filteredRecipes = recipes.filter(r => {
        const matchesCat = selectedCategoryId ? r.category_id === selectedCategoryId : true;
        const matchesSearch = r.name.includes(recipeSearchQuery);
        return matchesCat && matchesSearch;
    });

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerIcon} onPress={() => router.replace('/')}>
                        <Ionicons name="close" size={28} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}></Text>
                    <View style={styles.headerIcon} />
                </View>

                <View style={styles.topNavRow}>
                    <TouchableOpacity style={styles.navChip} onPress={() => router.push('/manual-entry')}>
                        <Ionicons name="pencil-outline" size={18} color="#3b82f6" />
                        <Text style={styles.navChipText}>הזנה ידנית</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navChip} onPress={() => setRecipeModalVisible(true)}>
                        <Ionicons name="restaurant-outline" size={18} color="#3b82f6" />
                        <Text style={styles.navChipText}>מהמתכונים שלי</Text>
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

                            {msg.isMealCard && msg.mealData && (
                                <View style={styles.mealCard}>
                                    <View style={styles.mealCardHeader}>
                                        <Ionicons name="sparkles" size={16} color="#8b5cf6" />
                                        <Text style={styles.mealCardTitle}>Gemini AI Analysis</Text>
                                        <View style={{ flex: 1 }} />
                                    </View>
                                    <Text style={styles.mealName}>{msg.mealData.name}</Text>

                                    <View style={styles.macrosRow}>
                                        <View style={styles.macroBadge}><Text style={styles.macroBadgeText}>{msg.mealData.calories} קק"ל</Text></View>
                                        <View style={styles.macroBadge}><Text style={styles.macroBadgeText}>{msg.mealData.protein}g חלבון</Text></View>
                                        <View style={styles.macroBadge}><Text style={styles.macroBadgeText}>{msg.mealData.carbs}g פחמ'</Text></View>
                                        <View style={styles.macroBadge}><Text style={styles.macroBadgeText}>{msg.mealData.fat}g שומן</Text></View>
                                        {tracked.fiber && msg.mealData.fiber !== undefined && <View style={styles.macroBadge}><Text style={styles.macroBadgeText}>{msg.mealData.fiber}g סיבים</Text></View>}
                                        {tracked.sodium && msg.mealData.sodium !== undefined && <View style={styles.macroBadge}><Text style={styles.macroBadgeText}>{msg.mealData.sodium}mg נתרן</Text></View>}
                                        {tracked.sugar && msg.mealData.sugar !== undefined && <View style={styles.macroBadge}><Text style={styles.macroBadgeText}>{msg.mealData.sugar}g סוכר</Text></View>}
                                    </View>

                                    <TouchableOpacity style={styles.confirmButton} onPress={() => addFoodToLog(msg.mealData)}>
                                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                                        <Text style={styles.confirmButtonText}>הוסף ליומן</Text>
                                    </TouchableOpacity>
                                </View>
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

                {/* --- Recipe Selection Modal --- */}
                <Modal visible={recipeModalVisible} animationType="slide">
                    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 }}>
                        <View style={styles.header}>
                            <TouchableOpacity style={styles.headerIcon} onPress={() => { setRecipeModalVisible(false); setSelectedRecipe(null); setRecipeMods(''); }}>
                                <Ionicons name="close" size={28} color="#1e293b" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>המתכונים שלי</Text>
                            <View style={styles.headerIcon} />
                        </View>

                        <View style={styles.searchRow}>
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="חיפוש מתכון..."
                                    value={recipeSearchQuery}
                                    onChangeText={setRecipeSearchQuery}
                                />
                            </View>
                            <TouchableOpacity
                                style={[styles.filterToggleBtn, showCategories && styles.filterToggleBtnActive]}
                                onPress={() => setShowCategories(!showCategories)}
                            >
                                <Ionicons name="filter" size={18} color={showCategories ? "#fff" : "#3b82f6"} />
                                <Text style={[styles.filterToggleText, showCategories && styles.filterToggleTextActive]}>סינון</Text>
                            </TouchableOpacity>
                        </View>

                        {showCategories && (
                            <View style={styles.filterContainer}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                                    <TouchableOpacity
                                        style={[styles.filterChip, selectedCategoryId === null && styles.filterChipActive]}
                                        onPress={() => setSelectedCategoryId(null)}
                                    >
                                        <Text style={[styles.filterChipText, selectedCategoryId === null && styles.filterChipTextActive]}>הכל</Text>
                                    </TouchableOpacity>
                                    {categories.map(cat => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            style={[styles.filterChip, selectedCategoryId === cat.id && styles.filterChipActive]}
                                            onPress={() => setSelectedCategoryId(cat.id!)}
                                        >
                                            <Text style={[styles.filterChipText, selectedCategoryId === cat.id && styles.filterChipTextActive]}>{cat.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                            {filteredRecipes.map(item => {
                                const isExpanded = expandedRecipeId === item.id;

                                const activeKeys = getActiveNutrients(user?.trackedNutrients);
                                const top3Keys = activeKeys.slice(0, 3);
                                let recipeTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 };
                                let ingredientsArr: any[] = [];
                                if (item.nutritional_values) {
                                    try {
                                        const arr = JSON.parse(item.nutritional_values);
                                        ingredientsArr = Array.isArray(arr) ? arr : Object.values(arr);
                                        ingredientsArr.forEach((ing: any) => {
                                            recipeTotals.calories += (ing.calories || 0);
                                            recipeTotals.protein += (ing.protein || 0);
                                            recipeTotals.carbs += (ing.carbs || 0);
                                            recipeTotals.fat += (ing.fat || 0);
                                            recipeTotals.fiber += (ing.fiber || 0);
                                            recipeTotals.sodium += (ing.sodium || 0);
                                            recipeTotals.sugar += (ing.sugar || 0);
                                        });
                                    } catch (e) { }
                                }

                                return (
                                    <TouchableOpacity key={item.id} style={styles.recipeCard} onPress={() => setExpandedRecipeId(isExpanded ? null : item.id!)} activeOpacity={0.8}>
                                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                                            {item.image_uri ? (
                                                <Image source={{ uri: item.image_uri }} style={styles.recipeThumbnail} />
                                            ) : (
                                                <View style={[styles.recipeThumbnail, { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }]}>
                                                    <Ionicons name="restaurant-outline" size={24} color="#cbd5e1" />
                                                </View>
                                            )}
                                            <View style={{ flex: 1, paddingRight: 12 }}>
                                                <Text style={styles.recipeName}>{item.name}</Text>
                                                <Text style={styles.recipeCategory}>{item.category_name || 'כללי'}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.selectRecipeBtn, { backgroundColor: '#10b981' }]}
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedRecipe(item);
                                                    setRecipeModModalVisible(true);
                                                }}
                                            >
                                                <Text style={styles.selectRecipeBtnText}>בחר</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {isExpanded && (
                                            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 }}>
                                                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                                    {top3Keys.map(key => {
                                                        const val = (recipeTotals as any)[key] || 0;
                                                        return (
                                                            <View key={key} style={{ backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                                                                <Text style={{ fontSize: 13, color: '#334155' }}><Text style={{ fontWeight: 'bold' }}>{Math.round(val)}</Text> {nutrientLabelsLoc[key] || key}</Text>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                                <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 8 }}>מרכיבים:</Text>
                                                {ingredientsArr.length > 0 ? ingredientsArr.map((ing, idx) => {
                                                    const cleanName = ing.name.replace(/[a-zA-Z]/g, '').replace(/[()\-]/g, ' ').replace(/\s+/g, ' ').trim() || ing.name;
                                                    return (
                                                        <View key={idx} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                                                            <Text style={{ fontSize: 14, color: '#334155', flex: 1, textAlign: 'right' }}>{cleanName}</Text>
                                                        </View>
                                                    )
                                                }) : (
                                                    <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'right' }}>{item.ingredients_list.replace(/\\n/g, '\n')}</Text>
                                                )}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )
                            })}
                            {filteredRecipes.length === 0 && (
                                <View style={{ alignItems: 'center', marginTop: 32 }}>
                                    <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                                    <Text style={{ fontSize: 16, color: '#64748b', marginTop: 16 }}>לא נמצאו מתכונים תואמים.</Text>
                                </View>
                            )}
                        </ScrollView>

                        {/* Inline Changes Prompt Over The Content */}
                        {recipeModModalVisible && selectedRecipe && (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', padding: 24, zIndex: 1000 }]}>
                                <View style={styles.modalContent}>
                                    <Text style={styles.modalTitle}>האם בוצעו שינויים?</Text>
                                    <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 }}>
                                        (אופציונלי) אם אכלת בדיוק את המתכון, תן לאישור לעשות את העבודה. אם שינית משהו, תכתוב כאן...
                                    </Text>
                                    <TextInput
                                        style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                                        multiline
                                        placeholder="לדוגמה: אכלתי רק חצי מנה, הוספתי 2 ביצים במקום 1..."
                                        value={recipeMods}
                                        onChangeText={setRecipeMods}
                                    />
                                    <View style={{ flexDirection: 'row-reverse', gap: 12, marginTop: 16 }}>
                                        <TouchableOpacity style={[styles.confirmButton, { flex: 1 }]} onPress={handleConfirmRecipe}>
                                            <Text style={styles.confirmButtonText}>אישור</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.cancelButton, { flex: 1 }]} onPress={() => { setRecipeModModalVisible(false); setSelectedRecipe(null); }}>
                                            <Text style={styles.cancelButtonText}>ביטול</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}
                    </SafeAreaView>
                </Modal>



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

    /* Selection Modal Styles */
    searchRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8, paddingTop: 16 },
    searchContainer: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    searchIcon: { marginLeft: 8 },
    searchInput: { flex: 1, height: 44, textAlign: 'right', fontSize: 15, color: '#1e293b' },
    filterToggleBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 16, height: 44, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    filterToggleBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    filterToggleText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },
    filterToggleTextActive: { color: '#fff' },
    filterContainer: { backgroundColor: '#fff', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    filterScroll: { paddingHorizontal: 16, gap: 8, flexDirection: 'row-reverse' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    filterChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    filterChipText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
    filterChipTextActive: { color: '#fff' },
    recipeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
    recipeThumbnail: { width: 56, height: 56, borderRadius: 12 },
    recipeName: { fontSize: 17, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    recipeCategory: { fontSize: 13, color: '#3b82f6', marginTop: 4, textAlign: 'right', fontWeight: '600' },
    selectRecipeBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    selectRecipeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', padding: 24, zIndex: 1000 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 12, textAlign: 'center' },
    modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 16, color: '#1e293b', textAlign: 'right', marginBottom: 16 },
    cancelButton: { backgroundColor: '#f1f5f9', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    cancelButtonText: { color: '#64748b', fontWeight: 'bold', fontSize: 16 }
});
