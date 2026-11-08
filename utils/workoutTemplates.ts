import { addWorkout, updateWorkoutTemplateLastPerformed, WorkoutTemplate } from '@/db/database';
import { UserData } from '@/store/useUserStore';
import { estimateTemplateWorkout } from '@/utils/ai';
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

const formatKm = (km: number) => (Math.round(km * 100) / 100).toString();

/** Simple physics fallback for when the AI is unavailable. */
const fallbackCalories = (type: WorkoutType, weightKg: number, durationMin: number, distanceKm: number | null) => {
    if (distanceKm && DISTANCE_TYPES.includes(type) && type !== 'swimming') {
        // Gross energy cost per kg per km (well established approximations)
        const perKgKm = type === 'running' ? 1.0 : type === 'walking' ? 0.65 : 0.3;
        return Math.round(perKgKm * weightKg * distanceKm);
    }
    const met = type === 'gym' ? 3.5 : type === 'running' ? 8.5 : type === 'cycling' ? 7 : type === 'walking' ? 3.5 : type === 'swimming' ? 7 : 5;
    return Math.round(met * weightKg * (durationMin / 60));
};

export interface LogTemplateParams {
    user: UserData;
    template: WorkoutTemplate;
    durationMinutes: number;
    distanceText?: string | null;
    notes?: string | null;
}

/** Estimates calories (taking distance into account) and saves the workout to the log. */
export const logTemplateWorkout = async ({ user, template, durationMinutes, distanceText, notes }: LogTemplateParams) => {
    const meta = parseTemplateMeta(template);
    const usesDistance = DISTANCE_TYPES.includes(meta.type);
    const distanceKm = usesDistance ? parseDistanceKm(distanceText ?? meta.distance) : null;

    const aiEstimation = await estimateTemplateWorkout(
        user,
        template.name,
        template.exercises || template.description || null,
        notes || null,
        durationMinutes,
        { type: meta.type, distanceKm }
    );

    const calBurned = aiEstimation?.calories_burned
        ? Math.round(aiEstimation.calories_burned)
        : fallbackCalories(meta.type, user?.weight || 74, durationMinutes, distanceKm);

    const descParts: string[] = [WORKOUT_TYPE_LABELS[meta.type]];
    if (distanceKm) {
        descParts.push(`מרחק: ${formatKm(distanceKm)} ק"מ`);
        const paceMinPerKm = durationMinutes / distanceKm;
        const speedKmh = distanceKm / (durationMinutes / 60);
        descParts.push(meta.type === 'cycling'
            ? `מהירות ממוצעת: ${speedKmh.toFixed(1)} קמ"ש`
            : `קצב: ${Math.floor(paceMinPerKm)}:${String(Math.round((paceMinPerKm % 1) * 60)).padStart(2, '0')} דק'/ק"מ`);
    }
    if (notes) descParts.push(`הערות: ${notes}`);
    const description = descParts.join(' · ') + (aiEstimation?.summary ? `\n\n${aiEstimation.summary}` : '');

    const now = new Date().toISOString();
    await addWorkout({
        name: template.name,
        duration_minutes: durationMinutes,
        calories_burned: calBurned,
        exercises: template.exercises,
        description,
        timestamp: now,
    });
    await updateWorkoutTemplateLastPerformed(template.id!, now);
    triggerScoreExplanationUpdate();

    return { calBurned, summary: aiEstimation?.summary || '', distanceKm };
};
