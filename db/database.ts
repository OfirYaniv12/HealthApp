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

/**
 * Saves the user's profile to the `users` table (one row per account).
 * Returns the Supabase error message, or null on success, so callers can tell the user.
 */
export const saveUserProfile = async (profile: {
    full_name: string; gender: string; age: number; height: number; weight: number;
    goal: string; activity_level: string; workout_frequency: string; body_type: string;
    target_pace?: string | null; daily_targets: any;
    resetTime?: string; trackedNutrients?: Record<string, boolean>; settingsUpdatedAt?: number;
    weightHistory?: { date: string; weight: number }[];
}): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return 'not logged in';
    const { error } = await supabase.from('users').upsert({
        id: session.user.id,
        full_name: profile.full_name,
        gender: profile.gender,
        age: profile.age,
        height: profile.height,
        weight: profile.weight,
        goal: profile.goal,
        activity_level: profile.activity_level,
        workout_frequency: profile.workout_frequency,
        body_type: profile.body_type,
        target_pace: profile.target_pace || null,
        target_calories: profile.daily_targets?.calories ? Math.round(profile.daily_targets.calories) : null,
        daily_targets: profile.daily_targets,
        settings: {
            resetTime: profile.resetTime || '00:00',
            trackedNutrients: profile.trackedNutrients || null,
            weightHistory: profile.weightHistory || null,
            updatedAt: profile.settingsUpdatedAt || Date.now(),
        },
    });
    if (error) {
        console.error('Failed to save user profile:', error);
        return error.message;
    }
    return null;
};

/** Loads the profile row and converts it to the app's user shape (null if there is none). */
export const fetchUserProfile = async (userId: string): Promise<any | null> => {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (error || !data || !data.full_name) return null;
    const { settings, target_calories, ...profile } = data as any;
    return {
        ...profile,
        daily_targets: profile.daily_targets || { calories: target_calories || 2000, protein: 120, carbs: 200, fat: 60 },
        ...(settings?.resetTime ? { resetTime: settings.resetTime } : {}),
        ...(settings?.trackedNutrients ? { trackedNutrients: settings.trackedNutrients } : {}),
        ...(settings?.weightHistory ? { weightHistory: settings.weightHistory } : {}),
        ...(settings?.updatedAt ? { settingsUpdatedAt: settings.updatedAt } : {}),
    };
};

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
    const user_id = await getUserId();
    const { data, error } = await supabase.from('meals')
        .select('*')
        .eq('user_id', user_id)
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
    const user_id = await getUserId();
    const { data, error } = await supabase.from('workouts')
        .select('*')
        .eq('user_id', user_id)
        .gte('timestamp', startIso)
        .lt('timestamp', endIso)
        .order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const getAllWorkouts = async () => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from('workouts').select('*').eq('user_id', user_id).order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
};

export const deleteWorkout = async (id: number) => {
    const { error } = await supabase.from('workouts').delete().eq('id', id);
    if (error) throw error;
};

export const getWorkoutCategories = async () => {
    const user_id = await getUserId();
    const { data, error } = await supabase.from('workout_categories').select('*').eq('user_id', user_id).order('name', { ascending: true });
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
    const user_id = await getUserId();
    const { data: templates } = await supabase.from('workout_templates').select('*').eq('user_id', user_id).order('last_performed_date', { ascending: false });
    const { data: categories } = await supabase.from('workout_categories').select('*').eq('user_id', user_id);
    
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

export const updateWorkoutTemplate = async (
    id: number,
    fields: Partial<Pick<WorkoutTemplate, 'name' | 'category_id' | 'exercises' | 'summary' | 'description'>>
) => {
    const { error } = await supabase.from('workout_templates').update(fields).eq('id', id);
    if (error) throw error;
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
    const user_id = await getUserId();
    const { data, error } = await supabase.from('recipe_categories').select('*').eq('user_id', user_id).order('name', { ascending: true });
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
    const user_id = await getUserId();
    const { data: recipes } = await supabase.from('recipes').select('*').eq('user_id', user_id).order('last_cooked_date', { ascending: false });
    const { data: categories } = await supabase.from('recipe_categories').select('*').eq('user_id', user_id);
    
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
    sugar?: number,
    extra?: { nutritional_values?: string | null; health_score?: number | null }
) => {
    const { error } = await supabase.from('recipes').update({
        name, category_id, ingredients_list, instructions, calories, protein, carbs, fat, fiber, sodium, sugar,
        ...(extra || {})
    }).eq('id', id);
    if (error) throw error;
};
