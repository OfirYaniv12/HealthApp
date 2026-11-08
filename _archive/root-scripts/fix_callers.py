import os

# scoreUpdater.ts
path_score = 'utils/scoreUpdater.ts'
with open(path_score, 'r', encoding='utf-8') as f:
    text_score = f.read()

text_score = text_score.replace(
    '''        const isWorkoutLogged = workouts.length > 0;
        const loggedFoodsStr = (meals as Meal[]).map(m => m.name).join(', ') || 'לא נרשמו ארוחות';

        // Generate Explanation — returns null on any API/quota error
        const explanation = await generateDailyScoreExplanation(
            score,
            consumptionStr,
            isWorkoutLogged,
            user.goal,
            loggedFoodsStr
        );''',
    '''        const isWorkoutLogged = workouts.length > 0;
        const loggedFoodsStr = (meals as Meal[]).map(m => m.name).join(', ') || 'לא נרשמו ארוחות';

        // Fetch past 3 days context
        const { start } = getLogicalDayBounds(user.resetTime || '00:00');
        const pastDate = new Date(start);
        pastDate.setDate(pastDate.getDate() - 3);
        const pastStartIso = pastDate.toISOString();
        const [pastMeals, pastWorkouts] = await Promise.all([
            getLogicalDayMeals(pastStartIso, start),
            getLogicalDayWorkouts(pastStartIso, start)
        ]);
        const pastMealsTotal = (pastMeals || []).reduce((sum, m) => sum + (m.calories || 0), 0);
        const pastContextStr = `Past 3 days logged ${(pastMeals || []).length} meals (approx ${Math.round(pastMealsTotal)} kcal total) and ${(pastWorkouts || []).length} workouts.`;

        // Generate Explanation — returns null on any API/quota error
        const explanation = await generateDailyScoreExplanation(
            score,
            consumptionStr,
            isWorkoutLogged,
            user.goal,
            loggedFoodsStr,
            pastContextStr
        );'''
)
with open(path_score, 'w', encoding='utf-8') as f:
    f.write(text_score)

# index.tsx
path_index = 'app/(drawer)/index.tsx'
with open(path_index, 'r', encoding='utf-8') as f:
    text_index = f.read()

text_index = text_index.replace(
    '''          if (!isSameDay || !isSameHash || (isFailure && !isRecentFailure)) {
            if (isMounted) setLoadingRecs(true);
            const targets = { ...currentUser.daily_targets };
            const recs = await generateDailyRecommendations(logs, workouts, targets, currentUser.goal);''',
    '''          if (!isSameDay || !isSameHash || (isFailure && !isRecentFailure)) {
            if (isMounted) setLoadingRecs(true);
            const targets = { ...currentUser.daily_targets };

            // Fetch past 3 days context
            const pastDate = new Date(start);
            pastDate.setDate(pastDate.getDate() - 3);
            const pastStartIso = pastDate.toISOString();
            const [pastMeals, pastWorkouts] = await Promise.all([
                getLogicalDayMeals(pastStartIso, start),
                getLogicalDayWorkouts(pastStartIso, start)
            ]);
            const pastMealsTotal = (pastMeals || []).reduce((sum, m) => sum + (m.calories || 0), 0);
            const pastContextStr = `Past 3 days logged ${(pastMeals || []).length} meals (approx ${Math.round(pastMealsTotal)} kcal total) and ${(pastWorkouts || []).length} workouts.`;

            const recs = await generateDailyRecommendations(logs, workouts, targets, currentUser.goal, pastContextStr);'''
)

with open(path_index, 'w', encoding='utf-8') as f:
    f.write(text_index)
