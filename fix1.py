import os
for root, dirs, files in os.walk('app'):
    for file in files:
        if file.endswith('.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if 'keyboardType="numeric"' in content:
                content = content.replace('keyboardType="numeric"', 'keyboardType="decimal-pad"')
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
