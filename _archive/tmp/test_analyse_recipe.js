const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(key);

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
  "totals": { "calories": 400, "protein": 45, "fat": 20, "carbs": 10, "fiber": 3, "sodium": 300, "sugar": 4 },
  "healthScore": 8,
  "ingredientBreakdown": [
    { "name": "200g chicken breast", "calories": 330, "protein": 44, "fat": 7, "carbs": 0 }
  ]
}
`;

async function run() {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: RECIPE_ANALYSIS_PROMPT });
        const chat = model.startChat({ generationConfig: { temperature: 0.1 } });

        const promptMsg = `
Recipe Name: חזה עוף בתנור
Ingredients:
- Amount: 200, Unit: גרם, Item: חזה עוף
- Amount: 1, Unit: כף, Item: שמן זית

Instructions: ללא הוראות מיוחדות
`;

        const result = await chat.sendMessage(promptMsg);
        const text = result.response.text();
        console.log('--- RAW OUTPUT ---');
        console.log(text);
        console.log('------------------');
        JSON.parse(text.trim().replace(/^```json/, '').replace(/```$/, '').trim());
        console.log('✅ Parse SUCCESS');
    } catch(e) {
        console.error('❌ Parse FAILED:', e.message);
    }
}
run();
