import { Meal, Workout } from '@/db/database';
import { UserData } from '@/store/useUserStore';
import { supabase } from '@/utils/supabase';
import { calculateDailyTargets } from '@/utils/calculators';
import { Platform } from 'react-native';

// Gemini is called through our own server endpoint (/api/gemini), which holds the API key.
// The key is never shipped to the browser. On the website the endpoint is on the same domain;
// in local development EXPO_PUBLIC_API_BASE_URL points to it, and the phone app (which has no
// "same domain") defaults to the live website's endpoint.
const PRODUCTION_API_BASE = 'https://health-app-mu-orpin.vercel.app';
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || (Platform.OS === 'web' ? '' : PRODUCTION_API_BASE)).replace(/\/$/, '');
const apiKey = 'proxy'; // kept for the existing "is AI configured" checks; the real key lives on the server

const callGeminiProxy = async (request: { model: string; contents: any; config?: any }): Promise<{ text: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE_URL}/api/gemini`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(request),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err: any = new Error(`${res.status} ${body?.error || ''}`);
        err.status = res.status;
        throw err;
    }
    return { text: body?.text || '' };
};

const ai = {
    models: {
        generateContent: (request: { model: string; contents: any; config?: any }) => callGeminiProxy(request),
    },
};

export type MealData = {
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber?: number;
    sodium?: number;
    sugar?: number;
    summary: string;
};

export type AIResponse = {
    isMeal: boolean;
    textResponse?: string;
    mealData?: MealData;
    limitReached?: boolean;
    usedModel?: string;
};

export type WorkoutPlan = {
    isWorkout: boolean;
    textResponse?: string;
    workoutData?: {
        name: string;
        duration_minutes: number;
        distance_km?: number | null;
        calories_burned: number;
        summary: string;
    };
    limitReached?: boolean;
    usedModel?: string;

};

const RPM_LIMIT = 15;
const DAILY_LIMIT = 500;
let rpmTimestamps: number[] = [];

import { useUserStore } from '@/store/useUserStore';
import { AlertManager as Alert } from '@/components/GlobalAlert';

export const checkAndIncrementRateLimits = (): boolean => {
    const now = Date.now();
    rpmTimestamps = rpmTimestamps.filter(t => now - t < 60 * 1000);
    if (rpmTimestamps.length >= RPM_LIMIT) {
        Alert.alert('הגעת למגבלה', `נשלחו ${rpmTimestamps.length}/${RPM_LIMIT} בקשות ל-AI בדקה האחרונה. המתן רגע ונסה שוב.`);
        return false;
    }
    const state = useUserStore.getState();
    const today = new Date().toISOString().split('T')[0];
    const daily = state.user?.aiDailyCount || { count: 0, dateStr: today };
    const currentCount = daily.dateStr === today ? daily.count : 0;

    if (currentCount >= 450 && currentCount < DAILY_LIMIT) Alert.alert('שים לב', 'אתה מתקרב למגבלת הבקשות היומית ל-AI.');
    if (currentCount >= DAILY_LIMIT) {
        Alert.alert('הגעת למגבלה', `נוצלו ${currentCount}/${DAILY_LIMIT} בקשות ל-AI היום. נסה שוב מחר.`);
        return false;
    }
    rpmTimestamps.push(now);
    state.incrementDailyAiCount();
    return true;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number = 15000): Promise<T> => {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms));
    return Promise.race([promise, timeout]);
};

const FALLBACK_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash'
];


function extractJson(text: string) {
    if (!text) return '{}';
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        return jsonMatch[1].trim();
    }
    const trimmed = text.trim();
    if (trimmed.startsWith('[')) return trimmed;
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    return text;
}

export const generateContentWithFallback = async (requestBase: any, timeoutMs: number = 15000): Promise<any> => {
    for (const model of FALLBACK_MODELS) {
        try {
            const request = { ...requestBase, model };
            const result = await withTimeout(ai.models.generateContent(request), timeoutMs);
            return { result, usedModel: model };
        } catch (e: any) {
            const isLimitErr = e?.status === 429 || String(e?.message).includes('429') || e?.status === 503 || String(e?.message).includes('503') || String(e?.message).includes('TIMEOUT') || String(e?.message).includes('404');
            if (isLimitErr) {
                console.log(`[AI Fallback] Model ${model} unavailable... trying next.`);
                continue;
            }
            throw e;
        }
    }
    return { limitReached: true };
};

export const chatWithFallback = async (history: any, newMessageText: string, config: any): Promise<any> => {
    for (const model of FALLBACK_MODELS) {
        try {
            const contents = [...(history || []), { role: 'user', parts: [{ text: newMessageText }] }];
            const result = await withTimeout(ai.models.generateContent({ model, contents, config }));
            return { result, usedModel: model };
        } catch (e: any) {
            const isLimitErr = e?.status === 429 || String(e?.message).includes('429') || e?.status === 503 || String(e?.message).includes('503') || String(e?.message).includes('TIMEOUT') || String(e?.message).includes('404');
            if (isLimitErr) {
                 continue;
            }
            throw e;
        }
    }
    return { limitReached: true };
};

const SYSTEM_PROMPT = `
You are the HealthApp Nutrition Expert, powered by Google Gemini. Your goal is to be a precise, conversational, and highly intelligent nutrition partner for an Israeli user speaking Hebrew.

YOUR COGNITIVE PROCESS:
1. Deconstruct the user's input. Identify the core items, quantities, and preparation methods.
2. If the user provides an image alongside text, you MUST explicitly state what you identify in the image and explain how the user's text description adds to or modifies that identification.
3. Maintain Context: The user might be correcting a previous meal ("Actually, add an egg") or providing a new meal.
4. Use your deep knowledge of nutritional values (USDA + Israeli market equivalents) to estimate macros.

SPECIAL INSTRUCTIONS FOR PORTIONS AND SAVED RECIPES:
- If the user explicitly states they ate a fraction or percentage (e.g., '3/4', 'חצי', '70%') of a known saved recipe, you MUST strictly apply that exact mathematical multiplier to the recipe's total macros. DO NOT invent or hallucinate new values.

SPECIAL INSTRUCTIONS FOR OCR AND IMAGES:
- If the user uploads an image containing text (like a delivery menu from Wolt, or a physical nutritional label), you MUST activate your OCR capabilities. Meticulously read and extract all written text, ingredients, numbers, and weights to calculate the absolute most precise macros possible.

NUTRITION LABELS (Israeli "סימון תזונתי" tables and any other label):
- Israeli labels list values "ל-100 גרם" / "ל-100 מ"ל" and sometimes also "למנה". Read the exact numbers: אנרגיה (קלוריות), חלבונים, פחמימות, מתוכן סוכרים, שומנים, סיבים תזונתיים, נתרן (mg).
- Scale to what the user actually ate. If the user states an amount (grams, units, "חצי חבילה", "2 פרוסות"), multiply accordingly using the label's per-100g or per-serving values and the package weight if visible.
- If the user did NOT say how much they ate, log ONE serving if a serving size is printed; otherwise log 100 g. In the summary clearly state which amount you assumed and that the user can correct it.
- The summary must quote the label values you read (e.g. "לפי התווית: 120 קק"ל ל-100 גרם; חושב עבור 150 גרם").
- Red "סמלים אדומים" (high sugar / sodium / saturated fat) may be mentioned briefly in the summary.


OUTPUT RULES:
- If the user is just chatting or providing feedback that does NOT require logging a specific food, respond with standard text in Hebrew.
- **CRITICAL**: If the user's intent is to log a meal, you MUST output ONLY a pure JSON object representing the meal. DO NOT wrap the JSON in markdown blocks like \`\`\`json. The JSON MUST follow this exact schema:
{
  "isMeal": true,
  "name": "Summarized name of the meal (e.g. 'סלט ביצים עם מיונז')",
  "calories": 150,
  "protein": 10,
  "fat": 5,
  "carbs": 2,
  "fiber": 1.5,
  "sodium": 200,
  "sugar": 0.5,
  "summary": "Short explanation of how you calculated this (e.g. 'ביצה קשה: 70 קלוריות, מיונז: 80 קלוריות')"
}

- If the input is NOT a meal (e.g. "Hi", "How are you", "I'm not sure"), return:
{
  "isMeal": false,
  "textResponse": "Your helpful response in Hebrew"
}

ZERO HALLUCINATION RULE: If the user provides a completely vague food ("I ate a big thing"), do not log a meal. Return a textResponse asking for clarification (weight, ingredients).

FORMAT RULES (STRICT):
- ALWAYS return exactly ONE JSON object, never an array and never plain text. If the user lists several foods, combine them into ONE meal with summed values.
- All numeric fields must be plain numbers (no units, no strings).
- "textResponse", "name" and "summary" must ALWAYS be written in Hebrew. Never write English sentences to the user.
`;

// Strict output schema: forces the model to return a single well-formed object.
// Every field is required (tested: with optional fields the model sometimes skips the numbers);
// for a non-meal reply the model fills zeros / empty strings and we only use textResponse.
const NUTRITION_FIELDS = ['isMeal', 'textResponse', 'name', 'calories', 'protein', 'fat', 'carbs', 'fiber', 'sodium', 'sugar', 'summary'];
const NUTRITION_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        isMeal: { type: 'BOOLEAN' },
        textResponse: { type: 'STRING' },
        name: { type: 'STRING' },
        calories: { type: 'NUMBER' },
        protein: { type: 'NUMBER' },
        fat: { type: 'NUMBER' },
        carbs: { type: 'NUMBER' },
        fiber: { type: 'NUMBER' },
        sodium: { type: 'NUMBER' },
        sugar: { type: 'NUMBER' },
        summary: { type: 'STRING' },
    },
    required: NUTRITION_FIELDS,
    propertyOrdering: NUTRITION_FIELDS,
};

const toNum = (v: any): number => {
    if (typeof v === 'number' && isFinite(v)) return Math.round(v * 10) / 10;
    const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? Math.round(n * 10) / 10 : 0;
};

/**
 * Turns whatever the model returned into either a meal or a Hebrew text reply.
 * Handles the shapes that previously leaked raw JSON / English into the chat:
 * arrays of foods, values nested under "meal"/"mealData", numbers as strings, etc.
 */
const normalizeNutritionPayload = (parsed: any): { meal?: MealData; text?: string } => {
    if (Array.isArray(parsed)) {
        const items = parsed.map(p => (p && (p.mealData || p.meal)) || p).filter(p => p && typeof p === 'object' && (p.calories !== undefined || p.protein !== undefined));
        if (items.length === 0) return {};
        const sum = (k: string) => toNum(items.reduce((acc, it) => acc + toNum(it[k]), 0));
        return {
            meal: {
                name: items.map(i => i.name).filter(Boolean).join(' + ') || 'ארוחה',
                calories: sum('calories'), protein: sum('protein'), fat: sum('fat'), carbs: sum('carbs'),
                fiber: sum('fiber'), sodium: sum('sodium'), sugar: sum('sugar'),
                summary: items.map(i => i.summary).filter(Boolean).join('\n'),
            }
        };
    }
    if (!parsed || typeof parsed !== 'object') return {};

    const src = parsed.mealData || parsed.meal || parsed;
    const looksLikeMeal = parsed.isMeal === true || (parsed.isMeal === undefined && src.calories !== undefined);
    if (looksLikeMeal && (src.calories !== undefined || src.protein !== undefined)) {
        return {
            meal: {
                name: src.name || 'ארוחה',
                calories: toNum(src.calories), protein: toNum(src.protein), fat: toNum(src.fat), carbs: toNum(src.carbs),
                fiber: toNum(src.fiber), sodium: toNum(src.sodium), sugar: toNum(src.sugar),
                summary: src.summary || '',
            }
        };
    }
    const text = parsed.textResponse || parsed.text || parsed.message || parsed.response;
    return typeof text === 'string' && text.trim() ? { text } : {};
};

export const generateNutritionResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessageText: string, imageBase64?: string): Promise<AIResponse> => {
    if (!checkAndIncrementRateLimits()) return { isMeal: false, textResponse: 'הגעת למגבלת קצב. המתן מעט.' };

    try {
        let parts: any[] = [{ text: newMessageText || 'נתח את התמונה המצורפת.' }];
        if (imageBase64) {
            const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/);
            parts.push({
                inlineData: {
                    data: imageBase64.split(',')[1] || imageBase64,
                    mimeType: mimeMatch?.[1] || 'image/jpeg'
                }
            });
        }

        const contents = [...history, { role: 'user', parts: parts }];

        const fallbackData = await generateContentWithFallback({
            contents: contents,
            config: {
                responseMimeType: 'application/json',
                responseSchema: NUTRITION_RESPONSE_SCHEMA,
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        }, imageBase64 ? 45000 : 20000);
        if (fallbackData.limitReached) return { isMeal: false, limitReached: true, textResponse: 'הגיע למגבלת השימוש.' };
        const result = fallbackData.result;
        const usedModel = fallbackData.usedModel;
        const responseText = result.text || '';

        let normalized: { meal?: MealData; text?: string } = {};
        try {
            normalized = normalizeNutritionPayload(JSON.parse(extractJson(responseText)));
        } catch (jsonError) {
            console.warn('[AI] Unparseable nutrition response', responseText.slice(0, 300));
        }

        const m = normalized.meal;
        if (m && (m.calories > 0 || m.protein > 0 || m.carbs > 0 || m.fat > 0)) {
            return { isMeal: true, mealData: m, usedModel };
        }
        if (m) {
            // A "meal" without any numbers is not usable: never show a card with zeros
            console.warn('[AI] Meal response without nutrition values', responseText.slice(0, 300));
            return { isMeal: false, textResponse: 'לא הצלחתי לחשב ערכים לארוחה הזו. אפשר לפרט כמויות או לנסות שוב?', usedModel };
        }
        if (normalized.text) {
            return { isMeal: false, textResponse: normalized.text, usedModel };
        }
        // Never show raw model output (JSON / English) to the user
        const trimmed = responseText.trim();
        const looksRaw = !trimmed || /^[\[{]/.test(trimmed) || !/[֐-׿]/.test(trimmed);
        return {
            isMeal: false,
            textResponse: looksRaw ? 'לא הצלחתי לנתח את זה כמו שצריך. אפשר לנסות לנסח שוב או לפרט כמויות?' : trimmed,
            usedModel
        };
    } catch (e: any) {
        console.error('[AI] Nutrition request failed', e);
        return { isMeal: false, textResponse: 'שגיאת AI. נסה שוב בעוד רגע.' };
    }
};
;

const NUTRITIONIST_SYSTEM_PROMPT = `
You are the HealthApp Precision Health Coach, an elite AI specialized in clinical sports nutrition and physiological macro calculations.
Your goal is to generate a comprehensive, highly personalized daily nutritional target profile.

Input User Data provided: Age, Gender, Height, Weight, Activity Level, Workout Frequency, Body Type, and Primary Goal.

Task Requirements & STRICT Scientific Formulas:
1. Basal Metabolic Rate (BMR): You MUST use the exact Mifflin-St Jeor equation:
   - Men: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
   - Women: (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161
2. Total Daily Energy Expenditure (TDEE): Multiply BMR by a precise Activity Multiplier. You MUST analyze BOTH their "Workout Frequency" AND their general "Activity Level" (e.g., office job vs construction worker), as well as their "Body Type" (endomorph/ectomorph metabolism).
   - Base Multipliers (Adjust up/down based on general Activity Level):
   - Sedentary (0 workouts): BMR × 1.2
   - Light (1-3 workouts): BMR × 1.375
   - Moderate (4-5 workouts): BMR × 1.55
   - Heavy (6+ workouts): BMR × 1.725
3. Target Calories: Modify TDEE based precisely on the Primary Goal:
   - "ירידה במשקל" (Weight Loss / Fat Loss): Target = TDEE - 500 kcal
   - "עליה במסת שריר" (Muscle Mass Gain): Target = TDEE + 300 kcal
   - "שמירה על משקל / חיטוב" (Maintain / Toning): Target = TDEE
   - "שילוב מתון" (Moderate Recomp - Muscle Gain + Fat Loss): Target = TDEE - 200 kcal. This is a slower progress goal demanding a slight deficit but extremely high protein to build muscle while losing fat.
4. Macronutrient Splitting:
   - Protein: 
     - Weight Loss / Recomp (שילוב מתון): 2.0g to 2.2g per kg of body weight (Crucial for muscle preservation/growth).
     - Muscle Gain: 1.8g to 2.2g per kg.
     - Maintenance: 1.6g to 1.8g per kg.
   - Fat: 0.8g to 1.0g per kg of body weight (for hormonal health).
   - Carbs: Remainder of Target Calories (Carbs = (Target Calories - (Protein × 4) - (Fat × 9)) / 4).
5. Micronutrients: Fiber (14g per 1000 kcal), Sodium (<2300mg), Sugar (<50g).

Output Requirement:
Return ONLY a raw JSON object string. Do not wrap in markdown.
{
  "targets": {
    "calories": 2000,
    "protein": 150,
    "fat": 70,
    "carbs": 190,
    "fiber": 30,
    "sodium": 2300,
    "sugar": 45
  },
  "explanation": "BMR calculated via Mifflin-St Jeor. Applied 1.375 multiplier for 3 weekly workouts. Set -200kcal deficit for Moderate Recomposition with 2.2g/kg protein to build muscle while losing fat."
}
`;

// Daily targets are calculated with standard formulas in code (see calculateDailyTargets): exact,
// instant, and they respect the chosen pace. No AI call needed. (Same signature as before for callers.)
export const generatePersonalizedPlan = async (user: UserData): Promise<{ targets: UserData['daily_targets'], explanation: string } | null> => {
    try {
        const { targets, explanation } = calculateDailyTargets(user);
        return { targets, explanation };
    } catch (e: any) {
        console.error('Failed to calculate targets', e);
        return null;
    }
};
;

const TEMPLATE_WORKOUT_PROMPT = `
You are the HealthApp Elite AI Coach. Your task is to calculate the precise estimated calories burned for a specific workout template that the user just performed.

Input Context provided in the system prompt:
- User Profile: (Age, Gender, Weight, Height)
- Workout Name
- Workout Description (from Template - the actual exercises)
- User Session Notes (if any - e.g. "rested a lot" or "lifted heavy")
- Duration (in minutes)

Task Requirements:
Calculate the exact estimated calories burned using MET (Metabolic Equivalent of Task).
Formula: Calories Burned = METs × Weight (kg) × (Duration in minutes / 60)
1. Read the workout description and notes to determine the precise MET value. 
2. EXTREMELY IMPORTANT: Understand the nature of the workout. If it is a "Gym" or "Resistance Training" workout, it inherently includes rests and breaks between sets. DO NOT calculate it as non-stop lifting. Use a lower overall average MET (e.g., 3.0-4.0) to account for these natural breaks. 
3. If it is continuous cardio (e.g., running, cycling), use the appropriate continuous MET (e.g., 7.0-10.0).
4. Calculate using the provided exact Weight and Duration.
5. DISTANCE IS CRITICAL FOR WALKING / RUNNING / CYCLING: If a distance is provided, you MUST use it. Compute the actual speed (km/h) = distance / (duration/60) and the pace (min/km), and choose the MET from the real speed, NOT from a generic activity value:
   - Walking (MET is GROSS, choose by exact speed): <3.2 km/h ≈ 2.8 | 3.2-4.4 ≈ 3.0-3.5 | 4.5-5.5 ≈ 3.8-4.3 | 5.6-6.9 ≈ 5.0 | 7.0-7.9 ≈ 6.3 | 8.0+ (race walking) ≈ 8.0
   - Running: 8 km/h ≈ 8.3 | 9.7 ≈ 9.8 | 11.3 ≈ 11.0 | 12.9 ≈ 11.8 | 14.5 ≈ 12.8 | 16+ ≈ 14.5+
   - Cycling: <16 km/h ≈ 4.0-5.8 | 16-19 ≈ 6.8 | 19-22 ≈ 8.0 | 22-25.5 ≈ 10.0 | >25.5 ≈ 12.0
- Swimming (by pace per 100 m): >3:00 ≈ 5.8 (easy) | 2:00-3:00 ≈ 7-8.3 (moderate) | <2:00 ≈ 9.8-10 (fast). Do not apply the per-km sanity ranges to swimming.
   - Swimming (by pace per 100 m): >3:00 ≈ 5.8 (easy) | 2:00-3:00 ≈ 7-8.3 (moderate) | <2:00 ≈ 9.8-10 (fast). Do not apply the per-km sanity ranges to swimming.
   MANDATORY sanity check: the final calories MUST fall within the energy-per-distance range — walking 0.5-0.8 kcal per kg per km, running 0.9-1.05 kcal per kg per km, cycling 0.25-0.45 kcal per kg per km. If your MET result falls outside it, lower/raise the MET until it fits. If the speed is physically implausible, say so in the summary and rely on the distance.
   The Hebrew summary MUST mention the distance, the computed pace/speed and the MET you chose.
6. If no distance is provided for these types, estimate by duration and say in the summary that the estimate is time-based because no distance was given.

Output Requirement:
Return ONLY a strictly formatted JSON object. Do not wrap in markdown blocks like \`\`\`json.
{
  "calories_burned": 320,
  "summary": "חישוב בוצע לפי MET של 6.0 עבור 45 דק' למשקל 80 קג מבוסס על אימון כוח ומנוחות בינוניות."
}
`;

export const estimateTemplateWorkout = async (
    user: UserData,
    templateName: string,
    templateDescription: string | null,
    userNotes: string | null,
    durationMinutes: number,
    extra?: { type?: string; distanceKm?: number | null }
) => {
    if (!checkAndIncrementRateLimits()) return null;

    try {
        const distanceLine = extra?.distanceKm
            ? `Distance: ${extra.distanceKm} km (speed ${(extra.distanceKm / (durationMinutes / 60)).toFixed(2)} km/h, pace ${(durationMinutes / extra.distanceKm).toFixed(2)} min/km)`
            : 'Distance: not provided';
        const promptMsg = `User Stats: ${user.weight}kg, ${user.height}cm, Age ${user.age}, ${user.gender}.
Workout Name: ${templateName}
Workout Type: ${extra?.type || 'unknown'}
Duration: ${durationMinutes} mins
${distanceLine}
Template Description/Exercises: ${templateDescription || 'None'}
User Notes: ${userNotes || 'None'}`;
        const fallbackData = await generateContentWithFallback({
            contents: promptMsg,
            config: { responseMimeType: 'application/json', systemInstruction: TEMPLATE_WORKOUT_PROMPT, temperature: 0.1, thinkingConfig: { thinkingBudget: 1024 } }
        });
        if (fallbackData.limitReached) return null;
        const result = fallbackData.result;
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return { calories_burned: parsed.calories_burned, summary: parsed.summary };
    } catch (e: any) { return null; }
};
;

const WORKOUT_SYSTEM_PROMPT = `
You are the HealthApp Elite AI Coach. Your goal is to precisely estimate workout variables based on user input natively in Hebrew.

Input Core Parameters provided on every turn via System prepended text wrapper (e.g. User Weight Kg):
You MUST formulate exact calories burned using MET (Metabolic Equivalent of Task) or related physiology estimations cross-referenced against the provided user weight.

CRITICAL WORKOUT LOGIC:
Understand the nature of the workout. If it is a "Gym" or "Resistance Training" workout, it inherently includes rests and breaks between sets. DO NOT calculate it as non-stop lifting. Use a lower overall average MET (e.g., 3.0-4.0) to account for these natural breaks. Only use high continuous METs (7.0+) for continuous cardio like running.

DISTANCE LOGIC (walking / running / cycling / swimming):
If the user gives a distance, you MUST use it. Compute speed (km/h) = distance / (duration/60) and pace (min/km), and pick the MET by the REAL speed, not a generic activity value:
- Walking (MET is GROSS, choose by exact speed): <3.2 km/h ≈ 2.8 | 3.2-4.4 ≈ 3.0-3.5 | 4.5-5.5 ≈ 3.8-4.3 | 5.6-6.9 ≈ 5.0 | 7.0-7.9 ≈ 6.3 | 8.0+ (race walking) ≈ 8.0
- Running: 8 km/h ≈ 8.3 | 9.7 ≈ 9.8 | 11.3 ≈ 11.0 | 12.9 ≈ 11.8 | 14.5 ≈ 12.8 | 16+ ≈ 14.5+
- Cycling: <16 km/h ≈ 4.0-5.8 | 16-19 ≈ 6.8 | 19-22 ≈ 8.0 | 22-25.5 ≈ 10.0 | >25.5 ≈ 12.0
MANDATORY sanity check: the final calories MUST fall within the energy-per-distance range — walking 0.5-0.8 kcal per kg per km, running 0.9-1.05 kcal per kg per km, cycling 0.25-0.45 kcal per kg per km. If your MET result falls outside it, lower/raise the MET until it fits. If the speed is physically implausible, say so in the summary and rely on the distance.
The Hebrew summary MUST mention the distance, the computed pace/speed and the MET used. Put the distance in "distance_km" (null if none was given).

OUTPUT RULES:
- If the user is just chatting, return standard Hebrew text wrapped in JSON.
- If the user logs an actual workout, return ONLY a strict JSON object modeling the run, gym, swim, etc.

JSON SCHEMA REQUIREMENT:
{
  "isWorkout": true,
  "name": "שם האימון (למשל: ריצה קלה בקצב מתון)",
  "duration_minutes": 45,
  "distance_km": 7.5,
  "calories_burned": 320,
  "summary": "הסבר קצר: ריצה של 7.5 ק״מ ב-45 דק' (10 קמ״ש, קצב 6:00 לק״מ) עבור מתאמן במשקל 70 ק״ג (MET ~9.8)."
}

NON-WORKOUT CHAT JSON:
{
  "isWorkout": false,
  "textResponse": "תגובה חברית בעברית - לדוגמה: איזה אימון עשית היום וכמה זמן לקח לך?"
}

ZERO HALLUCINATION: If the user says "התאמנתי" without time, politely reject logging it and ask for duration. 
`;

const WORKOUT_FIELDS = ['isWorkout', 'textResponse', 'name', 'duration_minutes', 'distance_km', 'calories_burned', 'summary'];
const WORKOUT_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        isWorkout: { type: 'BOOLEAN' },
        textResponse: { type: 'STRING' },
        name: { type: 'STRING' },
        duration_minutes: { type: 'NUMBER' },
        distance_km: { type: 'NUMBER' },
        calories_burned: { type: 'NUMBER' },
        summary: { type: 'STRING' },
    },
    required: WORKOUT_FIELDS,
    propertyOrdering: WORKOUT_FIELDS,
};

export const generateWorkoutResponse = async (
    history: { role: 'user' | 'model', parts: { text: string }[] }[],
    newMessageText: string,
    userWeightKg: number,
    imageBase64?: string
): Promise<WorkoutPlan> => {
    if (!checkAndIncrementRateLimits()) return { isWorkout: false, textResponse: 'הגעת למגבלת קצב. המתן מעט.' };

    try {
        const enhancedMessageText = `[SYSTEM CONTEXT: The user weighs ${userWeightKg}kg. Use this EXACT weight to calculate MET calories burned = MET * ${userWeightKg} * (duration / 60). If no distance was given, set distance_km to 0. For a non-workout reply set the numbers to 0 and name/summary to empty strings.]

User Message: ${newMessageText}`;
        const parts: any[] = [{ text: enhancedMessageText }];
        if (imageBase64) {
            const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/);
            parts.push({ inlineData: { data: imageBase64.split(',')[1] || imageBase64, mimeType: mimeMatch?.[1] || 'image/jpeg' } });
        }
        const fallbackData = await generateContentWithFallback({
            contents: [...history, { role: 'user', parts }],
            config: {
                responseMimeType: 'application/json', responseSchema: WORKOUT_RESPONSE_SCHEMA,
                systemInstruction: WORKOUT_SYSTEM_PROMPT, temperature: 0.1,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        }, imageBase64 ? 45000 : 20000);
        if (fallbackData.limitReached) return { isWorkout: false, limitReached: true, textResponse: 'הגיע למגבלת השימוש.' };
        const result = fallbackData.result;
        const usedModel = fallbackData.usedModel;
        const parsed = JSON.parse(extractJson(result.text || '{}'));
        const dataTarget = parsed.workoutData || parsed;
        const minutes = toNum(dataTarget.duration_minutes);
        const kcal = toNum(dataTarget.calories_burned);
        if (parsed.isWorkout && minutes > 0 && kcal > 0) {
            const km = toNum(dataTarget.distance_km);
            return {
                isWorkout: true,
                workoutData: {
                    name: dataTarget.name || 'אימון כללי',
                    duration_minutes: Math.round(minutes),
                    distance_km: km > 0 ? km : null,
                    calories_burned: Math.round(kcal),
                    summary: dataTarget.summary || 'אימון נרשם בהצלחה.'
                },
                usedModel
            };
        }
        if (parsed.isWorkout) {
            // A "workout" without duration/calories can't be logged: ask instead of showing an empty card
            return { isWorkout: false, textResponse: parsed.textResponse || 'כמה זמן נמשך האימון? (ואם יש – מה היה המרחק)', usedModel };
        }
        return { isWorkout: false, textResponse: parsed.textResponse || 'לא הבנתי, אפשר לפרט איזה אימון עשית וכמה זמן?', usedModel };
    } catch (e: any) {
        console.error('[AI] Workout request failed', e);
        return { isWorkout: false, textResponse: 'שגיאת AI. נסה שוב בעוד רגע.' };
    }
};

const RECIPE_ANALYSIS_PROMPT = `
You are an Elite AI Clinical Nutritionist. Your task is to analyze an Israeli recipe, its structured ingredients, and instructions, and provide a highly accurate nutritional breakdown.

Input Context:
- Recipe Name: (e.g. "Chicken Salad")
- Ingredients List: A structured list of items containing quantities and names (e.g. Quantity: 200g, Item: Chicken breast)
- Instructions: (e.g. "Grill the chicken...")

Task Requirements:
1. Calculate the TOTAL nutritional values for the entire recipe (Calories, Protein, Fat, Carbs, Fiber, Sodium, Sugar).
2. Assign a Health Score from 1 to 10 based on nutritional density, macronutrient balance, and absence of excessive sugars/bad fats.
3. Provide a per-ingredient breakdown, detailing exactly what each ingredient contributes to the total macros.

Output Requirement:
Return ONLY a strictly formatted JSON object. Do not wrap in markdown blocks like \`\`\`json.
{
  "totals": {
    "calories": 400,
    "protein": 45,
    "fat": 20,
    "carbs": 10,
    "fiber": 3,
    "sodium": 300,
    "sugar": 4
  },
  "healthScore": 8,
  "ingredientBreakdown": [
    {
      "name": "200 גרם חזה עוף",
      "calories": 330,
      "protein": 44,
      "fat": 7,
      "carbs": 0,
      "fiber": 0,
      "sodium": 150,
      "sugar": 0
    },
    {
      "name": "כף שמן זית",
      "calories": 119,
      "protein": 0,
      "fat": 13.5,
      "carbs": 0,
      "fiber": 0,
      "sodium": 0,
      "sugar": 0
    }
  ]
}

RULES:
- Every ingredient in ingredientBreakdown MUST include all 7 fields (calories, protein, fat, carbs, fiber, sodium in mg, sugar).
- The totals MUST equal the sum of the ingredient breakdown.
- Write ingredient names in HEBREW, exactly as the user wrote them (with the quantity).
- If the user wrote nutrition values for an ingredient (e.g. from its label, "per 100 g"), use those values scaled to the quantity.
`;

export type RecipeAnalysisResult = {
    totals: {
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
        fiber: number;
        sodium: number;
        sugar: number;
    };
    healthScore: number;
    ingredientBreakdown: {
        name: string;
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
    }[];
};

export const analyzeRecipe = async (name: string, ingredients: { quantity: string; name: string }[], instructions: string | null): Promise<RecipeAnalysisResult | null> => {
    if (!apiKey) return null;

    try {
        const formattedIngredients = ingredients.map(i => `- Quantity: ${i.quantity}, Item: ${i.name}`).join('\n');

        const promptMsg = `
Recipe Name: ${name}
Ingredients:
${formattedIngredients}

Instructions: ${instructions || 'ללא הוראות מיוחדות'}
`;

        const fallbackData = await generateContentWithFallback({
            contents: promptMsg,
            config: { responseMimeType: 'application/json', systemInstruction: RECIPE_ANALYSIS_PROMPT, 
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        if (fallbackData.limitReached) return null;
        const result = fallbackData.result;

        const parsed = JSON.parse(extractJson(result.text || ''));
        const breakdown: any[] = Array.isArray(parsed.ingredientBreakdown) ? parsed.ingredientBreakdown : [];
        const keys = ['calories', 'protein', 'fat', 'carbs', 'fiber', 'sodium', 'sugar'];
        // Totals = sum of the ingredients, so the recipe card, the breakdown and the diary always agree
        const totals: any = {};
        for (const k of keys) {
            const sum = breakdown.reduce((acc, ing) => acc + toNum(ing?.[k]), 0);
            totals[k] = breakdown.length > 0 ? Math.round(sum * 10) / 10 : toNum(parsed.totals?.[k]);
        }
        if (!totals.calories) return null;
        return {
            totals,
            healthScore: parsed.healthScore,
            ingredientBreakdown: breakdown.map(ing => ({ ...ing, ...Object.fromEntries(keys.map(k => [k, toNum(ing?.[k])])) }))
        };
    } catch (e: any) {
        console.log('Failed to analyze recipe:', e.message || e);
        return null;
    }
};

const SCORE_EXPLANATION_PROMPT = `
You are an empathetic, smart, and realistic personal health coach. Explain the user's daily health score based on their consumption data, logged items, past days context, and the CURRENT TIME OF DAY in 100% HEBREW.

STRICT FORMAT RULES (CRITICAL):
- ABSOLUTELY 100% HEBREW ONLY. DO NOT USE ANY ENGLISH WORDS OR SYMBOLS (no 'protein', no variables).
- DO NOT RETURN JSON. Provide the explanation as a clean, multi-line Hebrew text.
- STRUCTURE AS A LIST: Provide the explanation text as a list of clear, summarized bullet lines separated by the newline character.
- NO MARKDOWN SYMBOLS: Do NOT use any asterisks (*), hashtags (#), or bold tags. Clean text only.
- TONE & REALISM: Be a supportive and realistic coach. Look at the bright side and the big picture. DO NOT be evil or harsh. Do not make the user feel bad for eating or resting. Take their stated workout frequency into account (e.g., resting is normal if they only aim for 2-3 times a week). Provide constructive, balanced advice. Use emojis (e.g. 👏, 🥗, 💪, ✨).

WORKOUT JUDGMENT (IMPORTANT):
- You receive each workout with its duration, calories, distance/pace when available, and a pre-classification: "אימון משמעותי" (a real training session) or "פעילות קלה" (light activity).
- Use real judgment, like a coach. A 15-minute easy walk is NOT the user's workout for the day: acknowledge it warmly ("יפה שזזת", "כל תנועה טובה") but do NOT count it toward the weekly workout goal and do NOT praise it as if it were a full workout.
- A substantial session (e.g. a gym workout, a run, a long or brisk walk, a long ride) deserves real, specific praise that mentions what was done (distance, pace, duration).
- Relate to the weekly goal using ONLY the significant workouts: e.g. "זה האימון השני השבוע מתוך 3-4 – בדרך הנכונה". If the week is behind the goal, encourage gently without guilt.
- Never invent workouts or numbers that were not provided.
`;

const FINAL_DAY_SUMMARY_ADDENDUM = `
THIS IS A FINAL SUMMARY OF A DAY THAT HAS ALREADY ENDED (at the user's day-reset time).
- Write in past tense, as a summary of the whole day. Do NOT give advice about "the rest of the day" and do NOT mention the current time.
- The score you receive is the FINAL score of that day. Your explanation must be consistent with it (a high score = a good day, a low score = explain gently why).
- End with one short, practical takeaway for the next day.
`;

const RECOMMENDATIONS_PROMPT = `
You are the HealthApp Advisor, an intelligent, empathetic, and highly realistic personal health coach. 
Based on the user's daily consumption, workouts, goals, USER SETTINGS (like workout frequency), and PAST DAYS context, generate actionable recommendations.

TONE & REALISM RULES (CRITICAL):
- ALWAYS RESPOND IN 100% HEBREW.
- BE CONSTRUCTIVE AND POSITIVE: Do not be overly harsh or "evil". Look at the bright side and big picture. Support the user through their journey, give realistic advice, and DO NOT make them feel bad for eating or resting.
- MATCH THEIR LIFESTYLE: If the user's setting says they train 2-3 times a week, do NOT expect them to train 5 times a week! Respect their stated workout frequency and goal. Be highly accurate to their specific situation.
- If they are off-track, provide gentle, realistic adjustments instead of scolding.
- TIME OF DAY: Base the advice on the current time and on what is LEFT of the day's targets (e.g. late evening: light suggestions, not a full meal plan).
- WORKOUTS: Judge each workout realistically. A short easy activity (e.g. a 15-minute walk) is nice movement but NOT a full workout and does not fulfil the weekly workout goal. Only substantial sessions count toward the goal.

Output Requirement:
Return ONLY a strictly formatted JSON object. Do not wrap in markdown blocks like \`\`\`json.
{
  "short": ["טיפ 1 קצר ותומך", "טיפ 2 קצר ותומך"],
  "full": "הסבר מפורט, מפרגן ומציאותי בעברית. הסתכל על התמונה המלאה ותן עצות מעשיות ובריאות שלא גורמות לתחושת אשמה. השתמש בכותרות עם אימוג'ים (לדוגמה: 🍳 תזונה, 🏃 פעילות)."
}
`;

export const generateDailyScoreExplanation = async (
    score: any,
    consumptionStr: string,
    isWorkoutLogged: boolean,
    userGoal?: string,
    loggedFoodsStr?: string,
    pastDaysContextStr?: string,
    extra: { workoutsDetailStr?: string; isFinalSummary?: boolean } = {}
): Promise<string | null> => {
    if (!checkAndIncrementRateLimits()) return null;
    try {
        const now = new Date();
        const currentTimeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

        const fullPrompt = `
${extra.isFinalSummary ? 'Day status: FINISHED (final summary)' : `Current Time: ${currentTimeStr}`}
Score: ${JSON.stringify(score)}
Goal: ${userGoal || 'Not set'}
Consumption: ${consumptionStr}
Workout Logged Today: ${isWorkoutLogged ? 'Yes' : 'No'}
Workouts Detail: ${extra.workoutsDetailStr || 'None'}
Logged Foods: ${loggedFoodsStr || 'None'}
Past Days & Weekly Context: ${pastDaysContextStr || 'No past context available.'}
`;

        const fallbackData = await generateContentWithFallback({
            contents: fullPrompt,
            config: {
                systemInstruction: SCORE_EXPLANATION_PROMPT + (extra.isFinalSummary ? FINAL_DAY_SUMMARY_ADDENDUM : ''),
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 1024 } 
            }
        });
        if (fallbackData.limitReached) return null;
        const result = fallbackData.result;
        
        const raw = (result.text || '{}').replace(/```json|```/g, '').trim();
        return raw; // Returns expected JSON string
    } catch (e: any) { return null; }
};;

export const generateDailyRecommendations = async (meals: Meal[], workouts: Workout[], targets: any, userGoal?: string, pastDaysContextStr?: string): Promise<{ short: string[], full: string } | null> => {
    if (!apiKey) return null;
    if (!checkAndIncrementRateLimits()) return null;
    try {
        // Send only what matters (no ids, images or long exercise JSON) and tell the model the time of day,
        // so "recommendations for the rest of the day" fit what is left of it.
        const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const mealsBrief = meals.map(m => ({ time: timeOf(m.timestamp), name: m.name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: m.fiber, sodium: m.sodium, sugar: m.sugar }));
        const workoutsBrief = workouts.map(w => ({ time: timeOf(w.timestamp), name: w.name, minutes: w.duration_minutes, calories: w.calories_burned, details: (w.description || '').split('\n')[0] }));
        const totals: Record<string, number> = {};
        for (const k of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'sugar']) totals[k] = Math.round(meals.reduce((a, m: any) => a + (m[k] || 0), 0));
        const promptMsg = `
Current Time: ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
Meals Logged: ${JSON.stringify(mealsBrief)}
Totals So Far: ${JSON.stringify(totals)}
Workouts Logged: ${JSON.stringify(workoutsBrief)}
Targets: ${JSON.stringify(targets)}
User Goal: ${userGoal || 'לא צוין'}
Past 3 Days Context: ${pastDaysContextStr || 'No past context available.'}
`;

        const fallbackData = await generateContentWithFallback({
            contents: promptMsg,
            config: { responseMimeType: 'application/json', systemInstruction: RECOMMENDATIONS_PROMPT,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 2048 } 
            }
        });
        if (fallbackData.limitReached) return null;
        const result = fallbackData.result;
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return { short: parsed.short || [], full: parsed.full || "" };
    } catch (e: any) { return null; }
};

export const generateWorkoutSummary = async (exercises: any[]): Promise<string> => {
    if (!apiKey || exercises.length === 0) return '';
    if (!checkAndIncrementRateLimits()) return '';

    try {
        const prompt = `צור פסקה אחת קצרה בעברית (עד 3 משפטים, ללא כותרות וללא סימוני Markdown בכלל) המסכמת את פירוט האימון הבא:\n\n${JSON.stringify(exercises, null, 2)}`;
        const fallbackData = await generateContentWithFallback({
            contents: prompt,
            config: { temperature: 0.1 }
        });
        if (fallbackData.limitReached) return '';
        const result = fallbackData.result;
        return (result.text || '').replace(/[*_#]/g, '').trim();
    } catch (e) {
        return '';
    }
};

export const estimateWorkoutMET = async (exercises: any[], duration: number, userMetrics: any): Promise<number> => {
    if (!apiKey || exercises.length === 0) return 4.0;
    
    try {
        const prompt = `You are a sports science expert. 
Calculate the precise Metabolic Equivalent of Task (MET) for this workout session based on exercise selection and volume.
Duration: ${duration} minutes.
User Profile: Weight ${userMetrics.weight || 74}kg, Height ${userMetrics.height || 175}cm, Age ${userMetrics.age || 30}, Gender ${userMetrics.gender || 'unknown'} (Use this context to adjust intensity baseline).

Exercises Log:
${JSON.stringify(exercises, null, 2)}

Return ONLY a valid JSON object containing exactly one numeric key "MET" (e.g. 4.5). Value must be between 2.0 and 10.0 depending on intensity. Return NO OTHER TEXT.`;

        const fallbackData = await generateContentWithFallback({
            contents: prompt,
            config: { temperature: 0.1 }
        });
        if (fallbackData.limitReached) return 4.0;
        const result = fallbackData.result;
        
        const parsed = JSON.parse((result.text || '{}').replace(/```json|```/g, ''));
        return typeof parsed.MET === 'number' ? parsed.MET : 4.0;
    } catch (e) {
        return 4.0;
    }
};


;
