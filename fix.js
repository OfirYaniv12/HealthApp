const fs = require('fs');

// 1. Fix edit-profile.tsx
let ep = fs.readFileSync('app/(drawer)/edit-profile.tsx', 'utf8');
ep = ep.replace(/Alert\.alert\('שגיאה', 'אנא מלא\/י את כל השדות החסרים\.'\);/g, "setErrorMsg('אנא מלאו את כל השדות החובה.'); return;");
ep = ep.replace(/Alert\.alert\('שגיאה', 'אנא בחר\/י קצב התקדמות ליעד שלך\.'\);/g, "setErrorMsg('אנא בחרו קצב התקדמות ליעד שלך.'); return;");
ep = ep.replace(/Alert\.alert\('קלט לא תקין', 'גיל, גובה ומשקל חייבים להיות מספרים תקינים\.'\);/g, "setErrorMsg('גיל, גובה ומשקל חייבים להיות מספרים תקינים.'); return;");
ep = ep.replace(/Alert\.alert\(\s*'ביטול שינויים',\s*'האם אתה בטוח שברצונך לבטל את השינויים\?',\s*\[[\s\S]*?\]\s*\);/g, "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח שברצונך לצאת ללא שמירת השינויים?')) { router.push('/(drawer)' as any); } } else { Alert.alert('ביטול שינויים', 'האם אתה בטוח שברצונך לצאת מבלי לשמור את השינויים?', [{ text: 'ביטול', style: 'cancel' }, { text: 'כן, צא', style: 'destructive', onPress: () => router.push('/(drawer)' as any) }]); }");
ep = ep.replace(/Alert\.alert\('בהצלחה', 'הנתונים שלך עודכנו ושמורים במערכת\.', \[\s*\{\s*text: 'חזרה לראשי',\s*onPress: \(\) => router\.push\('\/\(drawer\)' as any\)\s*\}\s*\]\);/g, "if (Platform.OS === 'web') { if (window.confirm('הפרופיל עודכן בהצלחה! לחץ אישור למעבר לדף הבית, או ביטול כדי להמשיך לבצע שינויים.')) { router.push('/(drawer)' as any); } } else { Alert.alert('בהצלחה', 'הפרופיל עודכן בהצלחה.', [{ text: 'הישאר בעמוד', style: 'cancel' }, { text: 'מעבר לדף הבית', onPress: () => router.push('/(drawer)' as any) }]); }");
if (!ep.includes('errorMsg ?')) {
  ep = ep.replace('<TouchableOpacity\n                        style={[styles.submitButton, isGenerating && { opacity: 0.7 }]}', '{errorMsg ? <Text style={{ color: \'#ef4444\', textAlign: \'center\', marginBottom: 12, fontSize: 16, fontWeight: \'bold\' }}>{errorMsg}</Text> : null}\n                    <TouchableOpacity\n                        style={[styles.submitButton, isGenerating && { opacity: 0.7 }]}');
}
fs.writeFileSync('app/(drawer)/edit-profile.tsx', ep);

// 2. Fix add-meal.tsx
let am = fs.readFileSync('app/add-meal.tsx', 'utf8');
am = am.replace(/Alert\.alert\('עודכן בהצלחה!', 'הארוחה נשמרה ביומן היומי שלך\.', \[\s*\{\s*text: 'המשך להתכתב',\s*style: 'cancel'\s*\},\s*\{\s*text: 'מעבר ליומן ארוחות',\s*onPress: \(\) => router\.replace\('\/daily-log'\)\s*\}\s*\]\);/g, "if (Platform.OS === 'web') { if (window.confirm('הארוחה נשמרה בהצלחה! לחץ אישור למעבר ליומן ארוחות, או ביטול כדי להמשיך להתכתב.')) { router.replace('/daily-log'); } } else { Alert.alert('עודכן בהצלחה!', 'הארוחה נשמרה ביומן היומי שלך.', [{ text: 'המשך להתכתב', style: 'cancel' }, { text: 'מעבר ליומן ארוחות', onPress: () => router.replace('/daily-log') }]); }");
fs.writeFileSync('app/add-meal.tsx', am);

// 3. Fix daily-log.tsx delete meal
let dl = fs.readFileSync('app/daily-log.tsx', 'utf8');
dl = dl.replace(/Alert\.alert\('מחיקת ארוחה', 'האם אתה בטוח שברצונך למחוק ארוחה זו\?', \[\s*\{\s*text: 'ביטול',\s*style: 'cancel'\s*\},\s*\{\s*text: 'מחק',\s*style: 'destructive',\s*onPress: async \(\) => \{[\s\S]*?\}\s*\}\s*\]\);/g, 
"const deleteAction = async () => {\n    setMeals(prev => prev.filter(m => m.id !== id));\n    try {\n        await deleteMeal(id);\n        await loadLogs();\n        triggerScoreExplanationUpdate();\n    } catch (e) {\n        console.error('Failed to delete meal', e);\n        if (Platform.OS === 'web') { window.alert('שגיאה: לא ניתן למחוק את הארוחה.'); } else { Alert.alert('שגיאה', 'לא ניתן למחוק את הארוחה.'); }\n        await loadLogs();\n    }\n};\n\nif (Platform.OS === 'web') {\n    if (window.confirm('האם אתה בטוח שברצונך למחוק ארוחה זו?')) {\n        deleteAction();\n    }\n} else {\n    Alert.alert('מחיקת ארוחה', 'האם אתה בטוח שברצונך למחוק ארוחה זו?', [\n        { text: 'ביטול', style: 'cancel' },\n        { text: 'מחק', style: 'destructive', onPress: deleteAction }\n    ]);\n}");
fs.writeFileSync('app/daily-log.tsx', dl);
console.log('DONE');
