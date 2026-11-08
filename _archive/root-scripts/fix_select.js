const fs = require('fs');

let code = fs.readFileSync('app/select-workout.tsx', 'utf-8');

const newExec = `const executeLogWorkout = async (durStr: string, template: WorkoutTemplate, customNotes?: string) => {
        setIsProcessingLog(true);
        try {
            const dur = parseInt(durStr) || 30;
            const aiEstimation = await estimateTemplateWorkout(
                user!,
                template.name,
                template.exercises || template.description,
                customNotes || null,
                dur
            );

            let calBurned = 0;
            let aiSummary = '';

            if (aiEstimation) {
                calBurned = aiEstimation.calories_burned;
                aiSummary = aiEstimation.summary;
            } else {
                calBurned = Math.round(8 * (user?.weight || 74) * (dur / 60)); 
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

const start = code.indexOf('const executeLogWorkout = async');
const end = code.indexOf('};', code.indexOf('await executeLogWorkout(')) + 2;

code = code.substring(0, start) + newExec + code.substring(end);

fs.writeFileSync('app/select-workout.tsx', code, 'utf-8');
