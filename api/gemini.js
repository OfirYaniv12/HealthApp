/**
 * Server-side proxy for Gemini (runs as a Vercel serverless function at /api/gemini).
 *
 * The Gemini API key lives only on the server (env var GEMINI_API_KEY) and is never
 * sent to the browser. Only logged-in users of the app (valid Supabase session) can use it.
 */
const { GoogleGenAI } = require('@google/genai');

const ALLOWED_MODELS = new Set([
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
]);

const MAX_BODY_CHARS = 4 * 1024 * 1024; // keeps us under Vercel's 4.5MB request limit

let aiClient = null;
const getClient = () => {
    if (!aiClient) aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    return aiClient;
};

const verifyUser = async (authHeader) => {
    const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return false;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return false;
    try {
        const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
        });
        return r.ok;
    } catch (e) {
        return false;
    }
};

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
        return;
    }
    if (!(await verifyUser(req.headers.authorization))) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        if (body.length > MAX_BODY_CHARS) {
            res.status(413).json({ error: 'Request too large' });
            return;
        }
        try { body = JSON.parse(body); } catch (e) { body = null; }
    }
    if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid body' });
        return;
    }

    const { model, contents, config } = body;
    if (!ALLOWED_MODELS.has(model)) {
        res.status(400).json({ error: 'Model not allowed' });
        return;
    }

    try {
        const result = await getClient().models.generateContent({ model, contents, config });
        res.status(200).json({ text: result.text || '' });
    } catch (e) {
        // Pass the upstream status through so the app can fall back to the next model on 429/503/404
        const status = Number(e && e.status) || (/\b(429|503|404)\b/.exec(String(e && e.message)) || [])[1] || 500;
        res.status(Number(status)).json({ error: String((e && e.message) || e).slice(0, 500) });
    }
};
