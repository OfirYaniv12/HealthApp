import { supabase } from '@/utils/supabase';
import { getLogicalDayBoundsForKey } from '@/utils/calculators';

/**
 * Optional steps tracking.
 * The iPhone "Shortcuts" app sends steps per HOUR to /api/steps (see supabase/steps.sql and api/steps.js).
 * Here we assign every hour to the right logical day using the user's day-reset time, set a daily
 * goal by plan + personal details, and decide when steps take part in the daily score.
 */

/** The address the iPhone shortcut sends to (always the live site, also when testing locally). */
export const STEPS_ENDPOINT = 'https://health-app-mu-orpin.vercel.app/api/steps';

const HOUR_MS = 60 * 60 * 1000;

type UserLike = {
    goal?: string; age?: number; activity_level?: string; stepsEnabled?: boolean;
};

/** Steps tracking is ON by default; the user can switch it off in Settings. */
export const isStepsEnabled = (user: UserLike | null | undefined) => !!user && user.stepsEnabled !== false;

/**
 * Daily steps goal by plan and personal details.
 * Research: health benefits rise up to ~7,000-10,000 steps/day (and ~6,000-8,000 for people over 60);
 * weight loss benefits from more daily movement, muscle gain needs less (energy goes to recovery).
 * The goal starts lower for people who are currently inactive, so it's realistic to reach.
 */
export const calculateStepsGoal = (user: UserLike | null | undefined) => {
    const base: Record<string, number> = {
        'ירידה במשקל': 10000,
        'שילוב מתון': 9000,
        'אורח חיים בריא יותר': 8000,
        'עלייה במסת שריר': 7000,
    };
    let goal = base[user?.goal || ''] ?? 8000;
    const activityAdjust: Record<string, number> = {
        'לא פעיל כלל': -2000, 'פעיל באופן נמוך': -1000, 'פעיל באופן ממוצע': 0, 'פעיל באופן גבוה': 1000,
    };
    goal += activityAdjust[user?.activity_level || ''] ?? 0;
    if ((user?.age || 0) >= 60) goal = Math.min(goal, 7500);
    goal = Math.min(Math.max(Math.round(goal / 500) * 500, 5000), 12000);
    return goal;
};

export interface StepsStatus {
    connected: boolean;          // the shortcut has sent data at least once
    lastSyncAt: number | null;   // when the shortcut last sent data (ms)
    available: boolean;          // the database part exists (SQL was run)
}

/** When the iPhone last sent steps (null if never). Never throws. */
export const getStepsStatus = async (): Promise<StepsStatus> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return { connected: false, lastSyncAt: null, available: true };
        const { data, error } = await supabase.from('step_tokens').select('last_used_at').eq('user_id', session.user.id).maybeSingle();
        if (error) return { connected: false, lastSyncAt: null, available: false };
        const last = data?.last_used_at ? new Date(data.last_used_at).getTime() : null;
        return { connected: !!last, lastSyncAt: last, available: true };
    } catch (e) {
        return { connected: false, lastSyncAt: null, available: false };
    }
};

/** The user's personal steps key for the shortcut (created on first use). */
export const getStepsKey = async (regenerate = false): Promise<string | null> => {
    const { data, error } = await supabase.rpc('get_steps_token', { p_regenerate: regenerate });
    if (error) {
        console.warn('[steps] could not get key', error.message);
        return null;
    }
    return typeof data === 'string' ? data : null;
};

type HourRow = { hour_start: string; steps: number };

/** Sums hourly steps inside [start, end). An hour cut by the boundary (reset time not on the hour) counts proportionally. */
const sumHours = (rows: HourRow[], startMs: number, endMs: number) => {
    let total = 0;
    for (const r of rows) {
        const h0 = new Date(r.hour_start).getTime();
        const h1 = h0 + HOUR_MS;
        const overlap = Math.min(h1, endMs) - Math.max(h0, startMs);
        if (overlap > 0) total += r.steps * (overlap / HOUR_MS);
    }
    return Math.round(total);
};

const fetchHours = async (startMs: number, endMs: number): Promise<HourRow[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];
    const { data, error } = await supabase
        .from('step_hours')
        .select('hour_start, steps')
        .eq('user_id', session.user.id)
        .gte('hour_start', new Date(startMs - HOUR_MS).toISOString())
        .lt('hour_start', new Date(endMs).toISOString());
    if (error) return [];
    return (data || []) as HourRow[];
};

/** Steps of one logical day (by the user's day-reset time). */
export const getStepsForDay = async (dayKey: string, resetTime: string = '00:00') => {
    const { startDate, endDate } = getLogicalDayBoundsForKey(dayKey, resetTime);
    const rows = await fetchHours(startDate.getTime(), endDate.getTime());
    return sumHours(rows, startDate.getTime(), endDate.getTime());
};

/** Steps for many logical days at once (used by the calendar). */
export const getStepsForDays = async (dayKeys: string[], resetTime: string = '00:00') => {
    if (dayKeys.length === 0) return {} as Record<string, number>;
    const bounds = dayKeys.map(k => ({ k, ...getLogicalDayBoundsForKey(k, resetTime) }));
    const minStart = Math.min(...bounds.map(b => b.startDate.getTime()));
    const maxEnd = Math.max(...bounds.map(b => b.endDate.getTime()));
    const rows = await fetchHours(minStart, maxEnd);
    const out: Record<string, number> = {};
    for (const b of bounds) out[b.k] = sumHours(rows, b.startDate.getTime(), b.endDate.getTime());
    return out;
};

/** Share of the day's steps expected by a given moment (08:00-22:00 window, like the eating schedule). */
const expectedShareAt = (ms: number, resetTime: string) => {
    const d = new Date(ms);
    const hour = d.getHours() + d.getMinutes() / 60;
    const [rh, rm] = (resetTime || '00:00').split(':').map(Number);
    if (hour < (rh || 0) + (rm || 0) / 60) return 1;
    if (hour < 8) return 0;
    if (hour >= 22) return 1;
    return (hour - 8) / 14;
};

export interface StepsForScore {
    count: number;
    goal: number;
    expected: number; // share of the goal expected by the time of the last sync (0..1)
}

/**
 * Steps input for the daily score, or null when steps must NOT affect the score:
 * - tracking is off, or the iPhone never sent data (people who don't use it are never penalised)
 * - nothing was synced during that day
 * The expectation is measured at the time of the last sync, not "now": steps the phone hasn't sent yet
 * (phone locked, shortcut didn't run) are never a penalty. A finished day whose last sync happened
 * before the day ended is judged only up to that sync.
 */
export const getStepsForScore = async (
    user: UserLike & { resetTime?: string },
    dayKey: string,
    dayComplete: boolean,
    status?: StepsStatus
): Promise<StepsForScore | null> => {
    if (!isStepsEnabled(user)) return null;
    const st = status || await getStepsStatus();
    if (!st.connected || !st.lastSyncAt) return null;
    const resetTime = user.resetTime || '00:00';
    const { startDate, endDate } = getLogicalDayBoundsForKey(dayKey, resetTime);
    if (st.lastSyncAt < startDate.getTime()) return null; // nothing synced during this day yet
    const count = await getStepsForDay(dayKey, resetTime);
    return stepsScoreInputFromCount(user, dayKey, count, st);
};

/** Same rules as getStepsForScore, for when the day's count is already known (the calendar loads a month at once). */
export const stepsScoreInputFromCount = (
    user: UserLike & { resetTime?: string },
    dayKey: string,
    count: number,
    status: StepsStatus
): StepsForScore | null => {
    if (!isStepsEnabled(user) || !status.connected || !status.lastSyncAt) return null;
    const resetTime = user.resetTime || '00:00';
    const { startDate, endDate } = getLogicalDayBoundsForKey(dayKey, resetTime);
    if (status.lastSyncAt < startDate.getTime()) return null;
    const syncedAfterDayEnd = status.lastSyncAt >= endDate.getTime();
    const expected = syncedAfterDayEnd ? 1 : expectedShareAt(Math.min(status.lastSyncAt, Date.now()), resetTime);
    return { count, goal: calculateStepsGoal(user), expected };
};
