# Project: Personal Nutrition & Habit Tracker

## 1. App Overview
A personalized mobile application designed to track daily nutrition (focusing heavily on calories, protein, and macros), custom recipes, and daily habit scoring. The app calculates daily goals based on user metrics and provides a calendar-based visual summary of their progress.

## 2. Tech Stack
* **Frontend/Mobile:** React Native (using Expo for easy local testing and iOS deployment).
* **State Management:** Zustand or React Context.
* **Local Storage/Database:** Local SQLite (Expo SQLite) for user data and custom recipes (Offline-first approach).
* **External API:** OpenFoodFacts API or Edamam API (for fetching food nutritional values).

## 3. Core Features & User Flow
### Phase 1: Onboarding & Calculation
* User inputs: Gender, Height, Weight, Goal (Weight loss / Muscle gain / Both / General health).
* System calculates and sets daily targets: Calories, Protein (primary focus), Fats, Carbs, and essential vitamins.

### Phase 2: Daily Tracker (The Diary)
* Main dashboard showing daily progress (consumed macros vs. target).
* Add Food: User can search for a food item (fetches data from API).
* Quantity Input: Option to enter exact weight (grams) OR "by eye" (portions/units).
* Calculates and adds the item's macros to the daily total.

### Phase 3: Recipe & Meal Builder ("My Meals")
* A dedicated tab to create and save custom grouped meals (e.g., "My regular 2-egg omelet with cheese and onion").
* User can define ingredients, weights, and fat percentages for the recipe.
* Acts as both a recipe book and a "Quick Add" shortcut for the daily diary to save logging time.

### Phase 4: Calendar & Daily Scoring
* A visual calendar view.
* Algorithm calculates a daily objective score (1 to 10) based on macro adherence, steps, and workouts.
* Color coding: 1-4 (Red/Bad), 4-7 (Yellow/OK), 7-10 (Green/Great).
* Weekly summary panel: Total workouts, average steps, and overall week performance.

## 4. Initial Data Models (Draft)
* `User`: id, gender, height, weight, goal, daily_targets (calories, protein, carbs, fat).
* `FoodLog`: id, date, food_item, quantity_type (exact/estimated), total_macros.
* `Recipe`: id, name, ingredients_list, total_macros.
* `DailyScore`: date, nutrition_score, movement_score, final_score (1-10), color.