const fs = require('fs');

// 1. add-workout.tsx
let aw = fs.readFileSync('app/add-workout.tsx', 'utf8');
aw = aw.replace(
    /Alert\.alert\('נשמר בהצלחה!', 'האימון נוסף ליומן שלך\.', \[\s*\{\s*text: 'המשך באימון',\s*style: 'cancel'\s*\},\s*\{\s*text: 'מעבר ליומן היסטוריה',\s*onPress: \(\) => router\.replace\('\/workout-history'\)\s*\}\s*\]\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האימון נשמר בהצלחה! לחץ אישור למעבר להיסטוריה, או ביטול כדי להמשיך באימון.')) { router.replace('/workout-history'); } } else { Alert.alert('נשמר בהצלחה!', 'האימון נוסף ליומן שלך.', [{ text: 'המשך באימון', style: 'cancel' }, { text: 'מעבר ליומן היסטוריה', onPress: () => router.replace('/workout-history') }]); }"
);
fs.writeFileSync('app/add-workout.tsx', aw);

// 2. my-recipes.tsx (delete recipe alert)
let mr = fs.readFileSync('app/(drawer)/my-recipes.tsx', 'utf8');
mr = mr.replace(
    /Alert\.alert\(\s*'מחיקת מתכון',\s*'האם אתה בטוח שברצונך למחוק מתכון זה\?',\s*\[\s*\{\s*text: 'ביטול',\s*style: 'cancel'\s*\},\s*\{\s*text: 'מחק',\s*style: 'destructive',\s*onPress: \(\) => executeDelete\(recipeId\)\s*\}\s*\]\s*\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח שברצונך למחוק מתכון זה?')) { executeDelete(recipeId); } } else { Alert.alert('מחיקת מתכון', 'האם אתה בטוח שברצונך למחוק מתכון זה?', [{ text: 'ביטול', style: 'cancel' }, { text: 'מחק', style: 'destructive', onPress: () => executeDelete(recipeId) }]); }"
);
fs.writeFileSync('app/(drawer)/my-recipes.tsx', mr);

// 3. my-workouts.tsx (delete workout template alert)
let mw = fs.readFileSync('app/(drawer)/my-workouts.tsx', 'utf8');
mw = mw.replace(
    /Alert\.alert\(\s*'מחיקת אימון',\s*'האם אתה בטוח שברצונך למחוק אימון זה\?',\s*\[\s*\{\s*text: 'ביטול',\s*style: 'cancel'\s*\},\s*\{\s*text: 'מחק',\s*style: 'destructive',\s*onPress: \(\) => executeDelete\(id\)\s*\}\s*\]\s*\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח שברצונך למחוק אימון זה?')) { executeDelete(id); } } else { Alert.alert('מחיקת אימון', 'האם אתה בטוח שברצונך למחוק אימון זה?', [{ text: 'ביטול', style: 'cancel' }, { text: 'מחק', style: 'destructive', onPress: () => executeDelete(id) }]); }"
);
fs.writeFileSync('app/(drawer)/my-workouts.tsx', mw);

// 4. settings.tsx (clear all data alert)
let st = fs.readFileSync('app/(drawer)/settings.tsx', 'utf8');
st = st.replace(
    /Alert\.alert\(\s*'מחיקת כל הנתונים',\s*'האם אתה בטוח\? פעולה זו תמחק את כל היסטוריית הארוחות והאימונים שלך לצמיתות ולא ניתן לשחזר אותה\.',\s*\[\s*\{\s*text: 'ביטול',\s*style: 'cancel'\s*\},\s*\{\s*text: 'כן, מחק הכל',\s*style: 'destructive',\s*onPress: executeClearData\s*\}\s*\]\s*\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח? פעולה זו תמחק את כל היסטוריית הארוחות והאימונים שלך לצמיתות ולא ניתן לשחזר אותה.')) { executeClearData(); } } else { Alert.alert('מחיקת כל הנתונים', 'האם אתה בטוח? פעולה זו תמחק את כל היסטוריית הארוחות והאימונים שלך לצמיתות ולא ניתן לשחזר אותה.', [{ text: 'ביטול', style: 'cancel' }, { text: 'כן, מחק הכל', style: 'destructive', onPress: executeClearData }]); }"
);
fs.writeFileSync('app/(drawer)/settings.tsx', st);

// 5. workout-history.tsx (delete workout log alert)
let wh = fs.readFileSync('app/(drawer)/workout-history.tsx', 'utf8');
wh = wh.replace(
    /Alert\.alert\(\s*'מחיקת אימון',\s*'האם אתה בטוח שברצונך למחוק אימון זה מההיסטוריה\?',\s*\[\s*\{\s*text: 'ביטול',\s*style: 'cancel'\s*\},\s*\{\s*text: 'מחק',\s*style: 'destructive',\s*onPress: \(\) => executeDelete\(id\)\s*\}\s*\]\s*\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח שברצונך למחוק אימון זה מההיסטוריה?')) { executeDelete(id); } } else { Alert.alert('מחיקת אימון', 'האם אתה בטוח שברצונך למחוק אימון זה מההיסטוריה?', [{ text: 'ביטול', style: 'cancel' }, { text: 'מחק', style: 'destructive', onPress: () => executeDelete(id) }]); }"
);
fs.writeFileSync('app/(drawer)/workout-history.tsx', wh);

console.log('DONE');
