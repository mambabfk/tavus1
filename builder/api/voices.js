import { isAuthed } from "./_auth.js";

/* Voice search: proxies Cartesia's voice catalog (server-side key) so the
   Voice step can find voices by accent/language/vibe. The chosen voice id is
   applied to the PAL via layers.tts.external_voice_id — Tavus-hosted Cartesia
   plays its stock voices, so no per-conversation Cartesia key is needed. */

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in — enter the access code first." }); return; }
  if (!process.env.CARTESIA_API_KEY) {
    res.status(500).json({ error: "Voice search isn't set up — add CARTESIA_API_KEY in the Vercel project's environment variables and redeploy." });
    return;
  }

  try {
    const r = await fetch("https://api.cartesia.ai/voices/", {
      headers: {
        "X-API-Key": process.env.CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
      },
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      res.status(502).json({ error: `Cartesia: ${body?.error || body?.message || r.status}` });
      return;
    }
    const list = Array.isArray(body) ? body : body?.data || body?.voices || [];
    const q = String(req.query?.q ?? "").trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const voices = list
      .map((v) => ({
        id: v.id,
        name: v.name || "",
        description: v.description || "",
        language: v.language || "",
      }))
      .filter((v) => {
        if (!terms.length) return true;
        const hay = `${v.name} ${v.description} ${v.language}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 40);
    res.status(200).json({ voices, total: voices.length });
  } catch (e) {
    res.status(502).json({ error: e.message || "voice search failed" });
  }
}
