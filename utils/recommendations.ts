import { getLogicalDayMeals, getLogicalDayWorkouts, getRecipesWithCategories, Meal, Workout } from '@/db/database';
import { useUserStore } from '@/store/useUserStore';
import { generateDailyRecommendations } from './ai';
import { getLogicalDayBounds, getLogicalDayKey } from './calculators';
import { getActiveNutrients, getNutrientTargets, nutrientLabelsLoc } from './nutrients';
import { getStepsForScore } from './steps';
import { getWeekWorkoutProgress } from './weeklyWorkouts';

const RECS_VERSION = 'r2';            // bump when the recommendations format changes (old cached tips get replaced)
const STALE_AFTER_MS = 3 * 60 * 60e3; // advice for "the rest of the day" goes stale as the day moves on
const FAILURE_RETRY_MS = 5 * 60e3;
const FAILURE_TEXT = 'לא זמינות כרגע';

const UNITS: Record<string, string> = { calories: 'קק"ל', protein: "ג'", carbs: "ג'", fat: "ג'", fiber: "ג'", sodium: 'מ"ג', sugar: "ג'" };
const CEILINGS = new Set(['sodium', 'sugar']); // limits, not targets to reach

let inFlight: Promise<boolean> | null = null;

/**
 * Makes sure today's recommendations are fresh: regenerates them when meals/workouts/steps changed,
 * when they're more than 3 hours old (the "rest of the day" changed), or when `force` is set.
 * Returns true if new recommendations were fetched.
 */
export const refreshDailyRecommendations = (opts: { force?: boolean } = {}): Promise<boolean> => {
    if (inFlight) return inFlight;
    inFlight = run(opts).finally(() => { inFlight = null; });
    return inFlight;
};

const run = async ({ force }: { force?: boolean }): Promise<boolean> => {
    const user = useUserStore.getState().user;
    if (!user || (!user.daily_targets && !user.trackedNutrients)) return false;
    const resetTime = user.resetTime || '00:00';
    const { start, end } = getLogicalDayBounds(resetTime);
    const todayKey = getLogicalDayKey(new Date(), resetTime);

    const [meals, workouts, steps, week] = await Promise.all([
        getLogicalDayMeals(start, end) as Promise<Meal[]>,
        getLogicalDayWorkouts(start, end) as Promise<Workout[]>,
        getStepsForScore(user, todayKey, false).catch(() => null),
        getWeekWorkoutProgress(user).catch(() => null),
    ]);

    const stepsBucket = steps ? Math.round(steps.count / 1000) : 'off';
    const hash = [
        RECS_VERSION,
        (meals || []).map(m => m.id).sort().join(','),
        (workouts || []).map(w => w.id).sort().join(','),
        stepsBucket,
        week ? week.significant : '-',
        user.goal || '',
    ].join('|');

    const cache = user.dailyRecommendations;
    const age = cache?.timestamp ? Date.now() - cache.timestamp : Infinity;
    const isFailure = !!cache?.data?.short?.[0]?.includes(FAILURE_TEXT);
    if (!force && cache?.dateStr === todayKey) {
        if (isFailure && age < FAILURE_RETRY_MS) return false;
        if (!isFailure && cache.hash === hash && age < STALE_AFTER_MS) return false;
    }

    // What's left of each tracked nutrient today
    const targets = getNutrientTargets(user.daily_targets as any);
    const remaining = getActiveNutrients(user.trackedNutrients).map(key => {
        const eaten = Math.round((meals || []).reduce((a, m: any) => a + (m[key] || 0), 0));
        const target = Math.round(targets[key] || 0);
        const label = nutrientLabelsLoc[key] || key;
        const unit = UNITS[key] || '';
        if (CEILINGS.has(key)) return `${label}: ${eaten} מתוך תקרה של ${target} ${unit}`;
        const left = target - eaten;
        return `${label}: ${eaten}/${target} ${unit} (${left >= 0 ? `נשארו ${left}` : `עבר ב-${-left}`})`;
    }).join(' | ');

    const weekStr = !week ? 'לא ידוע'
        : week.target.max <= 0
            ? `${week.significant} אימונים השבוע (המשתמש לא מתאמן באופן קבוע – אל תלחץ על אימונים)`
            : `${week.significant} אימונים משמעותיים מתוך יעד של ${week.target.label} (ועוד ${week.light} פעילויות קלות). היום הוא יום ${week.dayNumber} בשבוע (ראשון עד שבת), נשארו עוד ${week.daysLeft} ימים אחרי היום. ${week.workedOutToday ? 'כבר התאמן היום.' : 'עוד לא התאמן היום.'}`;

    const stepsStr = steps
        ? `${steps.count.toLocaleString('he-IL')} מתוך יעד יומי של ${steps.goal.toLocaleString('he-IL')}`
        : 'מעקב צעדים לא פעיל – אל תזכיר צעדים';

    // Previous 3 days, briefly (calories per day vs. target, and workouts)
    const pastStart = new Date(start); pastStart.setDate(pastStart.getDate() - 3);
    const [pastMeals, pastWorkouts, recipes] = await Promise.all([
        getLogicalDayMeals(pastStart.toISOString(), start).catch(() => []),
        getLogicalDayWorkouts(pastStart.toISOString(), start).catch(() => []),
        getRecipesWithCategories().catch(() => []),
    ]);
    const pastKcal = Math.round(((pastMeals || []) as Meal[]).reduce((a, m) => a + (m.calories || 0), 0));
    const pastProtein = Math.round(((pastMeals || []) as Meal[]).reduce((a, m) => a + (m.protein || 0), 0));
    const pastDays = (pastMeals || []).length
        ? `ב-3 הימים הקודמים: ממוצע של כ-${Math.round(pastKcal / 3)} קק"ל ו-${Math.round(pastProtein / 3)} ג' חלבון ליום (יעד: ${targets.calories} קק"ל, ${targets.protein} ג' חלבון), ${(pastWorkouts || []).length} אימונים.`
        : 'אין נתונים מהימים הקודמים.';

    const gender = user.gender === 'Female' ? 'נקבה' : 'זכר';
    const recs = await generateDailyRecommendations({
        meals: meals || [],
        workouts: workouts || [],
        remaining,
        goal: `${user.goal || 'לא צוין'} | תדירות אימונים: ${user.workout_frequency || 'לא צוין'} | פנה למשתמש בלשון ${gender}`,
        week: weekStr,
        steps: stepsStr,
        pastDays,
        recipes: (recipes as any[]).slice(0, 25).map(r => ({
            name: r.name, category: r.category_name, calories: r.calories || 0, protein: r.protein || 0, carbs: r.carbs || 0, fat: r.fat || 0,
        })),
    });

    useUserStore.getState().setDailyRecommendations(todayKey, hash, Date.now(), recs || {
        short: [`המלצות AI ${FAILURE_TEXT} (עומס)`],
        full: 'לא הצלחנו ליצור המלצות כרגע. ננסה שוב בעוד כמה דקות.',
    });
    return !!recs;
};
