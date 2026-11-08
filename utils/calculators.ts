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
