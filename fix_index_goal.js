const fs = require('fs');
let code = fs.readFileSync('app/(drawer)/index.tsx', 'utf-8');

const regex = /generateDailyRecommendations\(logs, workouts, targets, currentUser\.goal, pastContextStr\);/;
const replacement = `generateDailyRecommendations(logs, workouts, targets, (currentUser.goal || '') + " | Workout Frequency: " + (currentUser.workout_frequency || 'Unknown'), pastContextStr);`;

code = code.replace(regex, replacement);
fs.writeFileSync('app/(drawer)/index.tsx', code, 'utf-8');
