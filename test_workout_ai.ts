import { generateWorkoutResponse } from './utils/ai';

const history: any[] = [];
// simulate the prompt from the user in the image:
const msg = "אימון כוח ביתי של 40 דקות של 3 סטים שכיבות סמיכה, 4 סטים עם משקולות ליד קדמית, 3 סופר סטים לכתפיים, ואימון רגליים רציף של 3.5 דקות";
const weight = 70;

(async () => {
    // We need to inject process.env.EXPO_PUBLIC_GEMINI_API_KEY
    require('dotenv').config();
    console.log("Testing workout request...");
    const res = await generateWorkoutResponse(history, msg, weight);
    console.log("Result:", res);
})();
