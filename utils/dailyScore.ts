import { Meal, Workout } from '@/db/database';

import { GoalType } from './calculators';

export interface ScoreBreakdown {
    totalScore: number;
    nutritionScore: number;
    workoutBonus: number;
    progressExpected: number;
    progressActual: number;
    healthQualityScore: number;
}

export function calculateDailyScore(
    meals: Meal[],
    workouts: Workout[],
    targets: Record<string, number>,
    tracked: Record<string, boolean> | undefined,
    userGoal: GoalType = 'אורח חיים בריא יותר',
    currentTimeMs: number = Date.now(),
    resetTimeStr: string = '00:00'
): ScoreBreakdown {
    // 1. Calculate Time Progress (Expected Progress)
    // Assuming a standard "active" day is from 08:00 to 22:00 (14 hours) for eating.
    const now = new Date(currentTimeMs);
    const hour = now.getHours() + now.getMinutes() / 60;

    let progressExpected = 0;
    if (hour < 8) {
        progressExpected = 0.0; // 0% expected before 8 AM
    } else if (hour >= 22) {
        progressExpected = 1.0; // 100% expected after 10 PM
    } else {
        // Linearly scale from 8:00 (0.00) to 22:00 (1.0)
        progressExpected = ((hour - 8) / 14);
    }

    // 2. Calculate Nutritional Progress
    let totalProgressSum = 0;
    let trackedCount = 0;

    // By default track main 4, else use tracked object
    const isTracked = (key: string) => tracked === undefined ? ['calories', 'protein', 'carbs', 'fat'].includes(key) : tracked[key] === true;

    const nutrientKeys = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'sugar'];

    // Goal-based dynamic weighting
    const getWeight = (key: string) => {
        if (!isTracked(key)) return 0;
        let weight = 1.0;

        switch (userGoal) {
            case 'עלייה במסת שריר':
                if (key === 'protein') weight = 2.0;
                if (key === 'calories') weight = 1.5;
                break;
            case 'ירידה במשקל':
                if (key === 'calories') weight = 2.0;
                if (key === 'sugar' || key === 'fat') weight = 1.5;
                break;
            case 'שילוב מתון':
                if (key === 'protein') weight = 1.5;
                if (key === 'calories') weight = 1.5;
                break;
            case 'אורח חיים בריא יותר':
            default:
                if (key === 'sodium' || key === 'sugar') weight = 1.5;
                if (key === 'fiber') weight = 1.2;
                break;
        }
        return weight;
    };

    let totalWeight = 0;

    const getMacroProgressWithWeight = (key: string) => {
        if (!isTracked(key) || !targets[key]) return null;
        const consumed = meals.reduce((sum, meal) => sum + ((meal[key as keyof Meal] as number) || 0), 0);
        let ratio = consumed / targets[key];

        // Positive macros (we want to hit the target, no penalty for slight overage)
        if (key === 'protein' || key === 'fiber') {
            return Math.min(ratio, 1.0); // Capped at 100% progress
        }

        // Limit-based macros (over-consuming should ruin progress)
        if (key === 'sugar' || key === 'sodium' || key === 'fat' || key === 'calories' || key === 'carbs') {
            if (ratio <= 1.0) {
                return ratio; // Normal progress up to 100%
            } else {
                // If you eat 200% of your sugar, you don't get 100% progress. You get severely negative progress.
                // ratio = 1.5 -> progress = 1.0 - (0.5 * 2) = 0.0
                // ratio = 2.0 -> progress = 1.0 - (1.0 * 2) = -1.0
                const overage = ratio - 1.0;
                let penaltyMultiplier = key === 'sugar' ? 3.0 : 2.0; // Sugar is especially penalized
                return Math.max(1.0 - (overage * penaltyMultiplier), -2.0); // Cap extreme negatives at -200% impact
            }
        }

        return Math.min(ratio, 1.0);
    };

    nutrientKeys.forEach(key => {
        const prog = getMacroProgressWithWeight(key);
        if (prog !== null) {
            const w = getWeight(key);
            totalProgressSum += (prog * w);
            totalWeight += w;
            trackedCount++;
        }
    });

    // If nothing tracked, default to expected
    const progressActual = totalWeight > 0 ? (totalProgressSum / totalWeight) : progressExpected;

    // 3. Compare Actual vs Expected 
    // We want Actual to be close to Expected. 
    // If you're 20% behind expected, you lose points. If you're 20% ahead, you might lose points (eating too much too fast).
    let diff = progressActual - progressExpected;

    // Penalize more for being behind than being slightly ahead
    let penalty = 0;
    if (diff < -0.1) {
        // Falling behind (e.g., 10% behind expected)
        penalty = Math.abs(diff + 0.1) * 10; // lose 1 point for every 10% behind buffer
    } else if (diff > 0.3) {
        // Eating way too fast (e.g., 30% ahead of schedule)
        penalty = (diff - 0.3) * 5; // lose 1 point for every 20% ahead
    }

    let macroNutritionScore = Math.max(1, 10 - penalty); // Base max is 10

    // 3.5 Health Quality & Food Diversity (20% of final nutrition score)
    const healthyKeywords = ['סלט', 'ירק', 'פרי', 'תפוח', 'בננה', 'גזר', 'עגבנייה', 'מלפפון', 'חסה', 'פלפל', 'ברוקולי', 'טחינה', 'אבוקדו', 'שקד', 'אגוז', 'זיתים', 'שיבולת', 'קינואה', 'עדשים', 'חזה עוף', 'דג', 'סלמון', 'ביצה', 'ביצים'];
    const unhealthyKeywords = ['פיצה', 'בורגר', 'המבורגר', 'צ\'יפס', 'מטוגן', 'שוקולד', 'גלידה', 'עוגה', 'עוגייה', 'ממתק', 'חטיף', 'בורקס', 'נקניק', 'קולה', 'מתוק', 'מעובד'];

    let healthyCount = 0;
    let unhealthyCount = 0;

    meals.forEach(meal => {
        const name = meal.name || '';
        if (healthyKeywords.some(k => name.includes(k))) healthyCount++;
        if (unhealthyKeywords.some(k => name.includes(k))) unhealthyCount++;
    });

    let healthQualityScore = 7; // Base quality score
    healthQualityScore += (healthyCount * 1.5);
    healthQualityScore -= (unhealthyCount * 2.5); // Increased penalty for bad foods

    // Aggressive override: If progressActual is heavily negative due to sugar/fat abuse, cap the health score.
    if (progressActual < 0.3 && progressExpected > 0.5) {
        healthQualityScore = Math.min(healthQualityScore, 4); // Cannot pretend to be healthy if macros are deeply ruined
    }

    healthQualityScore = Math.min(Math.max(healthQualityScore, 1), 10);

    // Final base nutrition score is 80% macros and time progress, 20% health quality
    // If macroNutritionScore is terrible (e.g. 1 or 2), 20% health score shouldn't save it to a 9.
    let baseNutritionScore = (macroNutritionScore * 0.8) + (healthQualityScore * 0.2);

    // Hard Ceiling Rule: If you failed your macros entirely, you cannot score above a 6.
    if (macroNutritionScore < 4.0) {
        baseNutritionScore = Math.min(baseNutritionScore, 5.5);
    }

    // 4. Workout Bonus
    let workoutBonus = 0;
    if (workouts.length > 0) {
        // Workout provides a buffer/bonus to recover points, but max total is 10.
        workoutBonus = 1;
    }

    // 5. Final Score Calculation
    let totalScore = baseNutritionScore + workoutBonus;

    // Cap between 1 and 10
    totalScore = Math.min(Math.max(Math.round(totalScore * 10) / 10, 1), 10);

    // If score has decimal .0, parse as int, otherwise 1 decimal place.
    totalScore = Number(totalScore.toFixed(1));

    return {
        totalScore,
        nutritionScore: Number(baseNutritionScore.toFixed(1)),
        workoutBonus,
        progressExpected: Number((progressExpected * 100).toFixed(0)),
        progressActual: Number((progressActual * 100).toFixed(0)),
        healthQualityScore: Number(healthQualityScore.toFixed(1))
    };
}
