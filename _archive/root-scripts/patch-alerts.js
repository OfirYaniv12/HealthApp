const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') && !fullPath.includes('_layout.tsx') && !fullPath.includes('GlobalAlert.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('Alert.alert(')) {
                // Remove Alert from react-native import
                content = content.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]react-native['"]/g, (match, p1) => {
                    const imports = p1.split(',').map(s => s.trim()).filter(s => s !== 'Alert' && s !== '');
                    if (imports.length === 0) return '';
                    return "import { " + imports.join(', ') + " } from 'react-native';";
                });
                
                // Add AlertManager import
                content = "import { AlertManager as Alert } from '@/components/GlobalAlert';\n" + content;
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Patched', fullPath);
            }
        }
    }
}

processDir('app');
