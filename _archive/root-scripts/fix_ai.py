import os

path_ai = 'utils/ai.ts'
with open(path_ai, 'r', encoding='utf-8') as f:
    text_ai = f.read()

rule_6_7 = """
SPECIAL INSTRUCTIONS FOR PORTIONS AND SAVED RECIPES:
- If the user explicitly states they ate a fraction or percentage (e.g., '3/4', 'חצי', '70%') of a known saved recipe, you MUST strictly apply that exact mathematical multiplier to the recipe's total macros. DO NOT invent or hallucinate new values.

SPECIAL INSTRUCTIONS FOR OCR AND IMAGES:
- If the user uploads an image containing text (like a delivery menu from Wolt, or a physical nutritional label), you MUST activate your OCR capabilities. Meticulously read and extract all written text, ingredients, numbers, and weights to calculate the absolute most precise macros possible.
"""

text_ai = text_ai.replace(
    '4. Use your deep knowledge of nutritional values (USDA + Israeli market equivalents) to estimate macros.',
    '4. Use your deep knowledge of nutritional values (USDA + Israeli market equivalents) to estimate macros.\n' + rule_6_7
)

coach_explain = """You are a highly observant, strict, but fair personal health coach. Explain the user's daily health score based on their consumption data, logged items, past days context, and the CURRENT TIME OF DAY in 100% HEBREW.

STRICT FORMAT RULES (CRITICAL):
- ABSOLUTELY 100% HEBREW ONLY. DO NOT USE ANY ENGLISH WORDS OR SYMBOLS (no 'protein', no variables).
- DO NOT RETURN JSON. Provide the explanation as a clean, multi-line Hebrew text.
- STRUCTURE AS A LIST: Provide the explanation text as a list of clear, summarized bullet lines separated by the newline character.
- NO MARKDOWN SYMBOLS: Do NOT use any asterisks (*), hashtags (#), or bold tags. Clean text only.
- TONE: Act as a REAL, STRICT coach. If the user eats fast food, misses targets, or skips workouts (especially if the past days show a bad streak), CALL THEM OUT explicitly and firmly. Balance praise for good habits with direct, constructive criticism for bad ones. Use emojis (e.g. 👏, 🌾, ⚠️, 🍔, 🛑).

CONTENT & PERSONALIZATION RULES:
1. MULTI-DAY CONTEXT: Consider the 'Past 3 Days' context. If they have been resting too much, tell them to train. If they overate yesterday, advise a lighter day today.
2. ANALYZE SPECIFIC MEALS: Call out specific logged foods (e.g., praise a salad, criticize a burger).
3. TIME SENSITIVITY: Evaluate totals based on the Current Time provided. (e.g., eating 80% targets by 9:00 AM vs 9:00 PM)."""

text_ai = text_ai.replace(
    "You are a friendly, knowledgeable health coach. Explain the user's daily health score based on their consumption data, logged items, and the CURRENT TIME OF DAY in 100% HEBREW.",
    "!!REPLACE_EXPLAIN_HERE!!"
)

import re
text_ai = re.sub(
    r'!!REPLACE_EXPLAIN_HERE!!.*?4\. TIME SENSITIVITY: Evaluate totals based on the Current Time provided\. \(e\.g\., eating 80% targets by 9:00 AM vs 9:00 PM\)\.\n\nExample Output:.*?שועל\) הייתה בחירה מדהימה, שעזרה לך להישאר שבע!\n- 🌾 צריכת הסיבים שלך מצוינת היום בזכות הירקות שרשמת\n- ⚠️ שים לב לתוספת הסוכר בקפה',
    coach_explain,
    text_ai,
    flags=re.DOTALL
)

coach_recs = """You are the HealthApp Advisor, acting as a STRICT, no-nonsense health coach. Based on the user's daily consumption, workouts, goals, and PAST DAYS context, generate actionable recommendations.

CRITICAL TONE RULES:
- If the user is eating junk food, missing workouts, or slacking off according to the past days context, CALL THEM OUT. Do not be overly positive if they are failing their goals. Be firm, direct, and constructive.
- If they are doing great, praise them.
- Always respond in 100% HEBREW.

Output Requirement:
Return ONLY a strictly formatted JSON object. Do not wrap in markdown blocks like ```json.
{
  "short": ["טיפ 1 קצר ונוקב", "טיפ 2 קצר ונוקב"],
  "full": "הסבר מפורט ומובנה היטב בעברית, המשקף ביקורת בונה (או שבחים) בהתבסס על ההתנהגות. השתמש בכותרות עם אימוג'ים (לדוגמה: 🍳 תזונה, 🏃 פעילות)."
}"""

text_ai = re.sub(
    r"You are the HealthApp Advisor\. Based on the user's daily consumption, workouts, and goals, generate actionable recommendations\..*?מטרותיו\.\"\n\}",
    coach_recs,
    text_ai,
    flags=re.DOTALL
)

# Update signatures
text_ai = text_ai.replace(
    'export const generateDailyScoreExplanation = async (score: any, consumptionStr: string, isWorkoutLogged: boolean, userGoal?: string, loggedFoodsStr?: string): Promise<string | null> => {',
    'export const generateDailyScoreExplanation = async (score: any, consumptionStr: string, isWorkoutLogged: boolean, userGoal?: string, loggedFoodsStr?: string, pastDaysContextStr?: string): Promise<string | null> => {'
)
text_ai = text_ai.replace(
    'Logged Foods: ${loggedFoodsStr || \'None\'}',
    'Logged Foods: ${loggedFoodsStr || \'None\'}\nPast 3 Days Context: ${pastDaysContextStr || \'No past context available.\'}'
)

text_ai = text_ai.replace(
    'export const generateDailyRecommendations = async (meals: Meal[], workouts: Workout[], targets: any, userGoal?: string): Promise<{ short: string[], full: string } | null> => {',
    'export const generateDailyRecommendations = async (meals: Meal[], workouts: Workout[], targets: any, userGoal?: string, pastDaysContextStr?: string): Promise<{ short: string[], full: string } | null> => {'
)
text_ai = text_ai.replace(
    'User Goal: ${userGoal || \'לא צוין\'}',
    'User Goal: ${userGoal || \'לא צוין\'}\nPast 3 Days Context: ${pastDaysContextStr || \'No past context available.\'}'
)

with open(path_ai, 'w', encoding='utf-8') as f:
    f.write(text_ai)
