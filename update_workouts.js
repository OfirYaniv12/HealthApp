const fs = require('fs');

const modifyMyWorkouts = () => {
    let code = fs.readFileSync('app/(drawer)/my-workouts.tsx', 'utf-8');
    
    // Update handleCreateTemplate
    code = code.replace(
        'const handleCreateTemplate = async (name: string, categoryId: number, flattenedExercises: Exercise[]) => {',
        'const handleCreateTemplate = async (name: string, categoryId: number, flattenedExercises: Exercise[], descriptionStr?: string | null) => {'
    );
    code = code.replace(
        `description: null`,
        `description: descriptionStr || null`
    );

    // Update log initiation
    code = code.replace(
        `        setLogTemplate(item);
        setLogDuration('');
        setLogModalVisible(true);`,
        `        let reqTime = true;
        let preDur = '';
        try {
            if (item.description && item.description.startsWith('{')) {
                const md = JSON.parse(item.description);
                if (md.requireTimeOnLog === false) {
                    reqTime = false;
                    preDur = md.presetDuration;
                }
            }
        } catch(e){}

        if (!reqTime) {
            setLogTemplate(item);
            setLogDuration(preDur || '30'); // Will trigger handleLogWorkout automatically if we had a direct function, but let's just do it directly.
            // Actually, we can just call handleLogWorkout explicitly if we refactor or we can set states and use a timeout.
            // Better: just set states and call a new function.
        } else {
            setLogTemplate(item);
            setLogDuration('');
            setLogModalVisible(true);
        }`
    );
    
    // Let's create an executeLogWorkout(dur, template) so we don't rely on state!
    const execRegex = /const handleLogWorkout = async \(\) => \{[\s\S]*?if \(!logDuration \|\| !logTemplate\) \{ Alert\.alert\([^)]+\); return; \}/;
    
    const newExec = `const executeLogWorkout = async (durStr: string, template: WorkoutTemplate) => {
        setIsGenerating(true);
        try {
            const dur = parseInt(durStr) || 30;
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
            Alert.alert('שגיאה', 'ארעה שגיאה בעת רישום האימון.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLogWorkout = async () => {
        if (!logDuration || !logTemplate) { Alert.alert('שגיאה', 'הזן משך אימון'); return; }
        await executeLogWorkout(logDuration, logTemplate);
    };

    // Replace the rest of handleLogWorkout with nothing because we merged it`;
    
    const fullLogRegex = /const handleLogWorkout = async \(\) => \{[\s\S]*?setIsGenerating\(false\);\n        \}\n    \};/;
    code = code.replace(fullLogRegex, newExec);

    // Now update the log initiation again with the new executeLogWorkout
    code = code.replace(
        `        let reqTime = true;
        let preDur = '';
        try {
            if (item.description && item.description.startsWith('{')) {
                const md = JSON.parse(item.description);
                if (md.requireTimeOnLog === false) {
                    reqTime = false;
                    preDur = md.presetDuration;
                }
            }
        } catch(e){}

        if (!reqTime) {
            setLogTemplate(item);
            setLogDuration(preDur || '30'); // Will trigger handleLogWorkout automatically if we had a direct function, but let's just do it directly.
            // Actually, we can just call handleLogWorkout explicitly if we refactor or we can set states and use a timeout.
            // Better: just set states and call a new function.
        } else {
            setLogTemplate(item);
            setLogDuration('');
            setLogModalVisible(true);
        }`,
        `        let reqTime = true;
        let preDur = '';
        try {
            if (item.description && item.description.startsWith('{')) {
                const md = JSON.parse(item.description);
                if (md.requireTimeOnLog === false) {
                    reqTime = false;
                    preDur = md.presetDuration;
                }
            }
        } catch(e){}

        if (!reqTime) {
            executeLogWorkout(preDur || '30', item);
        } else {
            setLogTemplate(item);
            setLogDuration('');
            setLogModalVisible(true);
        }`
    );

    fs.writeFileSync('app/(drawer)/my-workouts.tsx', code, 'utf-8');
}

modifyMyWorkouts();
