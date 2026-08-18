import { Meal } from '@/db/database';
import { UserData } from '@/store/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { I18nManager, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NutrientModalProps {
    visible: boolean;
    onClose: () => void;
    user: UserData;
    meals: Meal[];
}

type NutrientTab = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sodium' | 'sugar';

export default function NutrientModal({ visible, onClose, user, meals }: NutrientModalProps) {
    const [expandedTab, setExpandedTab] = React.useState<NutrientTab | null>(null);

    if (!user) return null;

    const { daily_targets } = user;
    const tracked = user.trackedNutrients || {};
    const isEnabled = (key: string, def: boolean) => tracked[key] !== undefined ? tracked[key] : def;

    const targets = {
        ...daily_targets,
        fiber: daily_targets.fiber || 30,
        sodium: daily_targets.sodium || 2300,
        sugar: daily_targets.sugar || 50
    };

    const totalCals = meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
    const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
    const totalFat = meals.reduce((sum, m) => sum + m.fat, 0);
    const totalFiber = meals.reduce((sum, m) => sum + (m.fiber || 0), 0);
    const totalSodium = meals.reduce((sum, m) => sum + (m.sodium || 0), 0);
    const totalSugar = meals.reduce((sum, m) => sum + (m.sugar || 0), 0);

    const todayDateStr = new Date().toISOString().split('T')[0];
    const scoreExpCache = user.dailyScoreExplanations?.[todayDateStr];
    let aiStatuses: Record<string, string> = {};
    if (scoreExpCache) {
        try {
            const parsed = JSON.parse(scoreExpCache);
            aiStatuses = parsed.statuses || {};
        } catch (e) {}
    }

    const colorMap: Record<string, string> = {
        green: '#10b981',
        yellow: '#f59e0b',
        red: '#ef4444'
    };

    const tabs: { key: NutrientTab; label: string; unit: string; total: number; target: number; show: boolean }[] = [
        { key: 'calories' as NutrientTab, label: 'קלוריות', unit: 'קק"ל', total: Math.round(totalCals), target: targets.calories, show: isEnabled('calories', true) },
        { key: 'protein' as NutrientTab, label: 'חלבון', unit: 'g', total: Math.round(totalProtein), target: targets.protein, show: isEnabled('protein', true) },
        { key: 'carbs' as NutrientTab, label: 'פחמימות', unit: 'g', total: Math.round(totalCarbs), target: targets.carbs, show: isEnabled('carbs', true) },
        { key: 'fat' as NutrientTab, label: 'שומן', unit: 'g', total: Math.round(totalFat), target: targets.fat, show: isEnabled('fat', true) },
        { key: 'fiber' as NutrientTab, label: 'סיבים תזונתיים', unit: 'g', total: Math.round(totalFiber), target: targets.fiber, show: isEnabled('fiber', true) },
        { key: 'sodium' as NutrientTab, label: 'נתרן', unit: 'mg', total: Math.round(totalSodium), target: targets.sodium, show: isEnabled('sodium', true) },
        { key: 'sugar' as NutrientTab, label: 'סוכר', unit: 'g', total: Math.round(totalSugar), target: targets.sugar, show: isEnabled('sugar', true) }
    ].filter(t => t.show);

    const toggleAccordion = (key: NutrientTab) => {
        setExpandedTab(prev => prev === key ? null : key);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <Ionicons name="close" size={28} color="#1e293b" />
                    </TouchableOpacity>

                    <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' }}>
                        <Text style={styles.headerTitle}>ניתוח תזונתי עמוק</Text>
                    </View>
                </View>

                <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                    <Text style={styles.sectionTitle}>התקדמות יומית (הקש לפירוט)</Text>

                    <View style={styles.accordionContainer}>
                        {tabs.map(tab => {
                            const progress = (tab.total / tab.target) * 100;
                            const barWidth = Math.min(progress, 100);
                            
                            let status = aiStatuses[tab.key] || 'green';
                            if (['fat', 'sugar', 'sodium'].includes(tab.key)) {
                                status = progress <= 100 ? 'green' : 'red';
                            } else if (['protein', 'fiber'].includes(tab.key)) {
                                if (progress < 50) status = 'red';
                                else if (progress <= 80) status = 'yellow';
                                else status = 'green';
                            } else if (tab.key === 'calories') {
                                if (progress >= 90 && progress <= 110) status = 'green';
                                else if (progress < 70 || progress > 130) status = 'red';
                                else status = 'yellow';
                            }

                            const barColor = colorMap[status] || '#3b82f6';
                            const isExpanded = expandedTab === tab.key;
                            const sortedMeals = [...meals].sort((a, b) => (b[tab.key] || 0) - (a[tab.key] || 0));

                            return (
                                <View key={tab.key} style={styles.accordionCard}>
                                    <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleAccordion(tab.key)} activeOpacity={0.7}>
                                        <View style={styles.macroHeaderRow}>
                                            <Text style={styles.macroLabel}>{tab.label}</Text>
                                            <Text style={styles.macroValues}>{tab.total} / {tab.target} {tab.unit}</Text>
                                        </View>

                                        <View style={styles.progressMasterRow}>
                                            <View style={styles.progressBarBg}>
                                                <View style={[styles.progressBarFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
                                            </View>
                                            <Text style={[styles.progressPercentage, { color: barColor }]}>{Math.round(progress)}%</Text>
                                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#94a3b8" style={styles.chevronIcon} />
                                        </View>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={styles.expandedContent}>
                                            {sortedMeals.length === 0 ? (
                                                <Text style={styles.emptyText}>אין ארוחות תואמות.</Text>
                                            ) : (
                                                sortedMeals.map((meal, idx) => {
                                                    const value = meal[tab.key] || 0;
                                                    if (value === 0 && tab.key !== 'calories') return null;

                                                    return (
                                                        <View key={meal.id || idx} style={styles.listItem}>
                                                            <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                                                            <View style={styles.valueBadge}>
                                                                <Text style={styles.valueText}>{value} {tab.unit}</Text>
                                                            </View>
                                                        </View>
                                                    );
                                                })
                                            )}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#64748b', textAlign: 'right', marginBottom: 16 },
    accordionContainer: { gap: 16 },
    accordionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
    accordionHeader: { gap: 8 },
    macroHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    macroLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    macroValues: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    progressMasterRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    progressBarBg: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },
    progressPercentage: { fontSize: 13, fontWeight: 'bold', minWidth: 36, textAlign: 'center' },
    chevronIcon: { marginLeft: 4 },
    expandedContent: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    listItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
    mealName: { fontSize: 15, fontWeight: '500', color: '#334155', flex: 1, textAlign: 'right', marginLeft: 16 },
    valueBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    valueText: { fontSize: 13, fontWeight: 'bold', color: '#1d4ed8' },
    emptyText: { textAlign: 'center', color: '#94a3b8', paddingVertical: 12, fontSize: 14 }
});
