const fs = require('fs');
let code = fs.readFileSync('utils/scoreUpdater.ts', 'utf-8');

const regex = /const explanation = await generateDailyScoreExplanation\([\s\S]*?\);/;
const replacement = `const explanation = await generateDailyScoreExplanation(
            score, 
            consumptionStr, 
            isWorkoutLogged, 
            (user.goal || '') + " | Workout Frequency: " + (user.workout_frequency || 'Unknown'), 
            loggedFoodsStr, 
            pastContextStr
        );`;

code = code.replace(regex, replacement);
fs.writeFileSync('utils/scoreUpdater.ts', code, 'utf-8');
