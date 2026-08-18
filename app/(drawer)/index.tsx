import { useUserStore } from '@/store/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { I18nManager, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NutrientModal from '@/components/NutrientModal';

// Force RTL layout 
import { Meal, Workout, getLogicalDayMeals, getLogicalDayWorkouts } from '@/db/database';
import { generateDailyRecommendations } from '@/utils/ai';
import { getLogicalDayBounds } from '@/utils/calculators';
import { getActiveNutrients, nutrientLabelsLoc } from '@/utils/nutrients';
import { refreshDailyScoreData } from '@/utils/scoreUpdater';
import { useFocusEffect, useRouter } from 'expo-router';
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function DashboardScreen() {
  const user = useUserStore((state) => state.user);
  const navigation = useNavigation();
  const router = useRouter();

  const [foodLogs, setFoodLogs] = useState<Meal[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<Workout[]>([]);
  
  const [nutrientModalVisible, setNutrientModalVisible] = useState(false);

  const [loadingRecs, setLoadingRecs] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const loadLogs = async () => {
        try {
          // Grab current user directly from store to avoid useCallback dependency infinite loops
          const currentUser = useUserStore.getState().user;
          if (!currentUser || (!currentUser.daily_targets && !currentUser.trackedNutrients)) return;

          const { start, end } = getLogicalDayBounds(currentUser.resetTime || '00:00');
          const [logs, workouts] = await Promise.all([
            getLogicalDayMeals(start, end),
            getLogicalDayWorkouts(start, end)
          ]);
          if (isMounted) {
            setFoodLogs(logs);
            setWorkoutLogs(workouts);
          }
          refreshDailyScoreData(); // Background quick-sync mathematical score

          // Data fingerprint: detects actual meal/workout additions and deletions (not just count)
          const mealFingerprint = logs.map(m => m.id).sort().join(',');
          const workoutFingerprint = workouts.map(w => w.id).sort().join(',');
          const newHash = `${mealFingerprint}|${workoutFingerprint}`;
          const todayDateStr = new Date().toISOString().split('T')[0];

          const recsCache = currentUser.dailyRecommendations;
          const isSameDay = recsCache?.dateStr === todayDateStr;
          const isSameHash = recsCache?.hash === newHash;
          const isRecent = recsCache?.timestamp && (Date.now() - recsCache.timestamp < 60 * 60 * 1000); // 1 hour for success
          const isFailure = recsCache?.data?.short?.[0]?.includes('לא זמינות כרגע');
          
          // If the last fetch was a failure (API quota issue), shorten cooldown to 5 min for auto-recovery
          const isRecentFailure = isFailure && recsCache?.timestamp && (Date.now() - recsCache.timestamp < 5 * 60 * 1000);

          if (!isSameDay || !isSameHash || (isFailure && !isRecentFailure)) {
            if (isMounted) setLoadingRecs(true);
            const targets = { ...currentUser.daily_targets };
            const recs = await generateDailyRecommendations(logs, workouts, targets, currentUser.goal);
            if (isMounted) {
              if (recs) {
                useUserStore.getState().setDailyRecommendations(todayDateStr, newHash, Date.now(), recs);
              } else {
                // Prevent infinite network requests by caching the failure state
                useUserStore.getState().setDailyRecommendations(todayDateStr, newHash, Date.now(), {
                  short: ["המלצות AI לא זמינות כרגע (עומס)"],
                  full: "מערכת ה-AI חצתה את מכסת הבקשות. נסה שוב בעוד כשעה."
                });
              }
              setLoadingRecs(false);
            }
          }

        } catch (e) {
          console.error('Error loading logs', e);
          if (isMounted) setLoadingRecs(false);
        }
      };
      loadLogs();
      return () => { isMounted = false; };
    }, [])
  );

  React.useEffect(() => {
    // Timed background updates: At least once every hour
    const timer = setInterval(() => {
      refreshDailyScoreData();
    }, 60 * 60 * 1000); 
    return () => clearInterval(timer);
  }, []);

  if (!user) {
    return null; // Safety net, index.tsx handles actual redirect
  }

  const { daily_targets, full_name } = user;

  // Get current day of the week in Hebrew
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const today = days[new Date().getDay()];

  // Display First Name Only
  const firstName = full_name ? full_name.split(' ')[0] : 'אורח';

  // Real consumed macros based on foodLogs (Phase 15 update)
  const consumedCalories = foodLogs.reduce((sum, log) => sum + log.calories, 0);
  const consumedProtein = foodLogs.reduce((sum, log) => sum + log.protein, 0);
  const consumedCarbs = foodLogs.reduce((sum, log) => sum + log.carbs, 0);
  const consumedFat = foodLogs.reduce((sum, log) => sum + log.fat, 0);
  const consumedFiber = foodLogs.reduce((sum, log) => sum + (log.fiber || 0), 0);
  const consumedSodium = foodLogs.reduce((sum, log) => sum + (log.sodium || 0), 0);
  const consumedSugar = foodLogs.reduce((sum, log) => sum + (log.sugar || 0), 0);

  const tracked = user.trackedNutrients || {};
  const isEnabled = (key: string, def: boolean) => tracked[key] !== undefined ? tracked[key] : def;

  const targets = {
    ...daily_targets,
    fiber: daily_targets.fiber || 30,
    sodium: daily_targets.sodium || 2300,
    sugar: daily_targets.sugar || 50
  };

  const activeKeys = getActiveNutrients(user.trackedNutrients);

  const getConsumedValue = (key: string) => {
    switch (key) {
      case 'calories': return consumedCalories;
      case 'protein': return consumedProtein;
      case 'carbs': return consumedCarbs;
      case 'fat': return consumedFat;
      case 'fiber': return consumedFiber;
      case 'sodium': return consumedSodium;
      case 'sugar': return consumedSugar;
      default: return 0;
    }
  };

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

  const nutrientUnits: Record<string, string> = {
    calories: '',
    protein: 'g',
    carbs: 'g',
    fat: 'g',
    fiber: 'g',
    sodium: 'mg',
    sugar: 'g'
  };

  const nutrientLabelsOverride: Record<string, string> = {
    calories: 'קלוריות'
  };

  const macrosToDisplay = activeKeys.map(key => {
    const status = aiStatuses[key] || 'green'; // Default to green if AI doesn't specify
    return {
      key,
      label: nutrientLabelsOverride[key] || nutrientLabelsLoc[key] || key,
      consumed: getConsumedValue(key),
      target: (targets as any)[key] || 0,
      color: colorMap[status] || '#3b82f6',
      unit: nutrientUnits[key] || ''
    };
  });

  const scoreBreakdown = user.dailyScoreData?.[todayDateStr] || { totalScore: 0, nutritionScore: 0, workoutBonus: 0, progressExpected: 0, progressActual: 0 };

  const getScoreColor = (s: number) => {
    if (s >= 7) return '#10b981'; // Green
    if (s >= 4) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };
  const recentFoods = foodLogs.slice(0, 3).map(log => ({
    time: log.timestamp ? new Date(log.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '',
    name: log.name
  }));
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={[styles.header, { flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="menu" size={32} color="#1e293b" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>שלום {firstName}</Text>
            <Text style={styles.subtitle}>הנה תמונת המצב שלך ליום {today}</Text>
          </View>
        </View>

        {/* Action Buttons (Moved to Top) */}
        <View style={[styles.bottomActions, { flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', marginBottom: 16 }]}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#3b82f6', flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]} onPress={() => router.push('/add-meal')}>
            <Text style={styles.actionButtonText}>אכלתי משהו</Text>
            <Ionicons name="restaurant" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#8b5cf6', flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]} onPress={() => router.push('/add-workout')}>
            <Text style={styles.actionButtonText}>עשיתי אימון</Text>
            <Ionicons name="barbell-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* What did I eat today? Card */}
        <TouchableOpacity style={[styles.card, styles.largeCard, { justifyContent: 'flex-start' }]} onPress={() => router.push('/daily-log')}>
          <Text style={[styles.cardTitle, { textAlign: 'center', marginBottom: 16, fontSize: 20 }]}>מה אכלתי היום?</Text>

          {recentFoods.length > 0 ? (
            <View style={{ gap: 8 }}>
              {recentFoods.map((food, idx) => (
                <View key={idx} style={{ flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#1e293b', fontWeight: '500' }}>{food.name}</Text>
                  <Text style={{ fontSize: 16, color: '#64748b' }}>{food.time}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={styles.emptyStateText}>עדיין לא נוספו ארוחות היום</Text>
              <Text style={styles.actionPrompt}>לחץ כאן כדי להוסיף ארוחה</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.dashboardRow}>
          {/* Daily Score Card */}
          <TouchableOpacity style={[styles.card, styles.flexCard, { alignItems: 'center' }]} onPress={() => router.push('/daily-score')}>
            <Text style={styles.cardTitle}>הציון שלי להיום</Text>
            <View style={[styles.scoreContainer, { backgroundColor: getScoreColor(scoreBreakdown.totalScore) }]}>
              <Text style={[styles.scoreNumber, { color: '#fff' }]}>{scoreBreakdown.totalScore}</Text>
            </View>
            <Text style={styles.scoreSubtitle}>לחץ להסבר</Text>
          </TouchableOpacity>

          {/* Macros Summary Card (Now Clickable) */}
          <TouchableOpacity style={[styles.card, styles.flexCard]} onPress={() => setNutrientModalVisible(true)}>
            <Text style={styles.cardTitle}>ערכים תזונתיים</Text>

            {macrosToDisplay.slice(0, 2).map((mac, idx) => {
              const safeTarget = mac.target > 0 ? mac.target : 1;
              const progress = Math.min((mac.consumed / safeTarget) * 100, 100);
              return (
                <View key={mac.key} style={{ marginBottom: 8 }}>
                  <View style={styles.miniMacroRow}>
                    <Text style={styles.miniMacroLabel}>{mac.label}</Text>
                    <Text style={styles.miniMacroValue}>{Math.round(mac.consumed)}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: mac.color }]} />
                  </View>
                </View>
              );
            })}
          </TouchableOpacity>
        </View>

        {/* New Daily Recommendations Card */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(drawer)/recommendations')}>
          <View style={{ flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 8 }}>
            <Ionicons name="sparkles" size={20} color="#f59e0b" />
            <Text style={[styles.cardTitle, { textAlign: 'center', marginBottom: 0 }]}>המלצות להמשך היום</Text>
          </View>

          {loadingRecs ? (
            <Text style={[styles.emptyStateText, { marginTop: 8 }]}>AI חושב...</Text>
          ) : user.dailyRecommendations?.data?.short?.length ? (
            <View style={{ gap: 12 }}>
              {user.dailyRecommendations.data.short.map((tip, idx) => (
                <View key={idx} style={{ flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6' }} />
                  <Text style={{ fontSize: 15, color: '#334155', flex: 1, textAlign: 'right', lineHeight: 22 }}>{tip}</Text>
                </View>
              ))}
              <Text style={[styles.actionPrompt, { marginTop: 8 }]}>לחץ להסבר המלא</Text>
            </View>
          ) : (
            <Text style={styles.emptyStateText}>אין המלצות זמינות כרגע.</Text>
          )}
        </TouchableOpacity>

      </ScrollView>

      <NutrientModal visible={nutrientModalVisible} onClose={() => setNutrientModalVisible(false)} user={user} meals={foodLogs} />

    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  menuButton: {
    marginLeft: 16,
    padding: 4,
  },
  greeting: { fontSize: 26, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
  subtitle: { fontSize: 16, color: '#64748b', textAlign: 'right', marginTop: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  largeCard: { minHeight: 180, justifyContent: 'center' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', textAlign: 'right', marginBottom: 12 },

  emptyStateText: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 8 },
  actionPrompt: { fontSize: 14, color: '#3b82f6', fontWeight: '600', textAlign: 'center' },

  dashboardRow: { flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', gap: 16 },
  flexCard: { flex: 1 },

  scoreContainer: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center', marginVertical: 8
  },
  scoreNumber: { fontSize: 32, fontWeight: 'bold' },
  scoreSubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  miniMacroRow: { flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  miniMacroLabel: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  miniMacroValue: { fontSize: 14, color: '#1e293b', fontWeight: 'bold' },
  progressBarBg: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 999 },

  bottomActions: { gap: 16, marginTop: 12 },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
