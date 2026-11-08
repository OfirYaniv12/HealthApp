export type GoalType = 'ירידה במשקל' | 'עלייה במסת שריר' | 'שילוב מתון' | 'אורח חיים בריא יותר';
export type GenderType = 'Male' | 'Female';
export type ActivityLevel = 'לא פעיל כלל' | 'פעיל באופן נמוך' | 'פעיל באופן ממוצע' | 'פעיל באופן גבוה';
export type WorkoutFrequency = 'כלל לא מתאמן' | '1-2 בשבוע' | '3-4 בשבוע' | '5-7 בשבוע';
export type BodyType = 'רזה' | 'ממוצע' | 'אתלטי' | 'שרירי' | 'מלא' | 'חטוב';
export type TargetPace = 'מתון' | 'בינוני' | 'אגרסיבי';



const parseResetTime = (resetTime: string = '00:00') => {
    const [h, m] = (resetTime || '00:00').split(':').map(Number);
    return { h: h || 0, m: m || 0 };
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (not UTC, so it never shifts a day in Israel's timezone). */
export const toLocalDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * The "logical day" a moment belongs to, given the user's day-reset time.
 * With reset 02:00, Thursday 00:18 belongs to Wednesday.
 */
export const getLogicalDayKey = (date: Date = new Date(), resetTime: string = '00:00') => {
    const { h, m } = parseResetTime(resetTime);
    const start = new Date(date);
    start.setHours(h, m, 0, 0);
    if (date < start) start.setDate(start.getDate() - 1);
    return toLocalDateKey(start);
};

/** Start / end of a logical day identified by its YYYY-MM-DD key. */
export const getLogicalDayBoundsForKey = (dayKey: string, resetTime: string = '00:00') => {
    const [y, mo, d] = dayKey.split('-').map(Number);
    const { h, m } = parseResetTime(resetTime);
    const startDate = new Date(y, mo - 1, d, h, m, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    return { start: startDate.toISOString(), end: endDate.toISOString(), startDate, endDate };
};

export const getLogicalDayBounds = (resetTime: string = '00:00') => {
    const now = new Date();
    const [resetHour, resetMinute] = resetTime.split(':').map(Number);

    const start = new Date(now);
    start.setHours(resetHour, resetMinute, 0, 0);

    // If current time is before the reset time today, the logical day started yesterday
    if (now < start) {
        start.setDate(start.getDate() - 1);
    }

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return {
        start: start.toISOString(),
        end: end.toISOString()
    };
};

/**
 * Daily nutrition targets, calculated with standard formulas (deterministic, no AI arithmetic):
 * - BMR: Mifflin-St Jeor
 * - TDEE: BMR x (daily activity + training frequency)
 * - Calories adjusted by goal and chosen pace, never below a safe floor
 * - Protein by goal (g/kg, using an adjusted weight when BMI > 30), fat ~0.9 g/kg, carbs = the rest
 * - Fiber 14 g / 1000 kcal, sodium 2300 mg, added-sugar cap 10% of calories (max 50 g)
 */
export const calculateDailyTargets = (u: {
    gender: string; age: number; height: number; weight: number; goal: GoalType | string;
    activity_level?: string; workout_frequency?: string; target_pace?: string;
}) => {
    const isMale = u.gender === 'Male' || u.gender === 'זכר';
    const bmr = 10 * u.weight + 6.25 * u.height - 5 * u.age + (isMale ? 5 : -161);

    const dailyActivity: Record<string, number> = {
        'לא פעיל כלל': 1.2, 'פעיל באופן נמוך': 1.3, 'פעיל באופן ממוצע': 1.4, 'פעיל באופן גבוה': 1.55,
    };
    const training: Record<string, number> = {
        'כלל לא מתאמן': 0, '1-2 בשבוע': 0.075, '3-4 בשבוע': 0.15, '5-7 בשבוע': 0.25,
    };
    const multiplier = Math.min((dailyActivity[u.activity_level || ''] ?? 1.3) + (training[u.workout_frequency || ''] ?? 0.075), 1.9);
    const tdee = bmr * multiplier;

    const pace = u.target_pace || 'בינוני';
    let calories = tdee;
    let goalNote = '';
    switch (u.goal) {
        case 'ירידה במשקל': {
            const deficit = pace === 'מתון' ? 300 : pace === 'אגרסיבי' ? 750 : 500;
            calories = tdee - deficit;
            goalNote = `גירעון של ${deficit} קק"ל לירידה במשקל (קצב ${pace})`;
            break;
        }
        case 'עלייה במסת שריר': {
            const surplus = pace === 'מתון' ? 200 : pace === 'אגרסיבי' ? 450 : 300;
            calories = tdee + surplus;
            goalNote = `עודף של ${surplus} קק"ל לבניית שריר (קצב ${pace})`;
            break;
        }
        case 'שילוב מתון':
            calories = tdee - 200;
            goalNote = 'גירעון קטן של 200 קק"ל עם חלבון גבוה – ירידה בשומן ושמירה/בניית שריר';
            break;
        default:
            goalNote = 'שמירה על המשקל הנוכחי';
    }
    const floor = Math.max(bmr, isMale ? 1500 : 1200);
    calories = Math.max(calories, floor);

    const heightM = u.height / 100;
    const bmi = u.weight / (heightM * heightM);
    // For high BMI, protein per kg of total weight overshoots; use the weight at BMI 27 instead
    const refWeight = bmi > 30 ? 27 * heightM * heightM : u.weight;
    const proteinPerKg = u.goal === 'עלייה במסת שריר' ? 1.8 : (u.goal === 'ירידה במשקל' || u.goal === 'שילוב מתון') ? 2.0 : 1.6;
    const protein = proteinPerKg * refWeight;
    let fat = 0.9 * refWeight;
    let carbs = (calories - protein * 4 - fat * 9) / 4;
    if (carbs < 100) {
        fat = Math.max(0.6 * refWeight, (calories - protein * 4 - 100 * 4) / 9);
        carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);
    }

    const r = (n: number) => Math.round(n);
    const targets = {
        calories: r(calories),
        protein: r(protein),
        fat: r(fat),
        carbs: r(carbs),
        fiber: r((calories / 1000) * 14),
        sodium: 2300,
        sugar: Math.min(50, r((calories * 0.1) / 4)),
    };
    const explanation =
        `חילוף חומרים במנוחה (BMR): כ-${r(bmr)} קק"ל. ` +
        `עם רמת הפעילות והאימונים שלך (מקדם ${multiplier.toFixed(2)}): כ-${r(tdee)} קק"ל ביום. ` +
        `${goalNote} → יעד של ${targets.calories} קק"ל. ` +
        `חלבון ${targets.protein} ג' (${proteinPerKg} ג' לק"ג), שומן ${targets.fat} ג', פחמימות ${targets.carbs} ג'.`;
    return { targets, explanation, bmr: r(bmr), tdee: r(tdee) };
};
