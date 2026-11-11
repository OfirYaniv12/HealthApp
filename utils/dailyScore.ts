import { Meal, Workout } from '@/db/database';

import { GoalType } from './calculators';
import { getNutrientTargets, isNutrientTracked } from './nutrients';

export interface ScoreBreakdown {
    totalScore: number;
    nutritionScore: number;
    workoutBonus: number;
    progressExpected: number;
    progressActual: number;
    healthQualityScore: number;
    /** 0-10 per nutrient (how well each one went), used by the explanation */
    nutrientScores?: Record<string, number>;
    /** Healthy food groups eaten today (variety) */
    foodGroups?: string[];
    /** Steps (only when steps tracking is on and the phone has sent data) */
    steps?: number;
    stepsGoal?: number;
    stepsScore?: number;
    stepsBonus?: number;
}

export type WorkoutLevel = 'significant' | 'light';

/**
 * Decides whether a logged workout is a "real" training session that counts toward the weekly
 * workout goal, or light activity (nice, but not a workout). Based on duration, energy and type.
 */
export function classifyWorkout(w: Pick<Workout, 'name' | 'duration_minutes' | 'calories_burned' | 'description'>): { level: WorkoutLevel; reason: string } {
    const text = `${w.name || ''} ${w.description || ''}`;
    const minutes = Number(w.duration_minutes) || 0;
    const kcal = Number(w.calories_burned) || 0;
    const isWalk = /הליכ|walk/i.test(text) && !/ריצ|run/i.test(text);
    const distMatch = text.replace(',', '.').match(/מרחק:\s*(\d+(?:\.\d+)?)/);
    const km = distMatch ? parseFloat(distMatch[1]) : null;

    if (isWalk) {
        const speed = km && minutes ? km / (minutes / 60) : null;
        if (minutes >= 45 || (km !== null && km >= 5) || (speed !== null && speed >= 5.5 && minutes >= 30)) {
            return { level: 'significant', reason: 'הליכה ארוכה/מהירה' };
        }
        return { level: 'light', reason: 'הליכה קצרה - פעילות קלה' };
    }
    if (minutes >= 25 || kcal >= 200) return { level: 'significant', reason: 'אימון מלא' };
    return { level: 'light', reason: 'פעילות קצרה' };
}

/**
 * How each goal ("plan") is scored. Every nutrient gets its own 0-10 score, so missing one
 * (e.g. protein on a muscle-gain day) can't be hidden by hitting another.
 *  - weights: how much each nutrient matters for this goal
 *  - calOver / calUnder: allowed deviation of calories from where you should be by now, and how hard to penalise beyond it
 *  - qualityShare: share of food quality & variety in the nutrition score
 */
type GoalProfile = {
    weights: Record<string, number>;
    calOverTol: number; calOverK: number;
    calUnderTol: number; calUnderK: number;
    proteinK: number; fiberK: number;
    qualityShare: number;
    workoutBonus: { significant: number; light: number };
    /** Share of steps in the score (only when steps tracking is on) */
    stepsShare: number;
};

export const GOAL_PROFILES: Record<string, GoalProfile> = {
    // Weight loss: stay at or a bit under the calories; protein protects muscle; sugar matters
    'ירידה במשקל': {
        weights: { calories: 3, protein: 2, carbs: 1, fat: 1, fiber: 1, sugar: 1.5, sodium: 1 },
        calOverTol: 0.05, calOverK: 40, calUnderTol: 0.15, calUnderK: 18,
        proteinK: 18, fiberK: 10, qualityShare: 0.2,
        workoutBonus: { significant: 1, light: 0.3 },
        stepsShare: 0.12,
    },
    // Muscle gain: eating ENOUGH (calories + protein) is the whole point; a bit over is fine
    'עלייה במסת שריר': {
        weights: { calories: 2.5, protein: 3, carbs: 1, fat: 0.75, fiber: 0.75, sugar: 0.75, sodium: 0.75 },
        calOverTol: 0.15, calOverK: 18, calUnderTol: 0.05, calUnderK: 25,
        proteinK: 22, fiberK: 8, qualityShare: 0.2,
        workoutBonus: { significant: 1, light: 0.3 },
        stepsShare: 0.08,
    },
    // Recomposition: slight deficit, high protein; both directions matter
    'שילוב מתון': {
        weights: { calories: 2.5, protein: 3, carbs: 1, fat: 1, fiber: 1, sugar: 1, sodium: 1 },
        calOverTol: 0.05, calOverK: 33, calUnderTol: 0.1, calUnderK: 18,
        proteinK: 20, fiberK: 10, qualityShare: 0.2,
        workoutBonus: { significant: 1, light: 0.3 },
        stepsShare: 0.1,
    },
    // Healthier lifestyle: quality and variety first, limits on sugar/sodium, fiber, and regular workouts
    'אורח חיים בריא יותר': {
        weights: { calories: 1.5, protein: 1.25, carbs: 0.75, fat: 0.75, fiber: 2, sugar: 2, sodium: 2 },
        calOverTol: 0.1, calOverK: 25, calUnderTol: 0.15, calUnderK: 15,
        proteinK: 12, fiberK: 15, qualityShare: 0.35,
        workoutBonus: { significant: 1.2, light: 0.4 },
        stepsShare: 0.15,
    },
};

/** Healthy food groups, used to measure variety. */
const FOOD_GROUPS: Record<string, string[]> = {
    'ירקות': ['סלט', 'ירק', 'גזר', 'עגבני', 'מלפפון', 'חסה', 'פלפל', 'ברוקולי', 'כרוב', 'תרד', 'קישוא', 'חציל', 'בצל', 'פטריות', 'שעועית ירוקה', 'סלק', 'דלעת', 'בטטה'],
    'פירות': ['פרי', 'פירות', 'תפוח', 'בננה', 'תות', 'ענב', 'אגס', 'תפוז', 'קלמנטינה', 'אבטיח', 'מלון', 'אננס', 'מנגו', 'אוכמניות', 'פטל', 'קיווי', 'אפרסק', 'שזיף', 'רימון', 'תמר'],
    'קטניות': ['עדשים', 'חומוס', 'שעועית', 'אדממה', 'טופו', 'פול', 'אפונה'],
    'דגנים מלאים': ['מלא', 'שיבולת', 'קוואקר', 'קינואה', 'כוסמת', 'בורגול', 'כוסמין', 'שעורה'],
    'חלבון רזה ודגים': ['חזה עוף', 'הודו', 'דג', 'סלמון', 'טונה', 'ביצה', 'ביצים', 'קוטג', 'יוגורט'],
    'אגוזים וזרעים': ['שקד', 'אגוז', 'טחינה', 'זרעי', 'פיסטוק', 'קשיו', 'בוטנ', "צ'יה", 'פשתן', 'אבוקדו', 'זית'],
};
const UNHEALTHY_KEYWORDS = ['פיצה', 'בורגר', 'המבורגר', "צ'יפס", 'מטוגן', 'שניצל', 'שוקולד', 'גלידה', 'עוגה', 'עוגי', 'ממתק', 'חטיף', 'במבה', 'ביסלי', 'בורקס', 'נקניק', 'קולה', 'ממותק', 'מעובד', 'סופגני', 'ופל', 'קרואסון', 'שווארמה', 'נאגטס'];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function calculateDailyScore(
    meals: Meal[],
    workouts: Workout[],
    targets: Record<string, number>,
    tracked: Record<string, boolean> | undefined,
    userGoal: GoalType = 'אורח חיים בריא יותר',
    currentTimeMs: number = Date.now(),
    resetTimeStr: string = '00:00',
    options: { dayComplete?: boolean; steps?: { count: number; goal: number; expected: number } | null } = {}
): ScoreBreakdown {
    const goal = GOAL_PROFILES[userGoal] || GOAL_PROFILES['אורח חיים בריא יותר'];

    // 1. How much of the day's eating is expected by now (08:00-22:00 window; a finished day = 100%)
    const now = new Date(currentTimeMs);
    const hour = now.getHours() + now.getMinutes() / 60;
    const [resetH, resetM] = (resetTimeStr || '00:00').split(':').map(Number);
    const resetHour = (resetH || 0) + (resetM || 0) / 60;
    let e = 0;
    if (options.dayComplete || hour < resetHour) e = 1;
    else if (hour < 8) e = 0;
    else if (hour >= 22) e = 1;
    else e = (hour - 8) / 14;

    // 2. Per-nutrient scores (0-10), each compared to where you should be by now
    const fullTargets = getNutrientTargets(targets as any) as Record<string, number>;
    const consumedOf = (key: string) => meals.reduce((sum, meal) => sum + ((meal[key as keyof Meal] as number) || 0), 0);
    const nutrientScores: Record<string, number> = {};
    let weighted = 0, weightSum = 0, actualSum = 0;

    for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'sugar']) {
        const target = fullTargets[key];
        if (!isNutrientTracked(tracked, key) || !target) continue;
        const r = consumedOf(key) / target;  // share of the daily target eaten
        const dev = r - e;                    // ahead (+) or behind (-) of schedule
        let score = 10;
        switch (key) {
            case 'calories':
                if (dev > goal.calOverTol) score = 10 - (dev - goal.calOverTol) * goal.calOverK;
                else if (-dev > goal.calUnderTol) score = 10 - (-dev - goal.calUnderTol) * goal.calUnderK;
                break;
            case 'protein':
                if (-dev > 0.1) score = 10 - (-dev - 0.1) * goal.proteinK;
                break;
            case 'fiber':
                if (-dev > 0.15) score = 10 - (-dev - 0.15) * goal.fiberK;
                break;
            case 'carbs':
            case 'fat': {
                const overTol = key === 'fat' && userGoal === 'ירידה במשקל' ? 0.05 : 0.1;
                if (dev > overTol) score = 10 - (dev - overTol) * 15;
                else if (-dev > 0.3) score = 10 - (-dev - 0.3) * 6; // mild: low carbs/fat is not a big problem
                break;
            }
            case 'sugar':
            case 'sodium':
                // Ceilings: anything under the limit is fine at any time of day; only going over costs points
                if (r > 1) score = 10 - (r - 1) * (key === 'sugar' ? 25 : 20);
                break;
        }
        score = clamp(score, 0, 10);
        nutrientScores[key] = Math.round(score * 10) / 10;
        const w = goal.weights[key] ?? 1;
        weighted += score * w;
        weightSum += w;
        actualSum += Math.min(r, 1.5) * w;
    }
    let macroNutritionScore = weightSum > 0 ? weighted / weightSum : 10;
    const progressActual = weightSum > 0 ? actualSum / weightSum : e;

    // A failed calorie day (the main lever of every goal) can't be rescued by the rest
    if (nutrientScores.calories !== undefined && nutrientScores.calories < 3) {
        macroNutritionScore = Math.min(macroNutritionScore, 6);
    }

    // 3. Food quality & variety
    const names = meals.map(m => m.name || '');
    const foodGroups = Object.entries(FOOD_GROUPS)
        .filter(([, words]) => names.some(n => words.some(w => n.includes(w))))
        .map(([group]) => group);
    const unhealthyCount = names.filter(n => UNHEALTHY_KEYWORDS.some(k => n.includes(k))).length;
    // Variety expected so far: about 4 healthy food groups over a full day
    const expectedGroups = Math.max(1, Math.round(4 * Math.max(e, 0.25)));
    let healthQualityScore = 6 + 4 * Math.min(foodGroups.length / expectedGroups, 1) - Math.min(unhealthyCount * 1.5, 6);
    if (meals.length === 0) healthQualityScore = 8; // nothing eaten yet: neutral
    healthQualityScore = clamp(healthQualityScore, 1, 10);

    let baseNutritionScore = macroNutritionScore * (1 - goal.qualityShare) + healthQualityScore * goal.qualityShare;
    if (macroNutritionScore < 4) baseNutritionScore = Math.min(baseNutritionScore, 5.5);

    // 3.6 Steps (optional): part of the score only when tracking is on and the phone has sent data.
    //     Judged against where you should be by the time of the last sync; going over the goal is a bonus.
    let stepsScore: number | undefined;
    let stepsBonus = 0;
    const st = options.steps;
    if (st && st.goal > 0) {
        const r = st.count / st.goal;
        const dev = r - Math.min(Math.max(st.expected, 0), 1);
        stepsScore = clamp(dev >= -0.1 ? 10 : 10 - (-dev - 0.1) * 12, 0, 10);
        baseNutritionScore = baseNutritionScore * (1 - goal.stepsShare) + stepsScore * goal.stepsShare;
        stepsBonus = r >= 1.5 ? 0.4 : r >= 1.2 ? 0.2 : 0;
    }

    // 4. Workouts: a real workout earns the full bonus, light activity (e.g. a short walk) a small one.
    //    The "healthier lifestyle" plan puts more weight on regular training.
    let workoutBonus = 0;
    if (workouts.length > 0) {
        const hasSignificant = workouts.some(w => classifyWorkout(w).level === 'significant');
        workoutBonus = hasSignificant ? goal.workoutBonus.significant : goal.workoutBonus.light;
    }

    // 5. Final score (1-10)
    const totalScore = Number(clamp(Math.round((baseNutritionScore + workoutBonus + stepsBonus) * 10) / 10, 1, 10).toFixed(1));

    return {
        totalScore,
        nutritionScore: Number(baseNutritionScore.toFixed(1)),
        workoutBonus,
        progressExpected: Number((e * 100).toFixed(0)),
        progressActual: Number((progressActual * 100).toFixed(0)),
        healthQualityScore: Number(healthQualityScore.toFixed(1)),
        nutrientScores,
        foodGroups,
        ...(st ? { steps: st.count, stepsGoal: st.goal, stepsScore: Math.round((stepsScore ?? 0) * 10) / 10, stepsBonus } : {}),
    };
}
