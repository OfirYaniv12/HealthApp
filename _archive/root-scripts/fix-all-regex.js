const fs = require('fs');

function replaceAlert(filePath, targetRegex, replaceStr) {
    let text = fs.readFileSync(filePath, 'utf8');
    let newText = text.replace(targetRegex, replaceStr);
    fs.writeFileSync(filePath, newText);
}

// 1. add-workout.tsx
replaceAlert('app/add-workout.tsx',
    /Alert\.alert\([^)]+style:\s*'cancel'[^)]+router\.replace\('\/workout-history'\)\s*\}\s*\]\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האימון נשמר בהצלחה! לחץ אישור למעבר להיסטוריה, או ביטול כדי להמשיך באימון.')) { router.replace('/workout-history'); } } else { Alert.alert('נשמר בהצלחה!', 'האימון נוסף ליומן שלך.', [{ text: 'המשך באימון', style: 'cancel' }, { text: 'מעבר ליומן היסטוריה', onPress: () => router.replace('/workout-history') }]); }"
);

// 2. my-recipes.tsx
replaceAlert('app/(drawer)/my-recipes.tsx',
    /Alert\.alert\([^)]+executeDelete\(recipeId\)\s*\}\s*\]\s*\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח שברצונך למחוק מתכון זה?')) { executeDelete(recipeId); } } else { Alert.alert('מחיקת מתכון', 'האם אתה בטוח שברצונך למחוק מתכון זה?', [{ text: 'ביטול', style: 'cancel' }, { text: 'מחק', style: 'destructive', onPress: () => executeDelete(recipeId) }]); }"
);

// 3. my-workouts.tsx
replaceAlert('app/(drawer)/my-workouts.tsx',
    /Alert\.alert\([^)]+deleteWorkoutTemplate\(id\)[^)]+\]\s*\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח שברצונך למחוק אימון זה?')) { deleteWorkoutTemplate(id).then(loadData); } } else { Alert.alert('מחיקת אימון', 'האם אתה בטוח שברצונך למחוק אימון זה?', [{ text: 'ביטול', style: 'cancel' }, { text: 'מחק', style: 'destructive', onPress: async () => { await deleteWorkoutTemplate(id); loadData(); } }]); }"
);

// 4. settings.tsx
replaceAlert('app/(drawer)/settings.tsx',
    /Alert\.alert\([^)]+onPress:\s*executeClearData\s*\}\s*\]\s*\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח? פעולה זו תמחק את כל היסטוריית הארוחות והאימונים שלך לצמיתות ולא ניתן לשחזר אותה.')) { executeClearData(); } } else { Alert.alert('מחיקת כל הנתונים', 'האם אתה בטוח? פעולה זו תמחק את כל היסטוריית הארוחות והאימונים שלך לצמיתות ולא ניתן לשחזר אותה.', [{ text: 'ביטול', style: 'cancel' }, { text: 'כן, מחק הכל', style: 'destructive', onPress: executeClearData }]); }"
);

// 5. workout-history.tsx
replaceAlert('app/(drawer)/workout-history.tsx',
    /Alert\.alert\([^)]+executeDelete\(id\)\s*\}\s*\]\s*\);/g,
    "if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח שברצונך למחוק אימון זה מההיסטוריה?')) { executeDelete(id); } } else { Alert.alert('מחיקת אימון', 'האם אתה בטוח שברצונך למחוק אימון זה מההיסטוריה?', [{ text: 'ביטול', style: 'cancel' }, { text: 'מחק', style: 'destructive', onPress: () => executeDelete(id) }]); }"
);

console.log('DONE');
