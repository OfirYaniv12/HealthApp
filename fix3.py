import os

path = 'app/(drawer)/my-recipes.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace all ImagePicker calls to include base64: true
text = text.replace(
    'ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 })',
    'ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8, base64: true })'
)

text = text.replace(
    'ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 })',
    'ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8, base64: true })'
)

# Update pickImage
text = text.replace(
    'if (!result.canceled && result.assets && result.assets.length > 0) {\n            setSelectedImageUri(result.assets[0].uri);\n        }',
    'if (!result.canceled && result.assets && result.assets.length > 0) {\n            setSelectedImageUri(result.assets[0].base64 ? data:image/jpeg;base64,\ : result.assets[0].uri);\n        }'
)

# Update captureOrPickImage
text = text.replace(
    'if (!result.canceled && result.assets && result.assets.length > 0) {\n            await updateRecipeImage(id, result.assets[0].uri);\n            loadData();\n        }',
    'if (!result.canceled && result.assets && result.assets.length > 0) {\n            await updateRecipeImage(id, result.assets[0].base64 ? data:image/jpeg;base64,\ : result.assets[0].uri);\n            loadData();\n        }'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
