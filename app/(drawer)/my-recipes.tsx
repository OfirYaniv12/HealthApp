import { AlertManager as Alert } from '@/components/GlobalAlert';
import { addRecipe, addRecipeCategory, deleteRecipe, getRecipeCategories, getRecipesWithCategories, Recipe, RecipeCategory, updateRecipe, updateRecipeImage } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { analyzeRecipe } from '@/utils/ai';
import { getActiveNutrients, nutrientLabelsLoc } from '@/utils/nutrients';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, I18nManager, Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';;

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function MyRecipesScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const user = useUserStore(state => state.user);

    const [categories, setCategories] = useState<RecipeCategory[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'all' | number>('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Modals
    const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
    const [categoryNameInput, setCategoryNameInput] = useState('');

    const [isRecipeModalVisible, setRecipeModalVisible] = useState(false);
    const [recipeNameInput, setRecipeNameInput] = useState('');
    const [recipeCategoryId, setRecipeCategoryId] = useState<number | null>(null);
    const [recipeIngredientsList, setRecipeIngredientsList] = useState([{ id: Date.now().toString(), amount: '', unit: '', name: '' }]);
    const [recipeInstructionsInput, setRecipeInstructionsInput] = useState('');
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    const [isManualMode, setIsManualMode] = useState(false);
    const [manualNutrients, setManualNutrients] = useState({
        calories: '', protein: '', carbs: '', fat: '', fiber: '', sodium: '', sugar: ''
    });

    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [selectedRecipeDetails, setSelectedRecipeDetails] = useState<any[] | null>(null); // ingredientBreakdown
    const [recipeTotalsModalVisible, setRecipeTotalsModalVisible] = useState(false);
    const [selectedRecipeTotals, setSelectedRecipeTotals] = useState<Recipe | null>(null);
    const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);

    // When set, the recipe window is editing this recipe instead of creating a new one
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

    const loadData = async () => {
        try {
            const cats = await getRecipeCategories();
            const recs = await getRecipesWithCategories();
            setCategories(cats);
            setRecipes(recs);
        } catch (e) {
            console.error('Failed to load my recipes', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const handleCreateCategory = async () => {
        if (!categoryNameInput.trim()) return;
        await addRecipeCategory(categoryNameInput.trim());
        setCategoryNameInput('');
        setCategoryModalVisible(false);
        loadData();
    };

    const pickImage = async (useCamera: boolean) => {
        if (useCamera) {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('שגיאה', 'אין הרשאה לשימוש במצלמה.');
                return;
            }
        }
        let result = useCamera
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8, base64: true })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8, base64: true });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setSelectedImageUri(result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : result.assets[0].uri);
        }
    };

    // ---- One window for both creating and editing a recipe ----
    const resetRecipeForm = () => {
        setEditingRecipe(null);
        setRecipeNameInput('');
        setRecipeCategoryId(null);
        setRecipeIngredientsList([{ id: Date.now().toString(), amount: '', unit: '', name: '' }]);
        setRecipeInstructionsInput('');
        setSelectedImageUri(null);
        setIsManualMode(false);
        setManualNutrients({ calories: '', protein: '', carbs: '', fat: '', fiber: '', sodium: '', sugar: '' });
    };

    const closeRecipeModal = () => {
        if (isProcessingAI) return;
        setRecipeModalVisible(false);
        resetRecipeForm();
    };

    const openCreateRecipe = () => {
        resetRecipeForm();
        setRecipeModalVisible(true);
    };

    const parseIngredientLines = (text: string) => {
        const mapped = text.split(/\\n|\n/).filter(l => l.trim()).map((l, i) => {
            const parts = l.replace(/^- /, '').trim().split(/\s+/);
            if (parts.length >= 3) return { id: `${i}-${Date.now()}`, amount: parts[0], unit: parts[1], name: parts.slice(2).join(' ') };
            if (parts.length === 2) return { id: `${i}-${Date.now()}`, amount: parts[0], unit: '', name: parts[1] };
            return { id: `${i}-${Date.now()}`, amount: '', unit: '', name: parts.join(' ') };
        });
        return mapped.length > 0 ? mapped : [{ id: Date.now().toString(), amount: '', unit: '', name: '' }];
    };

    const openEditRecipe = (item: Recipe) => {
        setEditingRecipe(item);
        setRecipeNameInput(item.name);
        setRecipeCategoryId(item.category_id);
        setRecipeInstructionsInput(item.instructions || '');
        // Photos saved from the phone as local file paths can't be shown elsewhere, so don't carry them into the form
        setSelectedImageUri(item.image_uri && !item.image_uri.startsWith('file:') ? item.image_uri : null);
        setIsManualMode(!item.nutritional_values);
        setManualNutrients({
            calories: String(item.calories ?? ''), protein: String(item.protein ?? ''), carbs: String(item.carbs ?? ''),
            fat: String(item.fat ?? ''), fiber: String(item.fiber ?? ''), sodium: String(item.sodium ?? ''), sugar: String(item.sugar ?? ''),
        });
        setRecipeIngredientsList(item.nutritional_values ? parseIngredientLines(item.ingredients_list || '') : [{ id: Date.now().toString(), amount: '', unit: '', name: '' }]);
        setRecipeModalVisible(true);
    };

    const getOrCreateCategoryId = async () => {
        if (recipeCategoryId) return recipeCategoryId;
        const existingCategories = await getRecipeCategories();
        let otherCategory = existingCategories.find(c => c.name === 'אחר');
        if (!otherCategory) otherCategory = await addRecipeCategory('אחר');
        return otherCategory.id!;
    };

    const saveImageIfChanged = async (id: number, original: string | null | undefined) => {
        const current = selectedImageUri || null;
        const originalShown = original && !original.startsWith('file:') ? original : null;
        if (current !== originalShown) await updateRecipeImage(id, current);
    };

    const handleCreateRecipe = async () => {
        const validIngredients = recipeIngredientsList.filter(i => i.amount.trim() && i.name.trim());
        if (!recipeNameInput.trim() || validIngredients.length === 0) {
            Alert.alert('שגיאה', 'יש להזין שם ולפחות מרכיב אחד למתכון.');
            return;
        }

        if (editingRecipe) {
            await handleUpdateRecipeAI(validIngredients);
            return;
        }

        setIsProcessingAI(true);
        try {
            let finalCategoryId = recipeCategoryId;

            // Auto "Other" handling
            if (!finalCategoryId) {
                const existingCategories = await getRecipeCategories();
                let otherCategory = existingCategories.find(c => c.name === 'אחר');
                if (!otherCategory) {
                    otherCategory = await addRecipeCategory('אחר');
                }
                finalCategoryId = otherCategory.id!;
            }

            const ingredientsString = validIngredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join('\\n');
            const aiAnalysis = await analyzeRecipe(recipeNameInput, validIngredients.map(i => ({ quantity: `${i.amount} ${i.unit}`.trim(), name: i.name })), recipeInstructionsInput);
            if (!aiAnalysis) throw new Error('AI parsing failed');

            const breakdownJson = JSON.stringify(aiAnalysis.ingredientBreakdown);

            const finalImageUri = selectedImageUri || null;

            await addRecipe({
                name: recipeNameInput.trim(),
                category_id: finalCategoryId,
                ingredients_list: ingredientsString,
                instructions: recipeInstructionsInput.trim() || null,
                calories: aiAnalysis.totals.calories,
                protein: aiAnalysis.totals.protein,
                carbs: aiAnalysis.totals.carbs,
                fat: aiAnalysis.totals.fat,
                fiber: aiAnalysis.totals.fiber,
                sodium: aiAnalysis.totals.sodium,
                sugar: aiAnalysis.totals.sugar,
                last_cooked_date: null,
                image_uri: finalImageUri,
                health_score: aiAnalysis.healthScore,
                nutritional_values: breakdownJson,
            });

            setRecipeNameInput('');
            setRecipeCategoryId(null);
            setRecipeIngredientsList([{ id: Date.now().toString(), amount: '', unit: '', name: '' }]);
            setRecipeInstructionsInput('');
            setSelectedImageUri(null);
            setRecipeModalVisible(false);
            loadData();
            Alert.alert('הצלחה!', 'המתכון נותח ונשמר במערכת.');
        } catch (e: any) {
            console.error('Recipe Creation Error', e);
            if (e.message === 'AI_QUOTA_EXCEEDED') {
                Alert.alert('עומס בשרת', 'מכסה השימוש ב-AI הסתיימה זמנית. נסה שוב בעוד כדקה.');
            } else {
                Alert.alert('שגיאה', 'לא ניתן לנתח מתכון זה כעת. נסה שוב.');
            }
        } finally {
            setIsProcessingAI(false);
        }
    };

    // Edit of a recipe in AI mode: re-analyze only if the ingredients changed
    const handleUpdateRecipeAI = async (validIngredients: { amount: string; unit: string; name: string }[]) => {
        const item = editingRecipe!;
        setIsProcessingAI(true);
        try {
            const categoryId = await getOrCreateCategoryId();
            const combinedIngs = validIngredients.map(i => `${i.amount} ${i.unit} ${i.name}`.replace(/\s+/g, ' ').trim()).join('\n');
            const normalize = (s: string) => s.replace(/\\n/g, '\n').split('\n').map(l => l.replace(/^- /, '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
            const ingredientsChanged = !item.nutritional_values || normalize(combinedIngs) !== normalize(item.ingredients_list || '');

            if (ingredientsChanged) {
                const aiAnalysis = await analyzeRecipe(
                    recipeNameInput.trim(),
                    validIngredients.map(i => ({ quantity: `${i.amount} ${i.unit}`.trim(), name: i.name })),
                    recipeInstructionsInput.trim() || null
                );
                if (!aiAnalysis) throw new Error('AI parsing failed');
                await updateRecipe(
                    item.id!, recipeNameInput.trim(), categoryId, combinedIngs, recipeInstructionsInput.trim() || null,
                    aiAnalysis.totals.calories, aiAnalysis.totals.protein, aiAnalysis.totals.carbs, aiAnalysis.totals.fat,
                    aiAnalysis.totals.fiber, aiAnalysis.totals.sodium, aiAnalysis.totals.sugar,
                    { nutritional_values: JSON.stringify(aiAnalysis.ingredientBreakdown), health_score: aiAnalysis.healthScore }
                );
            } else {
                await updateRecipe(
                    item.id!, recipeNameInput.trim(), categoryId, item.ingredients_list, recipeInstructionsInput.trim() || null,
                    item.calories, item.protein, item.carbs, item.fat, item.fiber, item.sodium, item.sugar
                );
            }
            await saveImageIfChanged(item.id!, item.image_uri);
            setRecipeModalVisible(false);
            resetRecipeForm();
            loadData();
        } catch (e: any) {
            console.error('Recipe update error', e);
            Alert.alert('שגיאה', e?.message === 'AI_QUOTA_EXCEEDED'
                ? 'מכסה השימוש ב-AI הסתיימה זמנית. נסה שוב בעוד כדקה.'
                : 'לא הצלחנו לעדכן את המתכון. נסה שוב.');
        } finally {
            setIsProcessingAI(false);
        }
    };

    const handleCreateRecipeManual = async () => {
        if (!recipeNameInput.trim()) {
            Alert.alert('שגיאה', 'יש להזין שם למתכון.');
            return;
        }

        if (editingRecipe) {
            const item = editingRecipe;
            const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
            try {
                const categoryId = await getOrCreateCategoryId();
                await updateRecipe(
                    item.id!, recipeNameInput.trim(), categoryId,
                    item.nutritional_values ? 'הוזן ידנית' : item.ingredients_list,
                    item.instructions || null,
                    num(manualNutrients.calories), num(manualNutrients.protein), num(manualNutrients.carbs), num(manualNutrients.fat),
                    num(manualNutrients.fiber), num(manualNutrients.sodium), num(manualNutrients.sugar),
                    // Switching an AI recipe to manual values: drop the old AI breakdown so it can't contradict them
                    item.nutritional_values ? { nutritional_values: null, health_score: null } : undefined
                );
                await saveImageIfChanged(item.id!, item.image_uri);
                setRecipeModalVisible(false);
                resetRecipeForm();
                loadData();
            } catch (e) {
                console.error('Manual recipe update error', e);
                Alert.alert('שגיאה', 'לא הצלחנו לעדכן את המתכון. נסה שוב.');
            }
            return;
        }

        try {
            let finalCategoryId = recipeCategoryId;
            if (!finalCategoryId) {
                const existingCategories = await getRecipeCategories();
                let otherCategory = existingCategories.find(c => c.name === 'אחר');
                if (!otherCategory) {
                    otherCategory = await addRecipeCategory('אחר');
                }
                finalCategoryId = otherCategory.id!;
            }

            const parseVal = (val: string) => {
                const num = parseFloat(val);
                return isNaN(num) ? 0 : num;
            };

            const finalImageUri = selectedImageUri || null;

            await addRecipe({
                name: recipeNameInput.trim(),
                category_id: finalCategoryId,
                ingredients_list: 'הוזן ידנית',
                instructions: null,
                calories: parseVal(manualNutrients.calories),
                protein: parseVal(manualNutrients.protein),
                carbs: parseVal(manualNutrients.carbs),
                fat: parseVal(manualNutrients.fat),
                fiber: parseVal(manualNutrients.fiber),
                sodium: parseVal(manualNutrients.sodium),
                sugar: parseVal(manualNutrients.sugar),
                last_cooked_date: null,
                image_uri: finalImageUri,
                health_score: null,
                nutritional_values: null,
            });

            setRecipeNameInput('');
            setRecipeCategoryId(null);
            setSelectedImageUri(null);
            setManualNutrients({ calories: '', protein: '', carbs: '', fat: '', fiber: '', sodium: '', sugar: '' });
            setRecipeModalVisible(false);
            loadData();
            Alert.alert('הצלחה!', 'המתכון נשמר במערכת.');
        } catch (e) {
            console.error('Manual Recipe Creation Error', e);
            Alert.alert('שגיאה', 'לא הצלחנו לשמור את המתכון. נסה שוב.');
        }
    };

    const handleDeleteRecipe = (id: number) => {
        Alert.alert(
            'מחיקת מתכון',
            'האם אתה בטוח שברצונך למחוק מתכון זה מלוח המתכונים שלך?',
            [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteRecipe(id);
                            loadData();
                        } catch (e) {
                            Alert.alert('שגיאה', 'לא הצלחנו למחוק את המתכון.');
                        }
                    }
                }
            ]
        );
    };

    const toggleFilters = () => {
        if (showFilters) {
            setSelectedCategoryFilter('all');
            setShowFilters(false);
        } else {
            setShowFilters(true);
        }
    };

    const filteredRecipes = recipes.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategoryFilter === 'all' || r.category_id === selectedCategoryFilter;
        return matchesSearch && matchesCategory;
    });

    const openBreakdown = (jsonStr: string | null | undefined) => {
        if (!jsonStr) return;
        try {
            const parsed = JSON.parse(jsonStr);
            // Convert to array if it is not already (handle different JSON parses)
            const arr = Array.isArray(parsed) ? parsed : Object.values(parsed);
            setSelectedRecipeDetails(arr as any[]);
            setDetailsModalVisible(true);
        } catch (e) {
            console.error("Failed to parse breakdown JSON", e);
        }
    };

    const renderRecipe = ({ item }: { item: Recipe }) => {
        const isExpanded = expandedId === item.id;
        const lastCookedStr = item.last_cooked_date ? new Date(item.last_cooked_date).toLocaleDateString('he-IL') : 'טרם בושל';

        const activeKeys = getActiveNutrients(user?.trackedNutrients);
        const top3Keys = activeKeys.slice(0, 3);

        // Calculating Totals dynamically
        let recipeTotals = { 
            calories: item.calories || 0, 
            protein: item.protein || 0, 
            carbs: item.carbs || 0, 
            fat: item.fat || 0, 
            fiber: item.fiber || 0, 
            sodium: item.sodium || 0, 
            sugar: item.sugar || 0 
        };

        if (item.nutritional_values) {
            try {
                const arr = JSON.parse(item.nutritional_values);
                const ingredients = Array.isArray(arr) ? arr : Object.values(arr);
                if (ingredients.length > 0) {
                    recipeTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 };
                    ingredients.forEach((ing: any) => {
                        recipeTotals.calories += (ing.calories || 0);
                        recipeTotals.protein += (ing.protein || 0);
                        recipeTotals.carbs += (ing.carbs || 0);
                        recipeTotals.fat += (ing.fat || 0);
                        recipeTotals.fiber += (ing.fiber || 0);
                        recipeTotals.sodium += (ing.sodium || 0);
                        recipeTotals.sugar += (ing.sugar || 0);
                    });
                }
            } catch (e) { }
        }

        return (
            <TouchableOpacity style={styles.card} onPress={() => setExpandedId(isExpanded ? null : item.id!)} activeOpacity={0.8}>
                <View style={[styles.cardHeader, { flexDirection: 'row-reverse' }]}>
                        {item.image_uri && (Platform.OS !== 'web' || !item.image_uri.startsWith('file:')) ? (
                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); setFullscreenImageUri(item.image_uri!); }}>
                                <Image source={{ uri: item.image_uri }} style={styles.recipeThumbnail} />
                            </TouchableOpacity>
                        ) : (
                            // No photo (or a phone-only photo that can't load here): tap to add one in the edit window
                            <TouchableOpacity onPress={(e) => {
                                e.stopPropagation();
                                openEditRecipe(item);
                            }} style={[styles.recipeThumbnail, { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="camera-outline" size={24} color="#cbd5e1" />
                            </TouchableOpacity>
                        )}
                        <View style={styles.cardHeaderCenter}>
                        <Text style={styles.recipeName}>{item.name}</Text>
                        <Text style={styles.recipeCategory}>{item.category_name || 'כללי'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); openEditRecipe(item); }} style={{ padding: 4 }}>
                            <Ionicons name="create-outline" size={20} color="#3b82f6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDeleteRecipe(item.id!); }} style={{ padding: 4 }}>
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {isExpanded && (
                    <View style={styles.expandedContent}>
                        <View style={styles.expandedDivider} />

                        {/* Nutrient Preview Row */}
                        <View style={styles.macroRow}>
                            {top3Keys.map(key => {
                                const val = (recipeTotals as any)[key] || 0;
                                return (
                                    <View key={key} style={[styles.macroBadge, { backgroundColor: '#f8fafc' }]}>
                                        <Text style={[styles.macroValue, { color: '#334155' }]}>{Math.round(val)}{key === 'calories' || key === 'sodium' ? '' : 'g'}</Text>
                                        <Text style={[styles.macroLabel, { color: '#64748b' }]}>{nutrientLabelsLoc[key] || key}</Text>
                                    </View>
                                )
                            })}
                            <TouchableOpacity
                                style={[styles.macroBadge, { backgroundColor: '#eff6ff' }]}
                                onPress={() => { setSelectedRecipeTotals({ ...item, ...recipeTotals } as unknown as Recipe); setRecipeTotalsModalVisible(true); }}
                            >
                                <Ionicons name="eye-outline" size={16} color="#3b82f6" />
                                <Text style={[styles.macroLabel, { color: '#3b82f6', fontWeight: 'bold' }]}>צפה בהכל</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>בושל לאחרונה:</Text>
                            <Text style={styles.detailValue}>{lastCookedStr}</Text>
                        </View>

                        {item.health_score && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>ציון בריאות AI:</Text>
                                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="star" size={14} color="#eab308" />
                                    <Text style={styles.detailValue}>{item.health_score} / 10</Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.blockContainer}>
                            <Text style={styles.detailLabelMain}>מרכיבים:</Text>
                            <Text style={styles.descText}>{item.ingredients_list.replace(/\\n/g, '\n')}</Text>
                        </View>

                        {item.instructions && (
                            <View style={styles.blockContainer}>
                                <Text style={styles.detailLabelMain}>אופן הכנה:</Text>
                                <Text style={styles.descText}>{item.instructions}</Text>
                            </View>
                        )}

                        {item.nutritional_values && (
                            <TouchableOpacity
                                style={styles.breakdownBtn}
                                onPress={() => openBreakdown(item.nutritional_values)}
                            >
                                <Text style={styles.breakdownBtnText}>פירוט ערכים</Text>
                                <Ionicons name="analytics-outline" size={18} color="#3b82f6" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>המתכונים שלי</Text>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.backButton}>
                    <Ionicons name="menu" size={32} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => setCategoryModalVisible(true)}>
                    <Text style={styles.actionBtnTextSecondary}>קטגוריה חדשה</Text>
                    <Ionicons name="folder-open-outline" size={18} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnPrimary} onPress={openCreateRecipe}>
                    <Text style={styles.actionBtnTextPrimary}>צור מתכון</Text>
                    <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="חיפוש מתכון..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <TouchableOpacity style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]} onPress={toggleFilters}>
                    <Text style={[styles.filterToggleText, showFilters && styles.filterToggleTextActive]}>סינון</Text>
                    <Ionicons name="filter-outline" size={20} color={showFilters ? '#fff' : '#3b82f6'} />
                </TouchableOpacity>
            </View>

            {showFilters && (
                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        <TouchableOpacity
                            style={[styles.filterChip, selectedCategoryFilter === 'all' && styles.filterChipActive]}
                            onPress={() => setSelectedCategoryFilter('all')}
                        >
                            <Text style={[styles.filterChipText, selectedCategoryFilter === 'all' && styles.filterChipTextActive]}>הכל</Text>
                        </TouchableOpacity>
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[styles.filterChip, selectedCategoryFilter === cat.id && styles.filterChipActive]}
                                onPress={() => setSelectedCategoryFilter(cat.id!)}
                            >
                                <Text style={[styles.filterChipText, selectedCategoryFilter === cat.id && styles.filterChipTextActive]}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {filteredRecipes.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="restaurant-outline" size={64} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>לא נמצאו מתכונים</Text>
                    <Text style={styles.emptyDesc}>לחץ על "צור מתכון" כדי להתחיל להרכיב את ספריית המתכונים האישית שלך.</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredRecipes}
                    keyExtractor={item => item.id!.toString()}
                    renderItem={renderRecipe}
                    extraData={expandedId}
                    contentContainerStyle={styles.listContent}
                />
            )}

            {/* Modal: Create Category */}
            <Modal visible={isCategoryModalVisible} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>יצירת קטגוריה חדשה</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="שם הקטגוריה (למשל: ארוחות בוקר)"
                            value={categoryNameInput}
                            onChangeText={setCategoryNameInput}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setCategoryModalVisible(false)}>
                                <Text style={styles.modalCancelText}>ביטול</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSubmit} onPress={handleCreateCategory}>
                                <Text style={styles.modalSubmitText}>שמור</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal: Create Recipe */}
            <Modal visible={isRecipeModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContentLarge}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitleLarge}>{editingRecipe ? 'עריכת מתכון' : 'מתכון חדש לספרייה'}</Text>
                            <TouchableOpacity onPress={closeRecipeModal} disabled={isProcessingAI}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row-reverse', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4, marginBottom: 16 }}>
                                <TouchableOpacity style={[styles.tabBtn, !isManualMode && styles.tabBtnActive]} onPress={() => setIsManualMode(false)}>
                                    <Ionicons name="sparkles" size={16} color={!isManualMode ? '#fff' : '#64748b'} style={{ marginLeft: 6 }} />
                                    <Text style={[styles.tabBtnText, !isManualMode && styles.tabBtnTextActive]}>ניתוח חכם (AI)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.tabBtn, isManualMode && styles.tabBtnActive]} onPress={() => setIsManualMode(true)}>
                                    <Ionicons name="create-outline" size={16} color={isManualMode ? '#fff' : '#64748b'} style={{ marginLeft: 6 }} />
                                    <Text style={[styles.tabBtnText, isManualMode && styles.tabBtnTextActive]}>הזנה ידנית</Text>
                                </TouchableOpacity>
                            </View>



                            {/* Image Upload */}
                            <View style={styles.imageSelectorRow}>
                                {selectedImageUri ? (
                                    <View style={{ position: 'relative' }}>
                                        <Image source={{ uri: selectedImageUri }} style={styles.selectedImageThumb} />
                                        <TouchableOpacity onPress={() => setSelectedImageUri(null)} style={{ position: 'absolute', top: -10, right: -10, backgroundColor: '#ef4444', borderRadius: 12, padding: 4 }}>
                                            <Ionicons name="close" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={[styles.selectedImageThumb, { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Ionicons name="image-outline" size={32} color="#94a3b8" />
                                    </View>
                                )}
                                <View style={styles.imageActions}>
                                    <TouchableOpacity style={styles.imgBtn} onPress={() => pickImage(false)} disabled={isProcessingAI}>
                                        <Ionicons name="images-outline" size={16} color="#64748b" />
                                        <Text style={styles.imgBtnText}>בחר מהגלריה</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.imgBtn} onPress={() => pickImage(true)} disabled={isProcessingAI}>
                                        <Ionicons name="camera-outline" size={16} color="#64748b" />
                                        <Text style={styles.imgBtnText}>צלם תמונה</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>שם המתכון</Text>
                            <TextInput style={styles.modalInput} placeholder="למשל: סלמון בתנור" value={recipeNameInput} onChangeText={setRecipeNameInput} editable={!isProcessingAI} />

                            <Text style={styles.inputLabel}>קטגוריה</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                                {categories.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[styles.catSelectChip, recipeCategoryId === cat.id && styles.catSelectChipActive]}
                                        onPress={() => setRecipeCategoryId(cat.id!)}
                                        disabled={isProcessingAI}
                                    >
                                        <Text style={[styles.catSelectText, recipeCategoryId === cat.id && styles.catSelectTextActive]}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {isManualMode ? (
                                <>
                                    <Text style={styles.inputLabel}>ערכים תזונתיים (לכל המתכון)</Text>
                                    <View style={{ gap: 12, marginBottom: 24, backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                        {[
                                            { key: 'calories', label: 'קלוריות (קק״ל)' },
                                            { key: 'protein', label: 'חלבון (גרם)' },
                                            { key: 'carbs', label: 'פחמימות (גרם)' },
                                            { key: 'fat', label: 'שומן (גרם)' },
                                            { key: 'fiber', label: 'סיבים (גרם)' },
                                            { key: 'sodium', label: 'נתרן (מ״ג)' },
                                            { key: 'sugar', label: 'סוכר (גרם)' }
                                        ].map((nut) => (
                                            <View key={nut.key} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                                                <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, color: '#334155', fontWeight: '600' }}>{nut.label}</Text>
                                                <TextInput
                                                    style={[styles.modalInput, { flex: 2, marginBottom: 0, backgroundColor: '#fff' }]}
                                                    placeholder="0"
                                                    keyboardType="decimal-pad"
                                                    value={(manualNutrients as any)[nut.key]}
                                                    onChangeText={(val) => setManualNutrients(prev => ({ ...prev, [nut.key]: val }))}
                                                />
                                            </View>
                                        ))}
                                    </View>
                                    <TouchableOpacity style={[styles.fullSubmitBtn, { backgroundColor: '#10b981' }]} onPress={handleCreateRecipeManual}>
                                        <Text style={styles.fullSubmitText}>{editingRecipe ? 'שמור שינויים' : 'שמור מתכון (ידני)'}</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.inputLabel}>רשימת מרכיבים *חובה (תנותח ע"י AI)</Text>
                                    {recipeIngredientsList.map((ingredient, index) => (
                                        <View key={ingredient.id} style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 12 }}>
                                            <TextInput
                                                style={[styles.modalInput, { flex: 1.5, minWidth: 0, marginBottom: 0 }]}
                                                placeholder="שם (למשל: חזה עוף)"
                                                value={ingredient.name}
                                                onChangeText={(val) => {
                                                    const newList = [...recipeIngredientsList];
                                                    newList[index].name = val;
                                                    setRecipeIngredientsList(newList);
                                                }}
                                                editable={!isProcessingAI}
                                            />
                                            <TextInput
                                                style={[styles.modalInput, { flex: 0.8, minWidth: 0, marginBottom: 0, paddingHorizontal: 8 }]}
                                                placeholder="כמות"
                                                value={ingredient.amount}
                                                onChangeText={(val) => {
                                                    const newList = [...recipeIngredientsList];
                                                    newList[index].amount = val;
                                                    setRecipeIngredientsList(newList);
                                                }}
                                                editable={!isProcessingAI}
                                                keyboardType="decimal-pad"
                                            />
                                            <TextInput
                                                style={[styles.modalInput, { flex: 0.8, minWidth: 0, marginBottom: 0, paddingHorizontal: 8 }]}
                                                placeholder="יחידה"
                                                value={ingredient.unit}
                                                onChangeText={(val) => {
                                                    const newList = [...recipeIngredientsList];
                                                    newList[index].unit = val;
                                                    setRecipeIngredientsList(newList);
                                                }}
                                                editable={!isProcessingAI}
                                            />
                                            {recipeIngredientsList.length > 1 && (
                                                <TouchableOpacity
                                                    style={{ justifyContent: 'center', alignItems: 'center', padding: 8 }}
                                                    onPress={() => setRecipeIngredientsList(recipeIngredientsList.filter(i => i.id !== ingredient.id))}
                                                    disabled={isProcessingAI}
                                                >
                                                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 16 }}
                                        onPress={() => setRecipeIngredientsList([...recipeIngredientsList, { id: Date.now().toString(), amount: '', unit: '', name: '' }])}
                                        disabled={isProcessingAI}
                                    >
                                        <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
                                        <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>הוסף מרכיב</Text>
                                    </TouchableOpacity>

                                    <Text style={styles.inputLabel}>אופן הכנה (רשות)</Text>
                                    <TextInput
                                        style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                                        placeholder="למשל: מערבבים הכל ומכניסים לתנור ל-20 דק..."
                                        value={recipeInstructionsInput}
                                        onChangeText={setRecipeInstructionsInput}
                                        multiline
                                        editable={!isProcessingAI}
                                    />

                                    <TouchableOpacity style={styles.fullSubmitBtn} onPress={handleCreateRecipe} disabled={isProcessingAI}>
                                        {isProcessingAI ? (
                                            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                                                <ActivityIndicator size="small" color="#fff" />
                                                <Text style={styles.fullSubmitText}>{editingRecipe ? 'שומר...' : 'מנתח פקודות ב-AI...'}</Text>
                                            </View>
                                        ) : (
                                            <Text style={styles.fullSubmitText}>{editingRecipe ? 'שמור שינויים' : 'שמור מתכון ונתח'}</Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                            <View style={{ height: 200 }} />
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal: View All Totals Map */}
            <Modal visible={recipeTotalsModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 16 }]}>סך הכל ערכים</Text>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                            {selectedRecipeTotals && (() => {
                                const activeKeys = getActiveNutrients(user?.trackedNutrients);
                                return activeKeys.map((key) => {
                                    const val = (selectedRecipeTotals as any)[key] || 0;
                                    const unit = key === 'calories' || key === 'sodium' ? '' : ' גרם';
                                    return (
                                        <View key={key} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 12, backgroundColor: '#f8fafc', borderRadius: 8 }}>
                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>{nutrientLabelsLoc[key] || key}</Text>
                                            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                                                <Text style={{ fontSize: 16, color: '#0f172a', fontWeight: 'bold' }}>{Math.round(val)}</Text>
                                                <Text style={{ fontSize: 16, color: '#0f172a', fontWeight: '500' }}>{unit}</Text>
                                            </View>
                                        </View>
                                    );
                                });
                            })()}
                        </ScrollView>
                        <TouchableOpacity style={[styles.fullSubmitBtn, { marginTop: 24 }]} onPress={() => setRecipeTotalsModalVisible(false)}>
                            <Text style={styles.fullSubmitText}>סגור</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal: Ingredient Breakdown */}
            <Modal visible={detailsModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 20, fontSize: 22 }]}>פירוט ערכים</Text>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                            {selectedRecipeDetails && selectedRecipeDetails.map((ing, idx) => {
                                const activeKeys = getActiveNutrients(user?.trackedNutrients);

                                const cleanName = ing.name.replace(/[a-zA-Z]/g, '').replace(/[()\-]/g, ' ').replace(/\s+/g, ' ').trim() || ing.name;

                                return (
                                    <View key={idx} style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a', textAlign: 'right', marginBottom: 12 }}>{cleanName}</Text>
                                        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                                            {activeKeys.map(key => {
                                                const val = (ing as any)[key] || 0;
                                                const unit = key === 'calories' || key === 'sodium' ? '' : 'גרם';
                                                return (
                                                    <View key={key} style={{ backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', flexDirection: 'row-reverse', gap: 4, alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 14, color: '#334155', fontWeight: 'bold' }}>{Math.round(val)}</Text>
                                                        {unit ? <Text style={{ fontSize: 14, color: '#334155', fontWeight: '500' }}>{unit}</Text> : null}
                                                        <Text style={{ fontSize: 14, color: '#334155', fontWeight: '500' }}>{nutrientLabelsLoc[key] || key}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                        <TouchableOpacity style={[styles.fullSubmitBtn, { marginTop: 24 }]} onPress={() => setDetailsModalVisible(false)}>
                            <Text style={styles.fullSubmitText}>סגור</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal: AI Generating Loading Spinner */}
            <Modal visible={isGeneratingImage} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { alignItems: 'center', padding: 32 }]}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={{ marginTop: 16, fontSize: 16, fontWeight: 'bold', color: '#10b981' }}>מייצר תמונה ב-AI...</Text>
                        <Text style={{ marginTop: 4, fontSize: 14, color: '#64748b' }}>זה עשוי לקחת כמה שניות</Text>
                    </View>
                </View>
            </Modal>

            {/* Modal: Fullscreen Image Preview */}
            <Modal visible={!!fullscreenImageUri} transparent animationType="fade">
                <View style={styles.fullscreenImageOverlay}>
                    <TouchableOpacity style={styles.fullscreenImageClose} onPress={() => setFullscreenImageUri(null)}>
                        <Ionicons name="close-circle" size={40} color="#fff" />
                    </TouchableOpacity>
                    {fullscreenImageUri ? (
                        <Image source={{ uri: fullscreenImageUri }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
                    ) : null}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },

    actionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff' },
    actionBtnPrimary: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
    actionBtnTextPrimary: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    actionBtnSecondary: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
    actionBtnTextSecondary: { color: '#3b82f6', fontWeight: 'bold', fontSize: 15 },

    searchRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
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

    tabBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
    tabBtnActive: { backgroundColor: '#3b82f6' },
    tabBtnText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    tabBtnTextActive: { color: '#fff' },

    listContent: { padding: 16, gap: 12 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
    cardHeader: { flexDirection: 'row-reverse', alignItems: 'center' },
    cardHeaderCenter: { flex: 1, paddingRight: 12 },
    recipeThumbnail: { width: 80, height: 80, borderRadius: 12 },
    recipeName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    recipeCategory: { fontSize: 13, color: '#3b82f6', marginTop: 4, textAlign: 'right', fontWeight: '600' },

    expandedContent: { marginTop: 16 },
    expandedDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },

    macroRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 16 },
    macroBadge: { padding: 8, borderRadius: 12, alignItems: 'center', width: '23%' },
    macroValue: { fontSize: 16, fontWeight: 'bold' },
    macroLabel: { fontSize: 12, marginTop: 2 },

    detailRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 14, color: '#64748b', fontWeight: '500', textAlign: 'right' },
    detailLabelMain: { fontSize: 15, color: '#1e293b', fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
    detailValue: { fontSize: 14, color: '#1e293b', fontWeight: 'bold' },

    blockContainer: { marginTop: 12, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
    descText: { fontSize: 14, color: '#334155', textAlign: 'right', lineHeight: 22 },

    breakdownBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', padding: 12, borderRadius: 8, marginTop: 16, gap: 8 },
    breakdownBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 16, marginBottom: 8, textAlign: 'center' },
    emptyDesc: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 24 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    modalContentLarge: { backgroundColor: '#fff', borderRadius: 20, padding: 24, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 16 },
    modalTitleLarge: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },

    inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, textAlign: 'right' },
    modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16, textAlign: 'right', marginBottom: 16, color: '#1e293b' },

    modalActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
    modalCancel: { flex: 1, padding: 14, alignItems: 'center' },
    modalCancelText: { color: '#64748b', fontWeight: 'bold', fontSize: 16 },
    modalSubmit: { flex: 1, backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, alignItems: 'center' },
    modalSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    fullSubmitBtn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
    fullSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    catSelectChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    catSelectChipActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
    catSelectText: { color: '#64748b', fontWeight: '500', fontSize: 14 },
    catSelectTextActive: { color: '#2563eb', fontWeight: 'bold' },

    imageSelectorRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 20, gap: 16 },
    selectedImageThumb: { width: 80, height: 80, borderRadius: 16 },
    imageActions: { flex: 1, gap: 8 },
    imgBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 8, borderRadius: 8, gap: 6 },
    imgBtnText: { color: '#475569', fontSize: 13, fontWeight: '500' },

    breakdownRow: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 8 },
    breakdownName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 6 },
    breakdownMacros: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    bMacro: { fontSize: 13, color: '#64748b' },

    inlineInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'right', color: '#1e293b', marginBottom: 16 },
    removeIngredientBtn: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    textArea: { height: 100, textAlignVertical: 'top' },

    fullscreenImageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    fullscreenImageClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
    fullscreenImage: { width: '100%', height: '80%' }
});
