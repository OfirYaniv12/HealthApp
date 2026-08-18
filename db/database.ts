import { supabase } from '@/utils/supabase';

export interface Meal {
    id?: number;
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber?: number;
    sodium?: number;
    sugar?: number;
    image_uri?: string | null;
    timestamp: string;
}

export interface Workout {
    id?: number;
    name: string;
    duration_minutes: number;
    calories_burned: number;
    description?: string | null;
    exercises?: string | null;
    timestamp: string;
}

export interface WorkoutCategory {
    id?: number;
    name: string;
}

export interface WorkoutTemplate {
    id?: number;
    name: string;
    category_id: number | null;
    description?: string | null;
    exercises?: string | null;
    summary?: string | null;
    last_performed_date?: string | null;
    category_name?: string;
}

export interface RecipeCategory {
    id?: number;
    name: string;
}

export interface Recipe {
    id?: number;
    name: string;
    category_id: number | null;
    ingredients_list: string;
    instructions?: string | null;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sodium?: number;
    sugar?: number;
    last_cooked_date?: string | null;
    image_uri?: string | null;
    health_score?: number | null;
    nutritional_values?: string | null;
    category_name?: string;
}

export const getDB = async () => ({});
export const initDB = async () => {};

const getUserId = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not logged in');
    return session.user.id;
};

export const addMeal = async (meal: Omit<Meal, 'id'>) => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from('meals').insert({ ...meal, user_id }).select().single();
    if (error) throw error;
    return data;
};

export const getLogicalDayMeals = async (startIso: string, endIso: string) => {
    const { data, error } = await supabase.from('meals')
        .select('*')
        .gte('timestamp', startIso)
        .lt('timestamp', endIso)
        .order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const deleteMeal = async (id: number) => {
    const { error } = await supabase.from('meals').delete().eq('id', id);
    if (error) throw error;
};

export const clearAllMeals = async () => {
    const user_id = await getUserId();
    const { error } = await supabase.from('meals').delete().eq('user_id', user_id);
    if (error) throw error;
};

export const addWorkout = async (workout: Omit<Workout, 'id'>) => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from('workouts').insert({ ...workout, user_id }).select().single();
    if (error) throw error;
    return data;
};

export const getLogicalDayWorkouts = async (startIso: string, endIso: string) => {
    const { data, error } = await supabase.from('workouts')
        .select('*')
        .gte('timestamp', startIso)
        .lt('timestamp', endIso)
        .order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getAllWorkouts = async () => {
    const { data, error } = await supabase.from('workouts').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const deleteWorkout = async (id: number) => {
    const { error } = await supabase.from('workouts').delete().eq('id', id);
    if (error) throw error;
};

export const getWorkoutCategories = async () => {
    const { data, error } = await supabase.from('workout_categories').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const addWorkoutCategory = async (name: string) => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from('workout_categories').insert({ name, user_id }).select().single();
    if (error) throw error;
    return data;
};

export const deleteWorkoutCategory = async (id: number) => {
    const { error } = await supabase.from('workout_categories').delete().eq('id', id);
    if (error) throw error;
};

export const getWorkoutTemplates = async () => {
    const { data: templates } = await supabase.from('workout_templates').select('*').order('last_performed_date', { ascending: false });
    const { data: categories } = await supabase.from('workout_categories').select('*');
    
    return (templates || []).map(t => {
        const cat = (categories || []).find(c => c.id === t.category_id);
        return { ...t, category_name: cat ? cat.name : undefined };
    });
};

export const getWorkoutTemplateById = async (id: number) => {
    const { data: t } = await supabase.from('workout_templates').select('*').eq('id', id).single();
    if (!t) return null;
    let category_name;
    if (t.category_id) {
        const { data: c } = await supabase.from('workout_categories').select('name').eq('id', t.category_id).single();
        if (c) category_name = c.name;
    }
    return { ...t, category_name };
};

export const addWorkoutTemplate = async (template: Omit<WorkoutTemplate, 'id' | 'category_name'>) => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from('workout_templates').insert({ ...template, user_id }).select().single();
    if (error) throw error;
    return data;
};

export const updateWorkoutTemplateLastPerformed = async (id: number, dateIso: string) => {
    const { error } = await supabase.from('workout_templates').update({ last_performed_date: dateIso }).eq('id', id);
    if (error) throw error;
};

export const updateWorkoutTemplateExercises = async (id: number, exercisesJson: string) => {
    const { error } = await supabase.from('workout_templates').update({ exercises: exercisesJson }).eq('id', id);
    if (error) throw error;
};

export const deleteWorkoutTemplate = async (id: number) => {
    const { error } = await supabase.from('workout_templates').delete().eq('id', id);
    if (error) throw error;
};

export const getRecipeCategories = async () => {
    const { data, error } = await supabase.from('recipe_categories').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
};

export const addRecipeCategory = async (name: string) => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from('recipe_categories').insert({ name, user_id }).select().single();
    if (error) throw error;
    return data;
};

export const deleteRecipeCategory = async (id: number) => {
    const { error } = await supabase.from('recipe_categories').delete().eq('id', id);
    if (error) throw error;
};

export const getRecipesWithCategories = async () => {
    const { data: recipes } = await supabase.from('recipes').select('*').order('last_cooked_date', { ascending: false });
    const { data: categories } = await supabase.from('recipe_categories').select('*');
    
    return (recipes || []).map(r => {
        const cat = (categories || []).find(c => c.id === r.category_id);
        return { ...r, category_name: cat ? cat.name : undefined };
    });
};

export const addRecipe = async (recipe: Omit<Recipe, 'id' | 'category_name'>) => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from('recipes').insert({ ...recipe, user_id }).select().single();
    if (error) throw error;
    return data;
};

export const updateRecipeLastCooked = async (id: number, dateIso: string) => {
    const { error } = await supabase.from('recipes').update({ last_cooked_date: dateIso }).eq('id', id);
    if (error) throw error;
};

export const deleteRecipe = async (id: number) => {
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) throw error;
};

export const updateRecipeImage = async (id: number, imageUri: string | null) => {
    const { error } = await supabase.from('recipes').update({ image_uri: imageUri }).eq('id', id);
    if (error) throw error;
};

export const updateRecipe = async (
    id: number,
    name: string,
    category_id: number | null,
    ingredients_list: string,
    instructions: string | null,
    calories: number,
    protein: number,
    carbs: number,
    fat: number,
    fiber?: number,
    sodium?: number,
    sugar?: number
) => {
    const { error } = await supabase.from('recipes').update({
        name, category_id, ingredients_list, instructions, calories, protein, carbs, fat, fiber, sodium, sugar
    }).eq('id', id);
    if (error) throw error;
};
