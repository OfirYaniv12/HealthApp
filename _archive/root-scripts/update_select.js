const fs = require('fs');

const modifySelectWorkouts = () => {
    let code = fs.readFileSync('app/select-workout.tsx', 'utf-8');
    
    const start = code.indexOf('const handleConfirmLog');
    const end = code.indexOf('};', code.indexOf('setIsProcessingLog(false)')) + 2;
    
    if (start === -1 || end < start) {
        console.log("Could not find handleConfirmLog correctly");
        return;
    }
    
    const newExec = `const executeLogWorkout = async (durStr: string, template: WorkoutTemplate, customNotes?: string) => {
        setIsProcessingLog(true);
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

            const dynamicResult = await estimateTemplateWorkout(metrics as any, dur, exercisesJson, customNotes || undefined);
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
                timestamp: new Date().toISOString(),
                notes: customNotes || undefined
            });

            await updateWorkoutTemplateLastPerformed(template.id!, new Date().toISOString());

            setDurationModalVisible(false);
            setDurationInput('');
            setNotesInput('');
            
            setTimeout(() => {
                router.replace('/(drawer)/workout-history');
            }, 100);
            
        } catch (e) {
            Alert.alert('שגיאה', 'ארעה שגיאה בעת רישום האימון.');
        } finally {
            setIsProcessingLog(false);
        }
    };

    const handleConfirmLog = async () => {
        if (!durationInput || isNaN(Number(durationInput)) || Number(durationInput) <= 0) {
            Alert.alert('שגיאה', 'יש להזין משך זמן תקין בדקות.');
            return;
        }
        if (!user || !selectedTemplateForLog) return;
        await executeLogWorkout(durationInput, selectedTemplateForLog, notesInput.trim());
    };`;
    
    code = code.substring(0, start) + newExec + code.substring(end);

    // Update item click (it's inside handleSelectTemplate or direct onPress)
    code = code.replace(
        `        setSelectedTemplateForLog(item);
        setDurationInput('');
        setNotesInput('');
        setDurationModalVisible(true);`,
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
            setSelectedTemplateForLog(item);
            setDurationInput('');
            setNotesInput('');
            setDurationModalVisible(true);
        }`
    );

    fs.writeFileSync('app/select-workout.tsx', code, 'utf-8');
}

modifySelectWorkouts();
