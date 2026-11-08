const fs = require('fs');
let ep = fs.readFileSync('app/(drawer)/edit-profile.tsx', 'utf8');
ep = ep.replace(
    /(<TouchableOpacity[\s\r\n]+style=\{\[styles\.submitButton, isGenerating && \{ opacity: 0\.7 \}\]\})/,
    "{errorMsg ? <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 12, fontSize: 16, fontWeight: 'bold' }}>{errorMsg}</Text> : null}\n                    $1"
);
fs.writeFileSync('app/(drawer)/edit-profile.tsx', ep);
