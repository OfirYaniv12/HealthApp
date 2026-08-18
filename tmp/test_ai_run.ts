import { generateNutritionResponse } from '../utils/ai';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    console.log('Testing generateNutritionResponse...');
    const result = await generateNutritionResponse([], 'אכלתי 2 ביצים קשות וסלט ירקות');
    console.log('Result:', JSON.stringify(result, null, 2));
}

run().catch(console.error);
