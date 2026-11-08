/**
 * Local development server for the /api functions (Vercel runs them in production).
 * Usage: npm run dev:api   (listens on http://localhost:8082)
 * Reads GEMINI_API_KEY and the Supabase settings from .env.local / .env.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.cwd());
for (const file of ['.env.local', '.env']) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
}

const handlers = { '/api/gemini': require(path.join(root, 'api', 'gemini.js')) };
const PORT = Number(process.env.DEV_API_PORT || 8082);

http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const handler = handlers[req.url.split('?')[0]];
    if (!handler) { res.writeHead(404); res.end('Not found'); return; }

    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', async () => {
        // Minimal Vercel-style req/res helpers
        try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = raw; }
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
        try { await handler(req, res); }
        catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e) })); }
    });
}).listen(PORT, () => console.log(`Dev API listening on http://localhost:${PORT}`));
