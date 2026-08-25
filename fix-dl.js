const fs = require('fs');
let dl = fs.readFileSync('app/daily-log.tsx', 'utf8');

const targetAlert = /Alert\.alert\('מחיקת ארוחה', 'האם אתה בטוח שברצונך למחוק מנה זו\?', \[\s*\{\s*text: 'ביטול',\s*style: 'cancel'\s*\},\s*\{\s*text: 'מחק',\s*style: 'destructive',\s*onPress: async \(\) => \{[\s\S]*?\}\s*\}\s*\]\);/;

const replacement = if (Platform.OS === 'web') {
            if (window.confirm('האם אתה בטוח שברצונך למחוק מנה זו?')) {
                setMeals(prev => prev.filter(m => m.id !== id));
                deleteMeal(id).then(() => {
                    loadLogs();
                    triggerScoreExplanationUpdate();
                }).catch(async (e) => {
                    console.error('Failed to delete meal', e);
                    window.alert('שגיאה: לא ניתן למחוק את הארוחה.');
                    await loadLogs();
                });
            }
        } else {
            Alert.alert('מחיקת ארוחה', 'האם אתה בטוח שברצונך למחוק מנה זו?', [
                { text: 'ביטול', style: 'cancel' },
                {
                    text: 'מחק',
                    style: 'destructive',
                    onPress: async () => {
                        setMeals(prev => prev.filter(m => m.id !== id));
                        try {
                            await deleteMeal(id);
                            await loadLogs();
                            triggerScoreExplanationUpdate();
                        } catch (e) {
                            console.error('Failed to delete meal', e);
                            Alert.alert('שגיאה', 'לא ניתן למחוק את הארוחה.');
                            await loadLogs();
                        }
                    }
                }
            ]);
        };

dl = dl.replace(targetAlert, replacement);
fs.writeFileSync('app/daily-log.tsx', dl);
