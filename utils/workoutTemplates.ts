import { addWorkout, updateWorkoutTemplate, updateWorkoutTemplateLastPerformed, WorkoutTemplate } from '@/db/database';
import { UserData } from '@/store/useUserStore';
import { estimateActivityMET } from '@/utils/ai';
import { computeWorkoutCalories } from '@/utils/workoutCalories';
import { triggerScoreExplanationUpdate } from '@/utils/scoreUpdater';

/**
 * Shared logic for "My Workouts" templates, used by every screen that logs a
 * template (the My Workouts screen and the "choose from my workouts" picker in
 * the workout chat), so they all behave the same way.
 */

export type WorkoutType = 'gym' | 'running' | 'cycling' | 'walking' | 'swimming' | 'other';

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
    gym: 'חדר כושר',
    running: 'ריצה',
    cycling: 'רכיבה',
    walking: 'הליכה',
    swimming: 'שחייה',
    other: 'אחר',
};

/** Workout types where distance matters for the calorie estimate. */
export const DISTANCE_TYPES: WorkoutType[] = ['running', 'cycling', 'walking', 'swimming'];

/** All workout types in display order (used for the type picker and the filters). */
export const WORKOUT_TYPES: { id: WorkoutType; label: string; icon: string }[] = [
    { id: 'gym', label: 'חדר כושר', icon: 'barbell-outline' },
    { id: 'running', label: 'ריצה', icon: 'walk-outline' },
    { id: 'cycling', label: 'רכיבה', icon: 'bicycle-outline' },
    { id: 'walking', label: 'הליכה', icon: 'footsteps-outline' },
    { id: 'swimming', label: 'שחייה', icon: 'water-outline' },
    { id: 'other', label: 'אחר', icon: 'list-outline' },
];

export interface TemplateMeta {
    type: WorkoutType;
    requireTimeOnLog: boolean;
    presetDuration: string;
    distance: string;
    notes: string;
    /** Intensity (MET) decided once for an "other" activity, so every log of it is calculated the same way */
    met?: number;
    /** The notes the stored MET was decided for (re-decided if the description changes) */
    metFor?: string;
    /** Gym: the user's average rest between sets, in seconds (optional) */
    restSeconds?: number;
}

const KNOWN_TYPES: WorkoutType[] = ['gym', 'running', 'cycling', 'walking', 'swimming', 'other'];

/** Reads the settings stored with a template (type, fixed duration, distance...). Handles old templates too. */
export const parseTemplateMeta = (template: Pick<WorkoutTemplate, 'description' | 'exercises'>): TemplateMeta => {
    const meta: TemplateMeta = { type: 'gym', requireTimeOnLog: true, presetDuration: '', distance: '', notes: '' };

    let hasTypeFromDescription = false;
    try {
        if (template.description && template.description.trim().startsWith('{')) {
            const md = JSON.parse(template.description);
            if (md.type && KNOWN_TYPES.includes(md.type)) {
                meta.type = md.type;
                hasTypeFromDescription = true;
            }
            if (md.requireTimeOnLog === false) meta.requireTimeOnLog = false;
            if (md.presetDuration !== undefined && md.presetDuration !== null) meta.presetDuration = String(md.presetDuration);
            if (md.distance) meta.distance = String(md.distance);
            if (typeof md.met === 'number' && md.met > 0) meta.met = md.met;
            if (typeof md.metFor === 'string') meta.metFor = md.metFor;
            if (typeof md.restSeconds === 'number' && md.restSeconds > 0) meta.restSeconds = md.restSeconds;
            if (md.notes) meta.notes = String(md.notes);
        }
    } catch (e) { }

    // Older templates: the type is only recorded as the "muscleGroup" of the single exercise row
    if (!hasTypeFromDescription) {
        try {
            const exs = JSON.parse(template.exercises || '[]');
            if (Array.isArray(exs) && exs.length === 1 && KNOWN_TYPES.includes(exs[0]?.muscleGroup)) {
                meta.type = exs[0].muscleGroup;
            }
        } catch (e) { }
    }

    return meta;
};

/** Returns the fixed duration in minutes if the template was set to "don't ask for time", else null. */
export const getFixedDuration = (meta: TemplateMeta): number | null => {
    if (meta.requireTimeOnLog) return null;
    const n = parseFloat(meta.presetDuration);
    return isNaN(n) || n <= 0 ? null : n;
};

/** Parses free text distance like "5", "5 ק"מ", "5.2km", "800 מטר", "800m" into kilometres. */
export const parseDistanceKm = (text: string | null | undefined): number | null => {
    if (!text) return null;
    const match = String(text).replace(',', '.').match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    if (isNaN(value) || value <= 0) return null;
    const isMeters = /מטר|מ'|(\d|\s)m\b|meter/i.test(text) && !/ק"מ|ק״מ|קמ|km|קילומטר/i.test(text);
    return isMeters ? value / 1000 : value;
};


export interface LogTemplateParams {
    user: UserData;
    template: WorkoutTemplate;
    durationMinutes: number;
    distanceText?: string | null;
    notes?: string | null;
}

/**
 * Calculates the calories of a template workout (deterministic – see utils/workoutCalories.ts)
 * and saves it to the log. Same template + same duration (+ same distance) = same result every time.
 */
export const logTemplateWorkout = async ({ user, template, durationMinutes, distanceText, notes }: LogTemplateParams) => {
    const meta = parseTemplateMeta(template);
    const usesDistance = DISTANCE_TYPES.includes(meta.type);
    const distanceKm = usesDistance ? parseDistanceKm(distanceText ?? meta.distance) : null;

    let exercises: any[] = [];
    try { exercises = JSON.parse(template.exercises || '[]'); } catch (e) { }

    // "Other" activities (e.g. Thai boxing): decide the intensity ONCE with the AI and store it on the template
    let met: number | null = null;
    if (meta.type === 'other') {
        const describedAs = `${template.name} | ${meta.notes || ''}`;
        if (meta.met && meta.metFor === describedAs) {
            met = meta.met;
        } else {
            met = await estimateActivityMET(template.name, meta.notes || template.summary || null);
            if (met) {
                try {
                    const md = template.description && template.description.trim().startsWith('{') ? JSON.parse(template.description) : { type: 'other' };
                    await updateWorkoutTemplate(template.id!, { description: JSON.stringify({ ...md, met, metFor: describedAs }) });
                } catch (e) { console.warn('Could not store activity intensity', e); }
            }
        }
    }

    const result = computeWorkoutCalories({
        type: meta.type,
        minutes: durationMinutes,
        weightKg: user?.weight || 70,
        distanceKm,
        exercises: meta.type === 'gym' ? exercises : null,
        met,
        restSeconds: meta.restSeconds ?? null,
    });

    const descParts: string[] = [WORKOUT_TYPE_LABELS[meta.type]];
    if (distanceKm) descParts.push(`מרחק: ${Math.round(distanceKm * 100) / 100} ק"מ`);
    if (notes) descParts.push(`הערות: ${notes}`);
    const description = descParts.join(' · ') + `

${result.explanation}`;

    const now = new Date().toISOString();
    await addWorkout({
        name: template.name,
        duration_minutes: durationMinutes,
        calories_burned: result.kcal,
        exercises: template.exercises,
        description,
        timestamp: now,
    });
    await updateWorkoutTemplateLastPerformed(template.id!, now);
    triggerScoreExplanationUpdate();

    return { calBurned: result.kcal, summary: result.explanation, distanceKm };
};
