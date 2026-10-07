const fs = require('fs');
let code = fs.readFileSync('app/select-workout.tsx', 'utf-8');

const regex = /const handleSelectForLog = \(template: WorkoutTemplate\) => \{[\s\S]*?setDurationModalVisible\(true\);\n\s*\};/;

const newLogic = `const handleSelectForLog = (template: WorkoutTemplate) => {
        let reqTime = true;
        let preDur = '';
        try {
            if (template.description && template.description.startsWith('{')) {
                const md = JSON.parse(template.description);
                if (md.requireTimeOnLog === false) {
                    reqTime = false;
                    preDur = md.presetDuration;
                }
            }
        } catch(e){}

        if (!reqTime) {
            executeLogWorkout(preDur || '30', template, '');
        } else {
            setSelectedTemplateForLog(template);
            setDurationInput('');
            setNotesInput('');
            setDurationModalVisible(true);
        }
    };`;

code = code.replace(regex, newLogic);
fs.writeFileSync('app/select-workout.tsx', code, 'utf-8');
