const fs = require('fs');
let code = fs.readFileSync('db/database.ts', 'utf-8');

// Replace .select('*') with .select('*').eq('user_id', user_id)
// We need to inject `const user_id = await getUserId();` into all getter functions.

const addUserIdToSelects = () => {
    // getMeals
    code = code.replace(
        /export const getMeals = async \(startIso: string, endIso: string\) => \{/g,
        `export const getMeals = async (startIso: string, endIso: string) => {
    const user_id = await getUserId();`
    );
    code = code.replace(
        /const \{ data, error \} = await supabase.from\('meals'\)\n\s*\.select\('\*'\)/g,
        `const { data, error } = await supabase.from('meals')
        .select('*')
        .eq('user_id', user_id)`
    );

    // getWorkouts
    code = code.replace(
        /export const getWorkouts = async \(startIso: string, endIso: string\) => \{/g,
        `export const getWorkouts = async (startIso: string, endIso: string) => {
    const user_id = await getUserId();`
    );
    code = code.replace(
        /const \{ data, error \} = await supabase.from\('workouts'\)\n\s*\.select\('\*'\)/g,
        `const { data, error } = await supabase.from('workouts')
        .select('*')
        .eq('user_id', user_id)`
    );

    // getAllWorkouts
    code = code.replace(
        /export const getAllWorkouts = async \(\) => \{/g,
        `export const getAllWorkouts = async () => {
    const user_id = await getUserId();`
    );
    code = code.replace(
        /const \{ data, error \} = await supabase.from\('workouts'\)\.select\('\*'\)/g,
        `const { data, error } = await supabase.from('workouts').select('*').eq('user_id', user_id)`
    );

    // getWorkoutCategories
    code = code.replace(
        /export const getWorkoutCategories = async \(\) => \{/g,
        `export const getWorkoutCategories = async () => {
    const user_id = await getUserId();`
    );
    code = code.replace(
        /const \{ data, error \} = await supabase.from\('workout_categories'\)\.select\('\*'\)/g,
        `const { data, error } = await supabase.from('workout_categories').select('*').eq('user_id', user_id)`
    );

    // getWorkoutTemplates
    code = code.replace(
        /export const getWorkoutTemplates = async \(\) => \{/g,
        `export const getWorkoutTemplates = async () => {
    const user_id = await getUserId();`
    );
    code = code.replace(
        /const \{ data: templates \} = await supabase.from\('workout_templates'\)\.select\('\*'\)/g,
        `const { data: templates } = await supabase.from('workout_templates').select('*').eq('user_id', user_id)`
    );
    code = code.replace(
        /const \{ data: categories \} = await supabase.from\('workout_categories'\)\.select\('\*'\);/g,
        `const { data: categories } = await supabase.from('workout_categories').select('*').eq('user_id', user_id);`
    );

    // getRecipeCategories
    code = code.replace(
        /export const getRecipeCategories = async \(\) => \{/g,
        `export const getRecipeCategories = async () => {
    const user_id = await getUserId();`
    );
    code = code.replace(
        /const \{ data, error \} = await supabase.from\('recipe_categories'\)\.select\('\*'\)/g,
        `const { data, error } = await supabase.from('recipe_categories').select('*').eq('user_id', user_id)`
    );

    // getRecipes
    code = code.replace(
        /export const getRecipes = async \(\) => \{/g,
        `export const getRecipes = async () => {
    const user_id = await getUserId();`
    );
    code = code.replace(
        /const \{ data: recipes \} = await supabase.from\('recipes'\)\.select\('\*'\)/g,
        `const { data: recipes } = await supabase.from('recipes').select('*').eq('user_id', user_id)`
    );
    code = code.replace(
        /const \{ data: categories \} = await supabase.from\('recipe_categories'\)\.select\('\*'\);/g,
        `const { data: categories } = await supabase.from('recipe_categories').select('*').eq('user_id', user_id);`
    );

    // Get specific template (if there is one)
    code = code.replace(
        /export const getWorkoutTemplateById = async \(id: number\) => \{/g,
        `export const getWorkoutTemplateById = async (id: number) => {
    const user_id = await getUserId();`
    );
    code = code.replace(
        /const \{ data: t \} = await supabase.from\('workout_templates'\)\.select\('\*'\)\.eq\('id', id\)/g,
        `const { data: t } = await supabase.from('workout_templates').select('*').eq('id', id).eq('user_id', user_id)`
    );
};

addUserIdToSelects();
fs.writeFileSync('db/database.ts', code, 'utf-8');
