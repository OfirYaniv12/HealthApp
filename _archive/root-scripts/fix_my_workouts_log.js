const fs = require('fs');
let code = fs.readFileSync('app/(drawer)/my-workouts.tsx', 'utf-8');

const oldHandleLog = code.substring(
    code.indexOf('const handleLogWorkout = async () => {'),
    code.indexOf('};', code.indexOf('setIsGenerating(false);')) + 2
);

const newHandleLog = `const executeLogWorkout = async (durStr: string, template: WorkoutTemplate) => {
        setIsGenerating(true);
        try {
            const dur = parseInt(durStr);
            const exercisesJson = template.exercises || '[]';
            
            const metrics = {
                weight: user?.weight || 74,
                height: user?.height || 175,
                age: user?.age || 30,
                gender: user?.gender || 'זכר',
                goal: user?.goal
            };

            const dynamicResult = await estimateWorkoutCaloriesDynamic(metrics as any, dur, exercisesJson);
            let calBurned = 0;
            let aiSummary = '';

            if (dynamicResult) {
                calBurned = dynamicResult.calories_burned;
                aiSummary = dynamicResult.summary;
            } else {
                calBurned = Math.round(8 * metrics.weight * (dur / 60)); 
            }

            await addWorkout({
                name: template.name,
                duration_minutes: dur,
                calories_burned: calBurned,
                exercises: template.exercises,
                timestamp: new Date().toISOString()
            });

            await updateWorkoutTemplateLastPerformed(template.id!, new Date().toISOString());
            triggerScoreExplanationUpdate();

            setLogModalVisible(false);
            setLogDuration('');
            loadData();

            if (aiSummary) {
                Alert.alert('אימון נרשם בהצלחה!', \`שרפת כ-\${calBurned} קלוריות.\\n\\n\${aiSummary}\`);
            } else {
                Alert.alert('אימון נרשם בהצלחה!', \`שרפת כ-\${calBurned} קלוריות.\`);
            }
        } catch (e) {
            Alert.alert('שגיאה', 'אירעה שגיאה. נסה שוב.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLogWorkout = async () => {
        if (!logDuration || !logTemplate) { Alert.alert('שגיאה', 'הזן משך אימון'); return; }
        await executeLogWorkout(logDuration, logTemplate);
    };`;

code = code.replace(oldHandleLog, newHandleLog);
fs.writeFileSync('app/(drawer)/my-workouts.tsx', code, 'utf-8');
