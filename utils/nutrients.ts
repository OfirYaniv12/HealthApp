export const DEFAULT_TRACKED_NUTRIENTS = { calories: true, protein: true, carbs: true, fat: true, fiber: true, sodium: true, sugar: true };

export const getActiveNutrients = (trackedNutrients?: Record<string, boolean>) => {
    const predefinedOrder = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'sugar'];
    const active = Object.entries(trackedNutrients || DEFAULT_TRACKED_NUTRIENTS)
        .filter(([_, isTracked]) => isTracked)
        .map(([key]) => key as 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sodium' | 'sugar');

    return active.sort((a, b) => predefinedOrder.indexOf(a) - predefinedOrder.indexOf(b));
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
