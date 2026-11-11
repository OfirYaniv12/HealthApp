/**
 * Receives hourly steps from the iPhone "Shortcuts" automation (POST /api/steps).
 *
 * Body (JSON or form):
 *   key:  the user's personal steps key (copied from Settings in the app)
 *   data: one line per hour, "<ISO date>=<steps>", e.g.
 *         2026-11-11T21:00:00+02:00=840
 *         2026-11-11T22:00:00+02:00=310
 * Also accepted: data as an array of { start, steps }.
 *
 * The key can only write steps for its owner (checked inside the database function submit_steps).
 * Responses are short Hebrew texts, because the Shortcuts app shows them when run manually.
 */

const parseLines = (data) => {
    if (Array.isArray(data)) return data.map(d => ({ start: String(d.start || ''), steps: Number(d.steps) }));
    return String(data || '')
        .split(/[\r\n]+/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            // "<date>=<steps>" (also tolerates ";" or "|" or a tab as the separator, and a unit after the
            // number such as "840 steps" / "840 count", in case the shortcut sends the whole sample)
            const m = line.match(/^(.+?)\s*[=;|\t]\s*([\d.,]+)(?:\s*[^\d\s].*)?\s*$/);
            if (!m) return null;
            return { start: m[1].trim(), steps: Math.round(parseFloat(m[2].replace(',', '.'))) };
        })
        .filter(x => x && x.start && isFinite(x.steps));
};

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, message: 'יש לשלוח בקשת POST' });
        return;
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = { data: body }; }
    }
    body = body || {};

    const key = String(body.key || req.headers['x-steps-key'] || '').trim();
    const hours = parseLines(body.data ?? body.hours);

    if (!key) {
        res.status(401).json({ ok: false, message: 'חסר מפתח צעדים. העתק אותו מההגדרות באפליקציה.' });
        return;
    }
    if (hours.length === 0) {
        res.status(400).json({ ok: false, message: 'לא התקבלו נתוני צעדים. בדוק את הקיצור לפי המדריך.' });
        return;
    }
    if (hours.length > 400) hours.length = 400; // more than enough for 7 days of hours

    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        res.status(500).json({ ok: false, message: 'השרת לא מוגדר (Supabase).' });
        return;
    }

    try {
        const r = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_steps`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_token: key, p_hours: hours }),
        });
        const text = await r.text();
        if (!r.ok) {
            const invalidKey = /invalid steps key/i.test(text);
            res.status(invalidKey ? 401 : 500).json({
                ok: false,
                message: invalidKey ? 'מפתח הצעדים לא תקין. העתק אותו מחדש מההגדרות באפליקציה.' : 'שמירת הצעדים נכשלה. נסה שוב מאוחר יותר.',
            });
            return;
        }
        const saved = Number(text) || 0;
        const total = hours.reduce((a, h) => a + (h.steps || 0), 0);
        res.status(200).json({ ok: true, saved, message: `✓ הצעדים עודכנו (${saved} שעות, ${total.toLocaleString('he-IL')} צעדים)` });
    } catch (e) {
        res.status(500).json({ ok: false, message: 'שמירת הצעדים נכשלה. נסה שוב מאוחר יותר.' });
    }
};
