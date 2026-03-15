export type GoalType = 'ירידה במשקל' | 'עלייה במסת שריר' | 'שילוב מתון' | 'אורח חיים בריא יותר';
export type GenderType = 'Male' | 'Female';
export type ActivityLevel = 'לא פעיל כלל' | 'פעיל באופן נמוך' | 'פעיל באופן ממוצע' | 'פעיל באופן גבוה';
export type WorkoutFrequency = 'כלל לא מתאמן' | '1-2 בשבוע' | '3-4 בשבוע' | '5-7 בשבוע';
export type BodyType = 'רזה' | 'ממוצע' | 'אתלטי' | 'שרירי' | 'מלא' | 'חטוב';
export type TargetPace = 'מתון' | 'בינוני' | 'אגרסיבי';



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
