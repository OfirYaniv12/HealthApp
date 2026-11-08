const fs = require('fs');
let code = fs.readFileSync('app/(drawer)/my-workouts.tsx', 'utf-8');

const quickLogRegex = /<TouchableOpacity style=\{\[styles\.actionBtnPrimary, \{ flex: 1, justifyContent: 'center' \}\]\} onPress=\{\(\) => \{ setLogTemplate\(item\); setLogModalVisible\(true\); \}\}>/;

const newQuickLog = `<TouchableOpacity style={[styles.actionBtnPrimary, { flex: 1, justifyContent: 'center' }]} onPress={() => { 
                                let reqTime = true;
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
                                    setLogModalVisible(true); 
                                }
                            }}>`;

code = code.replace(quickLogRegex, newQuickLog);
fs.writeFileSync('app/(drawer)/my-workouts.tsx', code, 'utf-8');
