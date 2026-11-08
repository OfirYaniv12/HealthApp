import os
path = 'app/(drawer)/my-recipes.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix ImagePicker base64
text = text.replace(
    'let result = await ImagePicker.launchImageLibraryAsync({\n            mediaTypes: ImagePicker.MediaTypeOptions.Images,\n            allowsEditing: true,\n            aspect: [4, 3],\n            quality: 0.5,\n        });',
    'let result = await ImagePicker.launchImageLibraryAsync({\n            mediaTypes: ImagePicker.MediaTypeOptions.Images,\n            allowsEditing: true,\n            aspect: [4, 3],\n            quality: 0.5,\n            base64: true\n        });'
)

text = text.replace(
    'if (!result.canceled && result.assets && result.assets.length > 0) {\n            const newImageUri = result.assets[0].uri;\n            await updateRecipeImage(recipe.id!, newImageUri);',
    'if (!result.canceled && result.assets && result.assets.length > 0) {\n            const newImageUri = result.assets[0].base64 ? data:image/jpeg;base64, + result.assets[0].base64 : result.assets[0].uri;\n            await updateRecipeImage(recipe.id!, newImageUri);'
)

# Fix Editable Title in cardHeaderCenter
text = text.replace(
    '<View style={styles.cardHeaderCenter}>\n                                            <Text style={styles.cardTitle}>{recipe.name}</Text>',
    '''<View style={styles.cardHeaderCenter}>
                                            {isEditing ? (
                                                <TextInput 
                                                    style={[styles.cardTitle, { borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 2 }]} 
                                                    value={editForm.name} 
                                                    onChangeText={(t) => setEditForm(prev => ({ ...prev, name: t }))}
                                                />
                                            ) : (
                                                <Text style={styles.cardTitle}>{recipe.name}</Text>
                                            )}'''
)

# Hide Generate AI Image button
text = text.replace(
    '<TouchableOpacity style={styles.menuItem} onPress={() => handleGenerateImage(recipe)}>\n                                                        <Ionicons name="color-wand-outline" size={20} color="#3b82f6" />\n                                                        <Text style={styles.menuItemText}>צור תמונה בעזרת AI</Text>\n                                                    </TouchableOpacity>',
    '''{!recipe.image_uri && (
                                                    <TouchableOpacity style={styles.menuItem} onPress={() => handleGenerateImage(recipe)}>
                                                        <Ionicons name="color-wand-outline" size={20} color="#3b82f6" />
                                                        <Text style={styles.menuItemText}>צור תמונה בעזרת AI</Text>
                                                    </TouchableOpacity>
                                                )}'''
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
