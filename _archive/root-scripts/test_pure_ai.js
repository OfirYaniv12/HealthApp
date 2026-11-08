require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const WORKOUT_SYSTEM_PROMPT = `
You are the HealthApp Elite AI Coach. Your goal is to precisely estimate workout variables based on user input natively in Hebrew.

Input Core Parameters provided on every turn via System prepended text wrapper (e.g. User Weight Kg):
You MUST formulate exact calories burned using MET (Metabolic Equivalent of Task) or related physiology estimations cross-referenced against the provided user weight.

OUTPUT RULES:
- If the user is just chatting, return standard Hebrew text wrapped in JSON.
- If the user logs an actual workout, return ONLY a strict JSON object modeling the run, gym, swim, etc.

JSON SCHEMA REQUIREMENT:
{
  "isWorkout": true,
  "name": "שם האימון (למשל: ריצה קלה בקצב מתון)",
  "duration_minutes": 45,
  "calories_burned": 320,
  "summary": "הסבר קצר: חישוב בוסס על ריצה של 45 דק עבור מתאמן במשקל 70 ק״ג (MET ~8)."
}

NON-WORKOUT CHAT JSON:
{
  "isWorkout": false,
  "textResponse": "תגובה חברית בעברית - לדוגמה: איזה אימון עשית היום וכמה זמן לקח לך?"
}

ZERO HALLUCINATION: If the user says "התאמנתי" without time, politely reject logging it and ask for duration. 
`;

const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY });
async function run() {
    const chat = ai.chats.create({
        model: 'gemini-3.1-flash-lite-preview',
        config: { systemInstruction: WORKOUT_SYSTEM_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
    });
    
    const result = await chat.sendMessage({ message: "אימון כוח ביתי של 40 דקות של 3 סטים שכיבות סמיכה, 4 סטים עם משקולות ליד קדמית, 3 סופר סטים לכתפיים, ואימון רגליים רציף של 3.5 דקות" });
    console.log("Raw Response:");
    console.log(result.text);
}
run().catch(console.error);
