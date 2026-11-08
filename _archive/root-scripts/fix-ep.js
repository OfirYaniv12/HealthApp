const fs = require('fs');

let ep = fs.readFileSync('app/(drawer)/edit-profile.tsx', 'utf8');

// 1. Back button alert
ep = ep.replace(
    /Alert\.alert\(\s*'ביטול שינויים',\s*'האם אתה בטוח שברצונך לבטל את השינויים\?',\s*\[[\s\S]*?\]\s*\);/g, 
    "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח שברצונך לצאת ללא שמירת השינויים?')) { router.push('/(drawer)' as any); } } else { Alert.alert('ביטול שינויים', 'האם אתה בטוח שברצונך לצאת מבלי לשמור את השינויים?', [{ text: 'ביטול', style: 'cancel' }, { text: 'כן, צא', style: 'destructive', onPress: () => router.push('/(drawer)' as any) }]); }"
);

// 2. Error alerts
ep = ep.replace(
    "const handleSave = async () => {\n",
    "const handleSave = async () => {\n        setErrorMsg('');\n"
);
ep = ep.replace(
    "Alert.alert('שגיאה', 'אנא מלא/י את כל השדות החסרים.');",
    "setErrorMsg('אנא מלאו את כל השדות החובה.');"
);
ep = ep.replace(
    "Alert.alert('שגיאה', 'אנא בחר/י קצב התקדמות ליעד שלך.');",
    "setErrorMsg('אנא בחרו קצב התקדמות ליעד שלך.');"
);
ep = ep.replace(
    "Alert.alert('קלט לא תקין', 'גיל, גובה ומשקל חייבים להיות מספרים תקינים.');",
    "setErrorMsg('גיל, גובה ומשקל חייבים להיות מספרים תקינים.');"
);

// 3. Save success alert
ep = ep.replace(
    /Alert\.alert\('בהצלחה', 'הנתונים שלך עודכנו ושמורים במערכת\.', \[\s*\{\s*text: 'חזרה לראשי',\s*onPress: \(\) => router\.push\('\/\(drawer\)' as any\)\s*\}\s*\]\);/g, 
    "if (Platform.OS === 'web') { if (window.confirm('הפרופיל עודכן בהצלחה! לחץ אישור למעבר לדף הבית, או ביטול כדי להמשיך לבצע שינויים.')) { router.push('/(drawer)' as any); } } else { Alert.alert('בהצלחה', 'הפרופיל עודכן בהצלחה.', [{ text: 'הישאר בעמוד', style: 'cancel' }, { text: 'מעבר לדף הבית', onPress: () => router.push('/(drawer)' as any) }]); }"
);

// 4. Add error text above submit
ep = ep.replace(
    "<TouchableOpacity\n                        style={[styles.submitButton, isGenerating && { opacity: 0.7 }]}",
    "{errorMsg ? <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 12, fontSize: 16, fontWeight: 'bold' }}>{errorMsg}</Text> : null}\n                    <TouchableOpacity\n                        style={[styles.submitButton, isGenerating && { opacity: 0.7 }]}"
);

fs.writeFileSync('app/(drawer)/edit-profile.tsx', ep);
