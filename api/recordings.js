import { isAuthed } from "./_auth.js";
import { kvAvailable, kvMget } from "./_kv.js";

/* Builder-session endpoint: GET ?ids=c123,c456 → { c123: {uri, ...}, ... }
   Returns the recording locations captured by /api/recording-hook so the
   Calls & Data step can show them inline. */

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
  if (!kvAvailable()) { res.status(200).json({}); return; }

  const ids = String(req.query?.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9]{6,64}$/i.test(s))
    .slice(0, 100);
  if (!ids.length) { res.status(200).json({}); return; }

  try {
    const vals = await kvMget(ids.map((id) => `rec:${id}`));
    const out = {};
    ids.forEach((id, i) => {
      if (vals[i] != null) {
        try { out[id] = JSON.parse(vals[i]); } catch { /* skip bad entry */ }
      }
    });
    res.status(200).json(out);
  } catch (e) {
    res.status(502).json({ error: e.message || "lookup failed" });
  }
}
