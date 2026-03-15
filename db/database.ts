import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDB = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('nutrition.db');
  }
  return db;
};

export const initDB = async () => {
  const database = await getDB();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT,
      gender TEXT,
      age INTEGER,
      height REAL,
      weight REAL,
      goal TEXT,
      activity_level TEXT,
      workout_frequency TEXT,
      body_type TEXT,
      target_pace TEXT,
      target_calories REAL,
      target_protein REAL,
      target_carbs REAL,
      target_fat REAL
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein INTEGER NOT NULL,
      fat INTEGER NOT NULL,
      carbs INTEGER NOT NULL,
      image_uri TEXT,
      timestamp DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        ingredients_list TEXT NOT NULL,
        calories REAL NOT NULL,
        protein REAL NOT NULL,
        carbs REAL NOT NULL,
        fat REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS daily_scores (
        date TEXT PRIMARY KEY,
        nutrition_score INTEGER NOT NULL,
        movement_score INTEGER NOT NULL,
        final_score INTEGER NOT NULL,
        color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      calories_burned INTEGER NOT NULL,
      description TEXT,
      timestamp DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS workout_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      description TEXT,
      last_performed_date DATETIME,
      FOREIGN KEY (category_id) REFERENCES workout_categories (id) ON DELETE SET NULL
    );
  `);

  // Safe Migrations for existing DB instances
  try { await database.execAsync(`ALTER TABLE users ADD COLUMN target_fiber REAL;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE users ADD COLUMN target_sodium REAL;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE users ADD COLUMN target_sugar REAL;`); } catch (e) { }

  try { await database.execAsync(`ALTER TABLE meals ADD COLUMN fiber REAL DEFAULT 0;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE meals ADD COLUMN sodium REAL DEFAULT 0;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE meals ADD COLUMN sugar REAL DEFAULT 0;`); } catch (e) { }

  try { await database.execAsync(`ALTER TABLE recipes ADD COLUMN fiber REAL DEFAULT 0;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE recipes ADD COLUMN sodium REAL DEFAULT 0;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE recipes ADD COLUMN sugar REAL DEFAULT 0;`); } catch (e) { }

  // Migrations for My Recipes
  try { await database.execAsync(`ALTER TABLE recipes ADD COLUMN category_id INTEGER;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE recipes ADD COLUMN instructions TEXT;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE recipes ADD COLUMN last_cooked_date DATETIME;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE recipes ADD COLUMN image_uri TEXT;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE recipes ADD COLUMN health_score INTEGER;`); } catch (e) { }
  try { await database.execAsync(`ALTER TABLE recipes ADD COLUMN nutritional_values TEXT;`); } catch (e) { }
};

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

export const addMeal = async (meal: Omit<Meal, 'id'>) => {
  const database = await getDB();

  const result = await database.runAsync(
    `INSERT INTO meals(name, calories, protein, fat, carbs, fiber, sodium, sugar, image_uri, timestamp)
  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      meal.name, meal.calories, meal.protein, meal.fat, meal.carbs,
      meal.fiber || 0, meal.sodium || 0, meal.sugar || 0,
      meal.image_uri || null, meal.timestamp
    ]
  );
  return result;
};

export const getLogicalDayMeals = async (startIso: string, endIso: string) => {
  const database = await getDB();
  const logs = await database.getAllAsync<Meal>(
    `SELECT * FROM meals WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp DESC`,
    [startIso, endIso]
  );
  return logs;
};

export const deleteMeal = async (id: number) => {
  const database = await getDB();
  const result = await database.runAsync(`DELETE FROM meals WHERE id = ?`, [id]);
  return result;
};

export const clearAllMeals = async () => {
  const database = await getDB();
  const result = await database.runAsync(`DELETE FROM meals`);
  return result;
};

export interface Workout {
  id?: number;
  name: string;
  duration_minutes: number;
  calories_burned: number;
  description?: string | null;
  timestamp: string;
}

export const addWorkout = async (workout: Omit<Workout, 'id'>) => {
  const database = await getDB();

  const result = await database.runAsync(
    `INSERT INTO workouts(name, duration_minutes, calories_burned, description, timestamp)
     VALUES(?, ?, ?, ?, ?)`,
    [
      workout.name,
      workout.duration_minutes,
      workout.calories_burned,
      workout.description || null,
      workout.timestamp
    ]
  );
  return result;
};

export const getLogicalDayWorkouts = async (startIso: string, endIso: string) => {
  const database = await getDB();
  const logs = await database.getAllAsync<Workout>(
    `SELECT * FROM workouts WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp DESC`,
    [startIso, endIso]
  );
  return logs;
};

export const deleteWorkout = async (id: number) => {
  const database = await getDB();
  const result = await database.runAsync(`DELETE FROM workouts WHERE id = ?`, [id]);
  return result;
};

// --- Workout Categories & Templates CRUD ---

export interface WorkoutCategory {
  id?: number;
  name: string;
}

export interface WorkoutTemplate {
  id?: number;
  name: string;
  category_id: number | null;
  description?: string | null;
  last_performed_date?: string | null;
  category_name?: string; // Joined property
}

export const getWorkoutCategories = async () => {
  const database = await getDB();
  return await database.getAllAsync<WorkoutCategory>(`SELECT * FROM workout_categories ORDER BY name ASC`);
};

export const addWorkoutCategory = async (name: string) => {
  const database = await getDB();
  // Provide basic deduplication
  const existing = await database.getFirstAsync<WorkoutCategory>(`SELECT * FROM workout_categories WHERE name = ?`, [name]);
  if (existing) return existing;

  const result = await database.runAsync(`INSERT INTO workout_categories(name) VALUES(?)`, [name]);
  return { id: result.lastInsertRowId, name } as WorkoutCategory;
};

export const getWorkoutTemplates = async () => {
  const database = await getDB();
  return await database.getAllAsync<WorkoutTemplate>(`
    SELECT t.*, c.name as category_name 
    FROM workout_templates t 
    LEFT JOIN workout_categories c ON t.category_id = c.id 
    ORDER BY t.last_performed_date DESC, t.name ASC
  `);
};

export const addWorkoutTemplate = async (template: Omit<WorkoutTemplate, 'id' | 'category_name'>) => {
  const database = await getDB();
  const result = await database.runAsync(
    `INSERT INTO workout_templates(name, category_id, description, last_performed_date) VALUES(?, ?, ?, ?)`,
    [template.name, template.category_id, template.description || null, template.last_performed_date || null]
  );
  return result;
};

export const updateWorkoutTemplateLastPerformed = async (id: number, dateIso: string) => {
  const database = await getDB();
  return await database.runAsync(
    `UPDATE workout_templates SET last_performed_date = ? WHERE id = ?`,
    [dateIso, id]
  );
};

export const deleteWorkoutTemplate = async (id: number) => {
  const database = await getDB();
  return await database.runAsync(`DELETE FROM workout_templates WHERE id = ?`, [id]);
};

// --- Recipe Categories & Recipes CRUD ---

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
  nutritional_values?: string | null; // JSON string
  category_name?: string; // Joined property
}

export const getRecipeCategories = async () => {
  const database = await getDB();
  return await database.getAllAsync<RecipeCategory>(`SELECT * FROM recipe_categories ORDER BY name ASC`);
};

export const addRecipeCategory = async (name: string) => {
  const database = await getDB();
  const existing = await database.getFirstAsync<RecipeCategory>(`SELECT * FROM recipe_categories WHERE name = ?`, [name]);
  if (existing) return existing;

  const result = await database.runAsync(`INSERT INTO recipe_categories(name) VALUES(?)`, [name]);
  return { id: result.lastInsertRowId, name } as RecipeCategory;
};

export const deleteRecipeCategory = async (id: number) => {
  const database = await getDB();
  return await database.runAsync(`DELETE FROM recipe_categories WHERE id = ?`, [id]);
};

export const getRecipesWithCategories = async () => {
  const database = await getDB();
  return await database.getAllAsync<Recipe>(`
    SELECT r.*, c.name as category_name 
    FROM recipes r 
    LEFT JOIN recipe_categories c ON r.category_id = c.id 
    ORDER BY r.last_cooked_date DESC, r.name ASC
  `);
};

export const addRecipe = async (recipe: Omit<Recipe, 'id' | 'category_name'>) => {
  const database = await getDB();
  const result = await database.runAsync(
    `INSERT INTO recipes(
      name, category_id, ingredients_list, instructions, 
      calories, protein, carbs, fat, fiber, sodium, sugar, 
      last_cooked_date, image_uri, health_score, nutritional_values
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recipe.name,
      recipe.category_id,
      recipe.ingredients_list,
      recipe.instructions || null,
      recipe.calories,
      recipe.protein,
      recipe.carbs,
      recipe.fat,
      recipe.fiber || 0,
      recipe.sodium || 0,
      recipe.sugar || 0,
      recipe.last_cooked_date || null,
      recipe.image_uri || null,
      recipe.health_score || null,
    ]
  );
  return result;
};

export const updateRecipeLastCooked = async (id: number, dateIso: string) => {
  const database = await getDB();
  return await database.runAsync(
    `UPDATE recipes SET last_cooked_date = ? WHERE id = ?`,
    [dateIso, id]
  );
};


export const deleteRecipe = async (id: number) => {
  const database = await getDB();
  return await database.runAsync(`DELETE FROM recipes WHERE id = ?`, [id]);
};

export const updateRecipeImage = async (id: number, imageUri: string | null) => {
  const database = await getDB();
  return await database.runAsync(`UPDATE recipes SET image_uri = ? WHERE id = ?`, [imageUri, id]);
};

export const updateRecipe = async (
  id: number,
  name: string,
  category_id: number | null,
  ingredients_list: string,
  instructions: string | null
) => {
  const database = await getDB();
  return await database.runAsync(
    `UPDATE recipes 
     SET name = ?, category_id = ?, ingredients_list = ?, instructions = ? 
     WHERE id = ?`,
    [name, category_id, ingredients_list, instructions, id]
  );
};


