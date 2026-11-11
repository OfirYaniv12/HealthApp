import { getLogicalDayMeals, getLogicalDayWorkouts, Meal, Workout } from '@/db/database';
import { UserData, useUserStore } from '@/store/useUserStore';
import { generateDailyScoreExplanation } from './ai';
import { getLogicalDayBounds, getLogicalDayBoundsForKey, getLogicalDayKey, getLogicalWeekForDayKey } from './calculators';
import { calculateDailyScore, classifyWorkout } from './dailyScore';
import { getActiveNutrients, getNutrientTargets } from './nutrients';
import { getStepsForScore } from './steps';

/** Target workouts per week, derived from the onboarding answer (e.g. "3-4 בשבוע" -> 3-4). */
const weeklyWorkoutTarget = (freq?: string) => {
    if (!freq || freq.includes('לא')) return { min: 0, max: 0, label: 'לא מתאמן באופן קבוע' };
    const nums = (freq.match(/\d+/g) || []).map(Number);
    return { min: nums[0] ?? 0, max: nums[1] ?? nums[0] ?? 0, label: freq };
};

const describeWorkouts = (workouts: Workout[]) =>
    workouts.length === 0
        ? 'לא נרשמו אימונים'
        : workouts.map(w => {
            const c = classifyWorkout(w);
            const firstLine = (w.description || '').split('\n')[0];
            return `${w.name}: ${w.duration_minutes} דק', ${w.calories_burned} קק"ל${firstLine ? ` (${firstLine})` : ''} => ${c.level === 'significant' ? 'אימון משמעותי' : 'פעילות קלה'} [${c.reason}]`;
        }).join(' | ');

/**
 * Builds everything the AI needs to explain one logical day (today or a finished past day).
 * Workouts are classified as "significant" vs "light" and compared to the weekly goal so the
 * coach can tell a real workout from a quick 15-minute walk.
 */
const buildDayContext = async (user: UserData, dayKey: string, dayComplete: boolean) => {
    const resetTime = user.resetTime || '00:00';
    const { start, end, endDate } = getLogicalDayBoundsForKey(dayKey, resetTime);
    const [meals, workouts, steps] = await Promise.all([
        getLogicalDayMeals(start, end),
        getLogicalDayWorkouts(start, end),
        getStepsForScore(user, dayKey, dayComplete),
    ]);

    const score = calculateDailyScore(
        meals as Meal[], workouts as Workout[], user.daily_targets as Record<string, number>,
        user.trackedNutrients, user.goal,
        dayComplete ? endDate.getTime() - 60 * 1000 : Date.now(), resetTime, { dayComplete, steps }
    );

    const fullTargets = getNutrientTargets(user.daily_targets as any);
    const relevantKeys = getActiveNutrients(user.trackedNutrients);
    const consumptionStr = relevantKeys.map(key => {
        const target = fullTargets[key] || 0;
        const consumed = (meals as Meal[]).reduce((sum, meal) => sum + ((meal[key as keyof Meal] as number) || 0), 0);
        return `${key}: צרך ${Math.round(consumed)}, יעד ${target}`;
    }).join(' | ');
    const loggedFoodsStr = (meals as Meal[]).map(m => m.name).join(', ') || 'לא נרשמו ארוחות';

    // Past 3 days + this week's workouts. The workout week runs Sunday -> Saturday, starting and
    // ending at the user's day-reset time (e.g. Sunday 02:00 until the next Sunday 02:00).
    const pastStart = new Date(start); pastStart.setDate(pastStart.getDate() - 3);
    const week = getLogicalWeekForDayKey(dayKey, resetTime);
    const [pastMeals, pastWorkouts, weekWorkouts] = await Promise.all([
        getLogicalDayMeals(pastStart.toISOString(), start),
        getLogicalDayWorkouts(pastStart.toISOString(), start),
        getLogicalDayWorkouts(week.start, end), // from Sunday up to the end of this day
    ]);
    const pastMealsTotal = (pastMeals || []).reduce((sum, m) => sum + (m.calories || 0), 0);
    const target = weeklyWorkoutTarget(user.workout_frequency);
    const weekSignificant = (weekWorkouts as Workout[]).filter(w => classifyWorkout(w).level === 'significant').length;
    const weekLight = (weekWorkouts as Workout[]).length - weekSignificant;
    const daysLeft = week.daysLeftAfter; // days remaining in the week after this one

    const pastContextStr =
        `3 הימים הקודמים: ${(pastMeals || []).length} ארוחות (כ-${Math.round(pastMealsTotal)} קק"ל) ו-${(pastWorkouts || []).length} אימונים. ` +
        `השבוע הנוכחי (ראשון עד שבת, היום הוא יום ${week.dayNumber} בשבוע): ${weekSignificant} אימונים משמעותיים ו-${weekLight} פעילויות קלות עד עכשיו, ` +
        `ונשארו עוד ${daysLeft} ימים בשבוע. יעד שבועי: ${target.label}.`;

    const workoutsDetailStr = describeWorkouts(workouts as Workout[]) + (steps
        ? ` | צעדים: ${steps.count.toLocaleString('he-IL')} מתוך יעד יומי של ${steps.goal.toLocaleString('he-IL')} (הצעדים כוללים גם הליכות שנרשמו כאימון)`
        : ' | מעקב צעדים: לא פעיל – אל תתייחס לצעדים');
    // SCORE_VERSION: bump when the scoring rules change, so explanations written for the old numbers get rewritten
    const SCORE_VERSION = 'v5';
    // Steps are rounded to the nearest 500 so the explanation is refreshed on real changes, not on every few steps
    const stepsKey = steps ? Math.round(steps.count / 500) : 'off';
    const hash = `${(meals as Meal[]).map(m => m.id).sort().join(',')}|${(workouts as Workout[]).map(w => w.id).sort().join(',')}|${resetTime}|${user.goal}|${stepsKey}|${SCORE_VERSION}`;

    return { meals, workouts, score, consumptionStr, loggedFoodsStr, pastContextStr, workoutsDetailStr, hash, endDate };
};

export const refreshDailyScoreData = async () => {
    try {
        const user = useUserStore.getState().user;
        if (!user) return null;

        const { start, end } = getLogicalDayBounds(user.resetTime || '00:00');
        const todayKey = getLogicalDayKey(new Date(), user.resetTime);
        const [meals, workouts, steps] = await Promise.all([
            getLogicalDayMeals(start, end),
            getLogicalDayWorkouts(start, end),
            getStepsForScore(user, todayKey, false),
        ]);

        const score = calculateDailyScore(
            meals as Meal[],
            workouts as Workout[],
            user.daily_targets as Record<string, number>,
            user.trackedNutrients,
            user.goal,
            Date.now(),
            user.resetTime || '00:00',
            { steps }
        );

        const todayDateStr = getLogicalDayKey(new Date(), user.resetTime);
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

        const { user, todayDateStr } = data;
        const ctx = await buildDayContext(user, todayDateStr, false);

        const lastUpdated = user.dailyScoreLastUpdated?.[todayDateStr] || 0;
        const previousHash = user.dailyScoreExplanationHashes?.[todayDateStr] || '';

        const ONE_HOUR = 60 * 60 * 1000;
        const isRecent = Date.now() - lastUpdated < ONE_HOUR;

        // Only skip if nothing changed AND the explanation is recent (within the hour)
        if (previousHash === ctx.hash && isRecent) {
            return;
        }

        const explanation = await generateDailyScoreExplanation(
            ctx.score,
            ctx.consumptionStr,
            ctx.workouts.length > 0,
            (user.goal || '') + ' | תדירות אימונים: ' + (user.workout_frequency || 'לא צוין') + ' | פנה למשתמש בלשון ' + (user.gender === 'Female' ? 'נקבה' : 'זכר'),
            ctx.loggedFoodsStr,
            ctx.pastContextStr,
            { workoutsDetailStr: ctx.workoutsDetailStr }
        );

        if (!explanation) {
            // Don't save a timestamp — allow retry on next screen focus
            console.log('Score explanation failed, will retry on next focus.');
            return;
        }

        useUserStore.getState().setDailyScoreExplanation(todayDateStr, explanation, ctx.hash);
    } catch (e) {
        console.error('Background score update failed:', e);
    }
};

/**
 * Final summary of a finished logical day (used by the calendar's day screen).
 * The score is computed for the whole day as it stood at the reset time. The AI summary is
 * (re)generated only if the saved one was written before the day ended or the data has changed,
 * so the summary always matches the final score.
 */
export const getFinalDaySummary = async (dayKey: string, options: { generateExplanation?: boolean } = {}) => {
    const user = useUserStore.getState().user;
    if (!user) return null;

    const ctx = await buildDayContext(user, dayKey, true);
    useUserStore.getState().setDailyScoreData(dayKey, ctx.score);

    const savedExplanation = user.dailyScoreExplanations?.[dayKey] || null;
    const savedAt = user.dailyScoreLastUpdated?.[dayKey] || 0;
    const savedHash = user.dailyScoreExplanationHashes?.[dayKey] || '';
    const isFinal = savedExplanation && savedAt >= ctx.endDate.getTime() && savedHash === ctx.hash;

    let explanation = isFinal ? savedExplanation : null;
    if (!explanation && options.generateExplanation && (ctx.meals.length > 0 || ctx.workouts.length > 0)) {
        explanation = await generateDailyScoreExplanation(
            ctx.score,
            ctx.consumptionStr,
            ctx.workouts.length > 0,
            (user.goal || '') + ' | תדירות אימונים: ' + (user.workout_frequency || 'לא צוין') + ' | פנה למשתמש בלשון ' + (user.gender === 'Female' ? 'נקבה' : 'זכר'),
            ctx.loggedFoodsStr,
            ctx.pastContextStr,
            { workoutsDetailStr: ctx.workoutsDetailStr, isFinalSummary: true }
        );
        if (explanation) {
            useUserStore.getState().setDailyScoreExplanation(dayKey, explanation, ctx.hash, Date.now());
        }
    }

    return { ...ctx, explanation };
};
