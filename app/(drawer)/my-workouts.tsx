import { addWorkoutCategory, addWorkoutTemplate, deleteWorkoutTemplate, getWorkoutCategories, getWorkoutTemplates, WorkoutCategory, WorkoutTemplate } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, I18nManager, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
}

export default function MyWorkoutsScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const user = useUserStore(state => state.user);

    const [categories, setCategories] = useState<WorkoutCategory[]>([]);
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'all' | number>('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
    const [categoryNameInput, setCategoryNameInput] = useState('');

    const [isTemplateModalVisible, setTemplateModalVisible] = useState(false);
    const [templateNameInput, setTemplateNameInput] = useState('');
    const [templateCategoryId, setTemplateCategoryId] = useState<number | null>(null);
    const [templateDescInput, setTemplateDescInput] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const loadData = async () => {
        try {
            const cats = await getWorkoutCategories();
            const temps = await getWorkoutTemplates();
            setCategories(cats);
            setTemplates(temps);
        } catch (e) {
            console.error('Failed to load my workouts', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const handleCreateCategory = async () => {
        if (!categoryNameInput.trim()) return;
        await addWorkoutCategory(categoryNameInput.trim());
        setCategoryNameInput('');
        setCategoryModalVisible(false);
        loadData();
    };

    const handleCreateTemplate = async () => {
        if (!templateNameInput.trim() || !templateCategoryId) {
            Alert.alert('שגיאה', 'יש להזין שם אימון ולבחור קטגוריה.');
            return;
        }
        await addWorkoutTemplate({
            name: templateNameInput.trim(),
            category_id: templateCategoryId,
            description: templateDescInput.trim() || null,
        });
        setTemplateNameInput('');
        setTemplateCategoryId(null);
        setTemplateDescInput('');
        setTemplateModalVisible(false);
        loadData();
    };

    const handleDeleteTemplate = (id: number) => {
        Alert.alert(
            'מחיקת תבנית',
            'האם אתה בטוח שברצונך למחוק תבנית זו?',
            [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteWorkoutTemplate(id);
                            loadData();
                        } catch (e) {
                            console.error('Failed to delete template:', e);
                            Alert.alert('שגיאה', 'לא הצלחנו למחוק את התבנית.');
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

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategoryFilter === 'all' || t.category_id === selectedCategoryFilter;
        return matchesSearch && matchesCategory;
    });

    const renderTemplate = ({ item }: { item: WorkoutTemplate }) => {
        const isExpanded = expandedId === item.id;
        const lastPerformedStr = item.last_performed_date ? new Date(item.last_performed_date).toLocaleDateString('he-IL') : 'טרם בוצע';

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => setExpandedId(isExpanded ? null : item.id!)}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.templateName}>{item.name}</Text>
                        <Text style={styles.templateCategory}>{item.category_name || 'כללי'}</Text>
                    </View>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDeleteTemplate(item.id!); }} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                </View>

                {isExpanded && (
                    <View style={styles.expandedContent}>
                        <View style={styles.expandedDivider} />
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>בוצע לאחרונה:</Text>
                            <Text style={styles.detailValue}>{lastPerformedStr}</Text>
                        </View>
                        {item.description && (
                            <View style={styles.descContainer}>
                                <Text style={styles.detailLabel}>פירוט הוצאה / תרגילים:</Text>
                                <Text style={styles.descText}>{item.description}</Text>
                            </View>
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
                <Text style={styles.headerTitle}>האימונים שלי</Text>
                <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.backButton}>
                    <Ionicons name="menu" size={32} color="#1e293b" />
                </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => setCategoryModalVisible(true)}>
                    <Ionicons name="folder-open-outline" size={18} color="#3b82f6" />
                    <Text style={styles.actionBtnTextSecondary}>צור קטגוריה</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => setTemplateModalVisible(true)}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.actionBtnTextPrimary}>צור אימון</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="חיפוש אימון..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <TouchableOpacity style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]} onPress={toggleFilters}>
                    <Ionicons name="filter-outline" size={20} color={showFilters ? '#fff' : '#3b82f6'} />
                    <Text style={[styles.filterToggleText, showFilters && styles.filterToggleTextActive]}>סינון</Text>
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

            {filteredTemplates.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="barbell-outline" size={64} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>לא נמצאו אימונים</Text>
                    <Text style={styles.emptyDesc}>לחץ על "צור אימון" כדי להתחיל להרכיב את ספריית התבניות שלך.</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredTemplates}
                    keyExtractor={item => item.id!.toString()}
                    renderItem={renderTemplate}
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
                            placeholder="שם הקטגוריה (למשל: כוח, ריצה)"
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

            {/* Modal: Create Template */}
            <Modal visible={isTemplateModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContentLarge}>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={styles.modalTitle}>אימון חדש לספרייה</Text>
                            <TouchableOpacity onPress={() => setTemplateModalVisible(false)}><Ionicons name="close" size={24} color="#64748b" /></TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>שם האימון</Text>
                            <TextInput style={styles.modalInput} placeholder="למשל: ריצת בוקר 5 ק״מ" value={templateNameInput} onChangeText={setTemplateNameInput} />

                            <Text style={styles.inputLabel}>קטגוריה</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                                {categories.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[styles.catSelectChip, templateCategoryId === cat.id && styles.catSelectChipActive]}
                                        onPress={() => setTemplateCategoryId(cat.id!)}
                                    >
                                        <Text style={[styles.catSelectText, templateCategoryId === cat.id && styles.catSelectTextActive]}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.inputLabel}>תיאור (יעזור ל-AI בחישוב)</Text>
                            <TextInput
                                style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="פרט תרגילים, משקלים, או עצימות..."
                                value={templateDescInput}
                                onChangeText={setTemplateDescInput}
                                multiline
                            />

                            <TouchableOpacity style={styles.fullSubmitBtn} onPress={handleCreateTemplate}>
                                <Text style={styles.fullSubmitText}>שמור תבנית</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
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

    listContent: { padding: 16, gap: 12 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
    cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    templateName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    templateCategory: { fontSize: 13, color: '#3b82f6', marginTop: 4, textAlign: 'right', fontWeight: '600' },
    selectBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
    selectBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

    expandedContent: { marginTop: 16 },
    expandedDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
    detailRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 14, color: '#64748b', fontWeight: '500', textAlign: 'right' },
    detailValue: { fontSize: 14, color: '#1e293b', fontWeight: 'bold' },
    descContainer: { marginTop: 8, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
    descText: { fontSize: 14, color: '#334155', marginTop: 4, textAlign: 'right', lineHeight: 20 },

    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 16, marginBottom: 8, textAlign: 'center' },
    emptyDesc: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 24 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    modalContentLarge: { backgroundColor: '#fff', borderRadius: 20, padding: 24, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 16, textAlign: 'right' },
    modalSubTitle: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 8 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, textAlign: 'right' },
    modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16, textAlign: 'right', marginBottom: 16, color: '#1e293b' },

    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }, // Note: row instead of row-reverse to keep Ok on right visually usually, but let's stick to row-reverse for Hebrew
    modalCancel: { flex: 1, padding: 14, alignItems: 'center' },
    modalCancelText: { color: '#64748b', fontWeight: 'bold', fontSize: 16 },
    modalSubmit: { flex: 1, backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, alignItems: 'center' },
    modalSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    fullSubmitBtn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
    fullSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    catSelectChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    catSelectChipActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
    catSelectText: { color: '#64748b', fontWeight: '500', fontSize: 14 },
    catSelectTextActive: { color: '#2563eb', fontWeight: 'bold' }
});
