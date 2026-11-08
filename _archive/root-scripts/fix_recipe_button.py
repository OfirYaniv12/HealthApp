import os

path = 'app/(drawer)/my-recipes.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Find the block and remove it
text = text.replace(
    """            options.push({
                text: 'ייצר ב-AI', onPress: async () => {
                    if (recipe) {
                        const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(recipe.name + ' food photography high quality');
                        await updateRecipeImage(id, url);
                        loadData();
                    }
                }
            });""",
    ""
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
