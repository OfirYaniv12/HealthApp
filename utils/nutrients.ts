export const DEFAULT_TRACKED_NUTRIENTS = { calories: true, protein: true, carbs: true, fat: true, fiber: true, sodium: true, sugar: true };

export type NutrientKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sodium' | 'sugar';
export const NUTRIENT_KEYS: NutrientKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'sugar'];

/**
 * Single source of truth for "is this nutrient tracked?".
 * Every nutrient is ON unless the user explicitly switched it off in Settings
 * (the settings screen saves only the switches that were changed, e.g. { sodium: false }).
 */
export const isNutrientTracked = (trackedNutrients: Record<string, boolean> | null | undefined, key: string) =>
    trackedNutrients?.[key] !== false;

export const getActiveNutrients = (trackedNutrients?: Record<string, boolean> | null): NutrientKey[] =>
    NUTRIENT_KEYS.filter(key => isNutrientTracked(trackedNutrients, key));

/** Daily targets with sensible defaults for the secondary nutrients. */
export const getNutrientTargets = (dailyTargets: Partial<Record<NutrientKey, number>> | null | undefined): Record<NutrientKey, number> => ({
    calories: dailyTargets?.calories || 0,
    protein: dailyTargets?.protein || 0,
    carbs: dailyTargets?.carbs || 0,
    fat: dailyTargets?.fat || 0,
    fiber: dailyTargets?.fiber || 30,
    sodium: dailyTargets?.sodium || 2300,
    sugar: dailyTargets?.sugar || 50,
});

/** Nutrients where the target is a ceiling (less is fine) vs. a goal to reach. */
export const LIMIT_NUTRIENTS: NutrientKey[] = ['sodium', 'sugar'];
export const REACH_NUTRIENTS: NutrientKey[] = ['protein', 'fiber'];

/**
 * Traffic-light status for a nutrient bar.
 * expectedProgress (0..1) is how much of the day's intake is expected by now, so eating little
 * in the morning is not shown as a problem; for a finished day pass 1.
 */
export const getNutrientStatus = (key: string, consumed: number, target: number, expectedProgress: number = 1): 'green' | 'yellow' | 'red' => {
    if (!target || target <= 0) return 'green';
    const ratio = consumed / target;
    if (LIMIT_NUTRIENTS.includes(key as NutrientKey)) {
        if (ratio <= 1) return 'green';
        return ratio <= 1.15 ? 'yellow' : 'red';
    }
    if (REACH_NUTRIENTS.includes(key as NutrientKey)) {
        const expected = Math.max(expectedProgress, 0.0001);
        const vsExpected = ratio / expected;
        if (vsExpected >= 0.8) return 'green';
        return vsExpected >= 0.5 ? 'yellow' : (expectedProgress < 0.5 ? 'yellow' : 'red');
    }
    // calories / carbs / fat: aim to land near the target
    if (ratio > 1.15) return 'red';
    if (ratio > 1.05) return 'yellow';
    if (expectedProgress >= 0.95 && ratio < 0.7) return 'yellow';
    return 'green';
};

export const NUTRIENT_STATUS_COLORS = { green: '#10b981', yellow: '#f59e0b', red: '#ef4444' };

/** Expected share of the day's eating done by now (08:00-22:00 window), matching the daily score. */
export const getExpectedProgressNow = (resetTime: string = '00:00', now: Date = new Date()) => {
    const hour = now.getHours() + now.getMinutes() / 60;
    const [rh, rm] = (resetTime || '00:00').split(':').map(Number);
    if (hour < (rh || 0) + (rm || 0) / 60) return 1; // late night still belongs to the previous day
    if (hour < 8) return 0;
    if (hour >= 22) return 1;
    return (hour - 8) / 14;
};

export const nutrientLabelsLoc: Record<string, string> = {
    calories: 'קק״ל',
    protein: 'חלבון',
    carbs: 'פחמימה',
    fat: 'שומן',
    fiber: 'סיבים',
    sodium: 'נתרן',
    sugar: 'סוכר'
};
