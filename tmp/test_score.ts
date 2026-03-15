import { calculateDailyScore } from '../utils/dailyScore';

console.log("=== Testing Daily Score Algorithm ===\\n");

const baseTargets = { calories: 2000, protein: 100, carbs: 250, fat: 70 };
const tracked = { calories: true, protein: true, carbs: true, fat: true };

// Scenario 1: Morning, perfectly on track (0% expected, 0% actual)
const time1 = new Date();
time1.setHours(8, 0, 0, 0);
let score1 = calculateDailyScore([], [], baseTargets, tracked, time1.getTime());
console.log("Scenario 1 (08:00 AM, No meals, No workouts):", score1);
// Expect: High score (~8), no workout bonus.

// Scenario 2: Afternoon (15:00), halfway through expected, halfway through macros. No workout.
const time2 = new Date();
time2.setHours(15, 0, 0, 0);
const meals2 = [
    { id: 1, name: 'Lunch', calories: 1000, protein: 50, carbs: 125, fat: 35, timestamp: '' } as any
];
let score2 = calculateDailyScore(meals2, [], baseTargets, tracked, time2.getTime());
console.log("\\nScenario 2 (15:00 PM, 50% meals, No workouts):", score2);
// Expect: High score (~8), no workout boomus.

// Scenario 3: Night (22:00), missed all macros. No workout.
const time3 = new Date();
time3.setHours(22, 0, 0, 0);
let score3 = calculateDailyScore([], [], baseTargets, tracked, time3.getTime());
console.log("\\nScenario 3 (22:00 PM, No meals, No workouts):", score3);
// Expect: Low score (Heavy penalty for missing 100% expected progress)

// Scenario 4: Afternoon (15:00), 100% macros met (eat too fast). + Workout.
const meals4 = [
    { id: 1, name: 'Feast', calories: 2000, protein: 100, carbs: 250, fat: 70, timestamp: '' } as any
];
const workouts4 = [
    { id: 1, name: 'Run', duration_minutes: 30, calories_burned: 300, timestamp: '' } as any
];
let score4 = calculateDailyScore(meals4, workouts4, baseTargets, tracked, time2.getTime());
console.log("\\nScenario 4 (15:00 PM, 100% macros consumed, +Workout):", score4);
// Expect: Mid-High score. Penalized for eating too fast, but gets +2 workout bonus.
