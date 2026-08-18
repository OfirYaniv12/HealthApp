import { getLogicalDayMeals, getLogicalDayWorkouts, Meal, Workout } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { generateDailyScoreExplanation } from './ai';
import { getLogicalDayBounds } from './calculators';
import { calculateDailyScore } from './dailyScore';

export const refreshDailyScoreData = async () => {
    try {
        const user = useUserStore.getState().user;
        if (!user) return null;

        const { start, end } = getLogicalDayBounds(user.resetTime || '00:00');
        const [meals, workouts] = await Promise.all([
            getLogicalDayMeals(start, end),
            getLogicalDayWorkouts(start, end)
        ]);

        const score = calculateDailyScore(
            meals as Meal[],
            workouts as Workout[],
            user.daily_targets as Record<string, number>,
            user.trackedNutrients,
            user.goal
        );

        const todayDateStr = new Date().toISOString().split('T')[0];
        useUserStore.getState().setDailyScoreData(todayDateStr, score);

        return { meals, workouts, score, user, todayDateStr };
    } catch (error) {
        console.error('Failed to quick-refresh score data:', error);
        return null;
    }
};

export const triggerScoreExplanationUpdate = async () => {
    try {
        const data = await refreshDailyScoreData();
        if (!data) return;

        const { meals, workouts, score, user, todayDateStr } = data;

        // Calculate Data Fingerprint for reactive triggers on logs change
        const mealFingerprint = (meals as Meal[]).map(m => m.id).sort().join(',');
        const workoutFingerprint = (workouts as Workout[]).map(w => w.id).sort().join(',');
        const newHash = `${mealFingerprint}|${workoutFingerprint}`;

        const lastUpdated = user.dailyScoreLastUpdated?.[todayDateStr] || 0;
        const previousHash = user.dailyScoreExplanationHashes?.[todayDateStr] || '';
        
        const ONE_HOUR = 60 * 60 * 1000;
        const isRecent = Date.now() - lastUpdated < ONE_HOUR;
        const isSameHash = previousHash === newHash;

        // ✅ CACHE GUARD: Only skip if SAME HASH AND RECENT (within hour)
        if (isSameHash && isRecent) {
            return;
        }

        // Build consumption string for AI context
        const relevantKeys = Object.keys(user.daily_targets || {}).filter(key => user.trackedNutrients === undefined || user.trackedNutrients[key] === true);
        const consumptionStr = relevantKeys.map(key => {
            const target = user.daily_targets[key as keyof typeof user.daily_targets] || 0;
            const consumed = (meals as Meal[]).reduce((sum, meal) => sum + ((meal[key as keyof Meal] as number) || 0), 0);
            return `${key}: צרך ${Math.round(consumed)}, יעד ${target}`;
        }).join(' | ');

        const isWorkoutLogged = workouts.length > 0;
        const loggedFoodsStr = (meals as Meal[]).map(m => m.name).join(', ') || 'לא נרשמו ארוחות';

        // Generate Explanation — returns null on any API/quota error
        const explanation = await generateDailyScoreExplanation(
            score,
            consumptionStr,
            isWorkoutLogged,
            user.goal,
            loggedFoodsStr
        );

        if (!explanation) {
            // Don't save a timestamp — allow retry on next screen focus
            console.log('Score explanation failed, will retry on next focus.');
            return;
        }

        // Save to store with timestamp so 1-hour guard works correctly
        useUserStore.getState().setDailyScoreExplanation(todayDateStr, explanation, newHash);

    } catch (e) {
        console.error('Background score update failed:', e);
    }
};
