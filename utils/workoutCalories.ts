/**
 * Workout calorie calculation – deterministic (same workout + same conditions = same result).
 *
 * Based on the Compendium of Physical Activities (standard MET values used in exercise science):
 *   calories = MET x body weight (kg) x hours
 * - Walking / running / cycling / swimming: the MET comes from the ACTUAL speed (distance / time),
 *   interpolated from Compendium values, so a faster pace burns more per minute.
 * - Gym (resistance training): energy comes mainly from the work sets, not from the clock. Each set
 *   counts as hard work (leg compounds > upper-body compounds > isolation), and the time between sets
 *   counts as light activity. More rest = only a little more, more sets = clearly more.
 * - Anything else (e.g. Thai boxing): a MET value decided once for that activity and stored with it.
 */

export type ActivityType = 'gym' | 'running' | 'cycling' | 'walking' | 'swimming' | 'other';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
    gym: 'אימון כוח', running: 'ריצה', cycling: 'רכיבה', walking: 'הליכה', swimming: 'שחייה', other: 'פעילות',
};

/** Linear interpolation over [x, y] points (x ascending), clamped at the ends. */
const interpolate = (points: [number, number][], x: number) => {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
        if (x <= points[i][0]) {
            const [x0, y0] = points[i - 1];
            const [x1, y1] = points[i];
            return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
        }
    }
    return points[points.length - 1][1];
};

// Compendium of Physical Activities (2011/2024): speed (km/h) -> MET
const WALKING: [number, number][] = [[3.2, 2.8], [4.0, 3.0], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [7.2, 7.0], [8.0, 8.3]];
const RUNNING: [number, number][] = [[6.4, 6.0], [8.0, 8.3], [8.4, 9.0], [9.7, 9.8], [10.8, 10.5], [11.3, 11.0], [12.1, 11.5], [12.9, 11.8], [13.8, 12.3], [14.5, 12.8], [16.1, 14.5], [17.7, 16.0], [19.3, 19.0]];
const CYCLING: [number, number][] = [[12, 4.0], [17.5, 6.8], [20.5, 8.0], [24, 10.0], [28, 12.0], [32, 15.8]];
// Swimming: speed in metres per minute -> MET (freestyle; ~45 m/min = 2:13 per 100 m is moderate)
const SWIMMING: [number, number][] = [[25, 4.5], [35, 5.8], [46, 7.0], [55, 8.3], [69, 9.8], [80, 11.0]];

/** MET when no distance is known: a typical moderate session of that activity. */
const DEFAULT_MET: Record<ActivityType, number> = { gym: 3.5, running: 9.8, cycling: 6.8, walking: 3.5, swimming: 7.0, other: 5.0 };

// ---- Gym (resistance training) set model ----
const REST_MET = 2.0;          // between sets: standing, moving plates, walking between machines
const MET_LEG_COMPOUND = 12;   // squat, deadlift, leg press, lunges...
const MET_UPPER_COMPOUND = 9.5; // presses, rows, pull-ups, dips...
const MET_ISOLATION = 7;        // curls, extensions, raises, calves, abs...

const ISOLATION_WORDS = ['כפיפ', 'פשיט', 'הרחק', 'פרפר', 'fly', 'פליי', 'תאומים', 'בטן', 'יד קדמית', 'יד אחורית', 'בייספס', 'טרייספס', 'curl', 'extension', 'raise', 'calf', 'קרנץ', 'פלאנק'];
const LEG_WORDS = ['רגל', 'סקוואט', 'squat', 'דדליפט', 'deadlift', 'לאנג', 'lunge', 'מכרע', 'ירך', 'ישבן', 'היפ', 'leg press'];

type ExerciseLike = { muscleGroup?: string; name?: string; sets?: string | number; reps?: string | number };

const classifySet = (ex: ExerciseLike) => {
    const text = `${ex.muscleGroup || ''} ${ex.name || ''}`.toLowerCase();
    if (ISOLATION_WORDS.some(w => text.includes(w.toLowerCase()))) return MET_ISOLATION;
    if (LEG_WORDS.some(w => text.includes(w.toLowerCase()))) return MET_LEG_COMPOUND;
    return MET_UPPER_COMPOUND;
};

const toInt = (v: any) => {
    const m = String(v ?? '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
};

export interface WorkoutCalorieInput {
    type: ActivityType;
    minutes: number;
    weightKg: number;
    distanceKm?: number | null;
    /** Gym exercises (from the template): sets x reps per exercise */
    exercises?: ExerciseLike[] | null;
    /** For "other" (or gym without set data): a MET value decided once and stored */
    met?: number | null;
}

export interface WorkoutCalorieResult {
    kcal: number;
    met: number;          // average MET of the session
    explanation: string;  // Hebrew, shown to the user
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeWorkoutCalories(input: WorkoutCalorieInput): WorkoutCalorieResult {
    const minutes = Math.max(0, Number(input.minutes) || 0);
    const kg = Math.max(30, Number(input.weightKg) || 70);
    const hours = minutes / 60;
    const km = input.distanceKm && input.distanceKm > 0 ? input.distanceKm : null;
    const label = ACTIVITY_LABELS[input.type] || 'פעילות';

    if (minutes <= 0) return { kcal: 0, met: 0, explanation: 'לא הוזן משך אימון.' };

    // Distance-based activities: MET from the real speed
    if (km && (input.type === 'walking' || input.type === 'running' || input.type === 'cycling' || input.type === 'swimming')) {
        let met: number;
        let paceText: string;
        if (input.type === 'swimming') {
            const mPerMin = (km * 1000) / minutes;
            met = interpolate(SWIMMING, mPerMin);
            const per100 = 100 / mPerMin;
            paceText = `קצב ${Math.floor(per100)}:${String(Math.round((per100 % 1) * 60)).padStart(2, '0')} ל-100 מ'`;
        } else {
            const speed = km / hours;
            met = interpolate(input.type === 'walking' ? WALKING : input.type === 'running' ? RUNNING : CYCLING, speed);
            const pace = minutes / km;
            paceText = input.type === 'cycling'
                ? `מהירות ${r1(speed)} קמ"ש`
                : `${r1(speed)} קמ"ש, קצב ${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')} לק"מ`;
        }
        const kcal = Math.round(met * kg * hours);
        return { kcal, met: r1(met), explanation: `${label} של ${r1(km)} ק"מ ב-${Math.round(minutes)} דק' (${paceText}) → עצימות ${r1(met)} MET × ${kg} ק"ג = ${kcal} קק"ל.` };
    }

    // Gym with real set data: work sets + rest between them
    if (input.type === 'gym' && input.exercises && input.exercises.length > 0) {
        let workMetMinutes = 0;
        let workMinutes = 0;
        let totalSets = 0;
        for (const ex of input.exercises) {
            const sets = toInt(ex.sets);
            if (!sets) continue;
            const reps = toInt(ex.reps) || 10;
            const setMinutes = Math.min(Math.max(reps * 3, 25), 75) / 60; // ~3 s per rep, 25-75 s per set
            workMinutes += sets * setMinutes;
            workMetMinutes += sets * setMinutes * classifySet(ex);
            totalSets += sets;
        }
        if (totalSets > 0) {
            // If the logged time is shorter than the sets themselves, scale the work down to fit
            const scale = workMinutes > minutes ? minutes / workMinutes : 1;
            workMinutes *= scale;
            workMetMinutes *= scale;
            const restMinutes = Math.max(minutes - workMinutes, 0);
            const metMinutes = workMetMinutes + restMinutes * REST_MET;
            const avgMet = Math.min(Math.max(metMinutes / minutes, 2.5), 6.5);
            const kcal = Math.round(avgMet * kg * hours);
            return {
                kcal, met: r1(avgMet),
                explanation: `${totalSets} סטים (כ-${Math.round(workMinutes)} דק' עבודה) ועוד ${Math.round(restMinutes)} דק' מנוחה בין סטים → עצימות ממוצעת ${r1(avgMet)} MET × ${kg} ק"ג = ${kcal} קק"ל.`,
            };
        }
    }

    // Everything else: a stored MET for this activity, or a typical moderate value
    const met = input.met && input.met > 0 ? Math.min(Math.max(input.met, 1.5), 16) : DEFAULT_MET[input.type] ?? 5;
    const kcal = Math.round(met * kg * hours);
    const why = input.met ? 'עצימות שנקבעה לפעילות הזו' : km ? 'עצימות טיפוסית' : 'עצימות טיפוסית (בלי מרחק)';
    return { kcal, met: r1(met), explanation: `${label} של ${Math.round(minutes)} דק' – ${why} ${r1(met)} MET × ${kg} ק"ג = ${kcal} קק"ל.` };
}
