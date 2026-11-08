import os

path = 'app/(drawer)/my-recipes.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('data:image/jpeg;base64,` :', 'data:image/jpeg;base64,${result.assets[0].base64}` :')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
