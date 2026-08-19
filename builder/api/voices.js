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

  // Cartesia tags voices with ISO language codes ("de"), not names —
  // searching "german" must match both.
  const LANG_CODES = {
    english: "en", german: "de", french: "fr", spanish: "es", portuguese: "pt",
    italian: "it", dutch: "nl", polish: "pl", swedish: "sv", norwegian: "no",
    danish: "da", turkish: "tr", hindi: "hi", japanese: "ja", korean: "ko",
    chinese: "zh", mandarin: "zh", russian: "ru", arabic: "ar", greek: "el",
    czech: "cs", finnish: "fi", ukrainian: "uk", vietnamese: "vi", thai: "th",
    indonesian: "id", hungarian: "hu", romanian: "ro", bulgarian: "bg",
  };

  try {
    // The catalog paginates on newer accounts — walk up to 5 pages so a
    // search actually covers the library, not just the first slice.
    let list = [];
    let url = "https://api.cartesia.ai/voices/?limit=100";
    for (let page = 0; page < 5; page++) {
      const r = await fetch(url, {
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
      const chunk = Array.isArray(body) ? body : body?.data || body?.voices || [];
      list = list.concat(chunk);
      const last = chunk.length ? chunk[chunk.length - 1]?.id : null;
      if (!body?.has_more || !last) break;
      url = `https://api.cartesia.ai/voices/?limit=100&starting_after=${encodeURIComponent(last)}`;
    }

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
        const lang = String(v.language || "").toLowerCase();
        return terms.every((t) => hay.includes(t) || (LANG_CODES[t] && lang.startsWith(LANG_CODES[t])));
      })
      .slice(0, 40);
    res.status(200).json({ voices, total: voices.length });
  } catch (e) {
    res.status(502).json({ error: e.message || "voice search failed" });
  }
}
