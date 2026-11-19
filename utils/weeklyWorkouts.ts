import { getLogicalDayWorkouts, Workout } from '@/db/database';
import { getLogicalDayKey, getLogicalWeekForDayKey } from './calculators';
import { classifyWorkout } from './dailyScore';

/** Target workouts per week, derived from the onboarding answer (e.g. "3-4 בשבוע" -> 3-4). */
export const weeklyWorkoutTarget = (freq?: string) => {
    if (!freq || freq.includes('לא')) return { min: 0, max: 0, label: 'לא מתאמן באופן קבוע' };
    const nums = (freq.match(/\d+/g) || []).map(Number);
    return { min: nums[0] ?? 0, max: nums[1] ?? nums[0] ?? 0, label: freq };
};

export type WeekWorkoutProgress = {
    significant: number;      // real workouts this week (count toward the goal)
    light: number;            // short / easy activities (nice, but don't count)
    target: { min: number; max: number; label: string };
    dayNumber: number;        // 1 = Sunday ... 7 = Saturday
    daysLeft: number;         // days left in the week after today
    workedOutToday: boolean;  // a significant workout was logged today
};

/**
 * This week's workouts (Sunday -> Saturday, by the user's day-reset time) against the weekly goal from the plan.
 * Same classification as the daily score: only significant workouts count toward the goal.
 */
export const getWeekWorkoutProgress = async (user: { workout_frequency?: string; resetTime?: string }): Promise<WeekWorkoutProgress> => {
    const resetTime = user.resetTime || '00:00';
    const todayKey = getLogicalDayKey(new Date(), resetTime);
    const week = getLogicalWeekForDayKey(todayKey, resetTime);
    const workouts = ((await getLogicalDayWorkouts(week.start, week.end)) || []) as Workout[];
    const significantList = workouts.filter(w => classifyWorkout(w).level === 'significant');
    return {
        significant: significantList.length,
        light: workouts.length - significantList.length,
        target: weeklyWorkoutTarget(user.workout_frequency),
        dayNumber: week.dayNumber,
        daysLeft: week.daysLeftAfter,
        workedOutToday: significantList.some(w => getLogicalDayKey(new Date(w.timestamp), resetTime) === todayKey),
    };
};
