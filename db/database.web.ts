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
    prep_time_minutes?: number | null;
    image_uri?: string | null;
    last_cooked_date?: string | null;
    category_name?: string;
}

export const getDB = async () => ({});
export const initDB = async () => {};

export const addMeal = async () => {};
export const getLogicalDayMeals = async () => [];
export const deleteMeal = async () => {};
export const clearAllMeals = async () => {};

export const addWorkout = async () => {};
export const getLogicalDayWorkouts = async () => [];
export const getAllWorkouts = async () => [];
export const deleteWorkout = async () => {};

export const getWorkoutCategories = async () => [];
export const addWorkoutCategory = async () => {};
export const deleteWorkoutCategory = async () => {};

export const getWorkoutTemplates = async () => [];
export const getWorkoutTemplateById = async () => null;
export const addWorkoutTemplate = async () => {};
export const updateWorkoutTemplateLastPerformed = async () => {};
export const updateWorkoutTemplateExercises = async () => {};
export const deleteWorkoutTemplate = async () => {};

export const getRecipeCategories = async () => [];
export const addRecipeCategory = async () => {};
export const deleteRecipeCategory = async () => {};

export const getRecipesWithCategories = async () => [];
export const addRecipe = async () => {};
export const updateRecipeLastCooked = async () => {};
export const deleteRecipe = async () => {};
export const updateRecipeImage = async () => {};
export const updateRecipe = async () => {};
