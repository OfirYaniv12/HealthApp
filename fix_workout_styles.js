const fs = require('fs');
let code = fs.readFileSync('components/WorkoutForm.tsx', 'utf-8');

const regex = /modalTitle: \{ fontSize: 22, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' \},/;
code = code.replace(regex, `modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' },
    tabBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 6, gap: 6 },
    tabBtnActive: { backgroundColor: '#3b82f6' },
    tabBtnText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
    tabBtnTextActive: { color: '#fff' },`);

fs.writeFileSync('components/WorkoutForm.tsx', code, 'utf-8');
