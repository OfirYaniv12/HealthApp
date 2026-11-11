import { Meal, Workout } from '@/db/database';
import { UserData } from '@/store/useUserStore';
import { supabase } from '@/utils/supabase';
import { calculateDailyTargets } from '@/utils/calculators';
import { computeWorkoutCalories } from '@/utils/workoutCalories';
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
export const DAILY_LIMIT = 500;
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
        if (e?.status === 413) return { isMeal: false, textResponse: 'התמונה גדולה מדי לשליחה. נסה לצלם שוב או לשלוח צילום מסך.' };
        if (e?.status === 401) return { isMeal: false, textResponse: 'נראה שההתחברות פגה. התחבר מחדש ונסה שוב.' };
        return { isMeal: false, textResponse: 'שגיאת AI. נסה שוב בעוד רגע.' };
    }
};
;


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


;

const WORKOUT_SYSTEM_PROMPT = `
You are the HealthApp workout assistant. The user describes a workout in Hebrew (text and/or a screenshot from a watch / fitness app).
Your job is to UNDERSTAND the workout precisely. The app calculates the calories itself from what you extract (do not calculate calories).

Extract:
- activity_type: one of "gym" (strength / resistance training), "running", "walking", "cycling", "swimming", "other" (anything else: boxing, yoga, football, HIIT class, tennis...).
- duration_minutes: total minutes of the workout. If the user did not say how long it took, DO NOT guess: return isWorkout=false and ask for the duration in Hebrew.
- distance_km: the distance in km if given (convert metres to km, e.g. 800 מטר = 0.8). If not given, 0.
- met: the intensity in METs (Compendium of Physical Activities, gross values), ONLY for "gym" and "other" (0 for the other types – the app derives them from speed):
  gym: light/technique 3.5, regular 4.5, heavy/vigorous 5.0, circuit/crossfit-style 6.0-8.0.
  other: use the Compendium value for the activity and the described effort (e.g. yoga 2.5-3.0, pilates 3.0, Thai boxing / kickboxing class 7.0-8.0, sparring 10, football game 7.0-8.0, tennis singles 8.0, HIIT class 8.0, dancing class 5.0-7.0).
  Use the SAME value for the same description every time.
- name: short Hebrew name (e.g. "ריצה בקצב מתון", "אימון רגליים").
- summary: one short Hebrew sentence describing the workout (no calorie numbers).
If a screenshot is attached, read the values from it (activity, time, distance; if it shows calories, ignore them).

If the user is just chatting, return isWorkout=false and a friendly Hebrew textResponse.
All text fields in Hebrew.
`;

const WORKOUT_FIELDS = ['isWorkout', 'textResponse', 'activity_type', 'name', 'duration_minutes', 'distance_km', 'met', 'summary'];
const WORKOUT_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        isWorkout: { type: 'BOOLEAN' },
        textResponse: { type: 'STRING' },
        activity_type: { type: 'STRING', enum: ['gym', 'running', 'walking', 'cycling', 'swimming', 'other'] },
        name: { type: 'STRING' },
        duration_minutes: { type: 'NUMBER' },
        distance_km: { type: 'NUMBER' },
        met: { type: 'NUMBER' },
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
        const parts: any[] = [{ text: newMessageText }];
        if (imageBase64) {
            const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/);
            parts.push({ inlineData: { data: imageBase64.split(',')[1] || imageBase64, mimeType: mimeMatch?.[1] || 'image/jpeg' } });
        }
        const fallbackData = await generateContentWithFallback({
            contents: [...history, { role: 'user', parts }],
            config: {
                responseMimeType: 'application/json', responseSchema: WORKOUT_RESPONSE_SCHEMA,
                systemInstruction: WORKOUT_SYSTEM_PROMPT, temperature: 0,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        }, imageBase64 ? 45000 : 20000);
        if (fallbackData.limitReached) return { isWorkout: false, limitReached: true, textResponse: 'הגיע למגבלת השימוש.' };
        const result = fallbackData.result;
        const usedModel = fallbackData.usedModel;
        const parsed = JSON.parse(extractJson(result.text || '{}'));
        const data = parsed.workoutData || parsed;
        const minutes = toNum(data.duration_minutes);

        if (parsed.isWorkout && minutes > 0) {
            const km = toNum(data.distance_km);
            const types = ['gym', 'running', 'walking', 'cycling', 'swimming', 'other'];
            const type = types.includes(data.activity_type) ? data.activity_type : 'other';
            // Calories are calculated by the app (deterministic), not by the AI
            const calc = computeWorkoutCalories({
                type, minutes, weightKg: userWeightKg, distanceKm: km > 0 ? km : null,
                met: type === 'gym' || type === 'other' ? toNum(data.met) || null : null,
            });
            return {
                isWorkout: true,
                workoutData: {
                    name: data.name || 'אימון',
                    duration_minutes: Math.round(minutes),
                    distance_km: km > 0 ? km : null,
                    calories_burned: calc.kcal,
                    summary: `${data.summary ? data.summary + '\n' : ''}${calc.explanation}`,
                },
                usedModel
            };
        }
        if (parsed.isWorkout) {
            // A workout without a duration can't be calculated: ask instead of showing an empty card
            return { isWorkout: false, textResponse: parsed.textResponse || 'כמה זמן נמשך האימון? (ואם יש – מה היה המרחק)', usedModel };
        }
        return { isWorkout: false, textResponse: parsed.textResponse || 'לא הבנתי, אפשר לפרט איזה אימון עשית וכמה זמן?', usedModel };
    } catch (e: any) {
        console.error('[AI] Workout request failed', e);
        if (e?.status === 413) return { isWorkout: false, textResponse: 'התמונה גדולה מדי לשליחה. נסה לצלם שוב או לשלוח צילום מסך.' };
        if (e?.status === 401) return { isWorkout: false, textResponse: 'נראה שההתחברות פגה. התחבר מחדש ונסה שוב.' };
        return { isWorkout: false, textResponse: 'שגיאת AI. נסה שוב בעוד רגע.' };
    }
};

/**
 * Intensity (MET) of an "other" activity such as Thai boxing, decided once and stored with the
 * workout template so every future log of it is calculated identically. Returns null on failure.
 */
export const estimateActivityMET = async (activityName: string, description: string | null): Promise<number | null> => {
    if (!checkAndIncrementRateLimits()) return null;
    try {
        const fallbackData = await generateContentWithFallback({
            contents: `Activity: ${activityName}\nDescription: ${description || 'none'}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: { type: 'OBJECT', properties: { met: { type: 'NUMBER' } }, required: ['met'] },
                systemInstruction: 'Return the typical gross MET value (Compendium of Physical Activities) for this activity as described, for a full session including normal short breaks. Examples: yoga 2.5-3.0, pilates 3.0, Thai boxing / kickboxing class 7.0-8.0, boxing sparring 10, football 7.0-8.0, tennis singles 8.0, HIIT class 8.0, dance class 5.0-7.0, climbing 5.8-7.5. JSON only.',
                temperature: 0,
            }
        });
        if (fallbackData.limitReached) return null;
        const met = toNum(JSON.parse(extractJson(fallbackData.result.text || '{}')).met);
        return met >= 1.5 && met <= 16 ? met : null;
    } catch (e) {
        return null;
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

// What each of the app's goals ("plans") means. Shared by the score explanation and the recommendations,
// so the AI coaches toward the user's actual plan instead of guessing from its name.
const GOAL_GUIDE = `
THE USER'S PLAN (the "Goal" field) – coach according to it:
- "ירידה במשקל" (weight loss): a calorie deficit to lose mainly fat. Most important: staying at or slightly under the calorie target; protein high to keep muscle; limit sugar and fat. Going clearly over calories is the main thing that hurts. Eating far too little is also not good (hard to sustain, loses muscle).
- "עלייה במסת שריר" (muscle gain): a calorie surplus + strength training to build muscle. Most important: eating ENOUGH – reaching the calorie and protein targets. Under-eating is the main failure; being a little over calories is fine. Strength workouts are central.
- "שילוב מתון" (recomposition): lose fat and build/keep muscle at the same time, slowly. A small deficit with high protein. Both going over calories and missing protein matter.
- "אורח חיים בריא יותר" (healthier lifestyle): no weight change. The focus is on eating healthier and more varied (vegetables, fruit, legumes, whole grains, lean protein, nuts – many different food groups), keeping sugar and sodium low, enough fiber, and training regularly. Praise variety and real food; gently point out processed / fried / sugary items.

HOW THE SCORE WORKS (so your explanation matches the number):
- Each nutrient gets its own 0-10 score ("nutrientScores"), compared to where the user should be by now (by the end of the day, the full target). The plan decides how much each nutrient counts.
- Sugar and sodium are ceilings: under the limit is good; only going over costs points.
- Part of the score is food quality & variety ("healthQualityScore", "foodGroups" = healthy food groups eaten today). For the healthier-lifestyle plan this part counts more.
- A real workout adds a bonus; light activity adds a small one.
- STEPS (only if the Workouts Detail mentions steps; if it says steps tracking is not active, never mention steps): steps are part of the score compared to the user's daily steps goal, judged by the time of day. Going over the goal is a bonus – praise it. If behind, suggest a short walk. Steps already include walks logged as workouts.
- When explaining a score, name the 1-2 nutrients with the LOWEST nutrientScores as the main reasons (in Hebrew words, never the English keys), and say what went well. Never contradict the number.
`;

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
- Address the user in the grammatical gender given in the Goal field ("פנה למשתמש בלשון זכר/נקבה"). Never use slash forms like את/ה.
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
                systemInstruction: SCORE_EXPLANATION_PROMPT + GOAL_GUIDE + (extra.isFinalSummary ? FINAL_DAY_SUMMARY_ADDENDUM : ''),
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
            config: { responseMimeType: 'application/json', systemInstruction: RECOMMENDATIONS_PROMPT + GOAL_GUIDE + `\nFor recommendations: tailor every tip to the plan above (e.g. muscle gain: how to still reach protein/calories today; weight loss: what to eat to stay within calories while feeling full; healthier lifestyle: which food group is still missing today for variety, and nudge toward the next workout).\n`,
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



;
