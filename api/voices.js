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

  // Accents/locales live in the voice DESCRIPTION, not the language code —
  // "es" covers both Spain and Mexico. Map locale words to the keywords
  // curated voices actually use, plus the language code they imply.
  const ACCENTS = {
    mexico: { lang: "es", kw: ["mexic"] },
    mexican: { lang: "es", kw: ["mexic"] },
    spain: { lang: "es", kw: ["spain", "castilian", "peninsular", "spaniard", "madrid"] },
    castilian: { lang: "es", kw: ["castilian", "spain"] },
    latam: { lang: "es", kw: ["latin", "mexic", "colombia", "argentin", "chile", "peru"] },
    colombian: { lang: "es", kw: ["colombia"] },
    argentinian: { lang: "es", kw: ["argentin"] },
    brazil: { lang: "pt", kw: ["brazil"] },
    brazilian: { lang: "pt", kw: ["brazil"] },
    portugal: { lang: "pt", kw: ["portug", "lisbon"] },
    british: { lang: "en", kw: ["brit", "uk", "london", "english accent"] },
    uk: { lang: "en", kw: ["brit", "uk", "london"] },
    american: { lang: "en", kw: ["american", "us "] },
    australian: { lang: "en", kw: ["australia", "aussie"] },
    indian: { lang: "en", kw: ["india"] },
    irish: { lang: "en", kw: ["irish", "ireland"] },
    scottish: { lang: "en", kw: ["scot"] },
    parisian: { lang: "fr", kw: ["paris"] },
    quebec: { lang: "fr", kw: ["quebec", "canadian"] },
  };

  // The catalog is flooded with machine-generated localized clones
  // ("189449_58930_cartesia_es", "Cartesia localized voice") — real curated
  // voices have human names and descriptions. Rank the clones last.
  const isClone = (name, desc) =>
    /cartesia localized voice/i.test(desc || "") ||
    /cartesia/i.test(name || "") ||
    /^v?[0-9a-f_]{10,}(_[a-z]{2})?$/i.test(String(name || "").trim());

  try {
    // The catalog paginates on newer accounts — walk up to 10 pages so a
    // search actually covers the library (localized clones inflate it a lot).
    let list = [];
    let url = "https://api.cartesia.ai/voices/?limit=100";
    for (let page = 0; page < 10; page++) {
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
    const scored = [];
    for (const v of list) {
      const name = v.name || "";
      const description = v.description || "";
      const language = v.language || "";
      const hay = `${name} ${description}`.toLowerCase();
      const lang = language.toLowerCase();
      let score = 0;
      let ok = true;
      for (const t of terms) {
        const acc = ACCENTS[t];
        if (acc && lang.startsWith(acc.lang) && acc.kw.some((k) => hay.includes(k))) {
          score += 4; // accent named in the description — the strongest signal
        } else if (hay.includes(t)) {
          score += 3;
        } else if (acc && lang.startsWith(acc.lang)) {
          score += 1; // right language, accent unstated — keep as weak match
        } else if (LANG_CODES[t] && lang.startsWith(LANG_CODES[t])) {
          score += 2;
        } else {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      scored.push({
        id: v.id,
        name,
        description,
        language,
        _clone: isClone(name, description) ? 1 : 0,
        _score: score,
      });
    }
    // Curated voices first, best matches first; localized clones sink.
    scored.sort((a, b) => a._clone - b._clone || b._score - a._score);
    const voices = scored.slice(0, 40).map(({ _clone, _score, ...v }) => v);
    res.status(200).json({ voices, total: voices.length });
  } catch (e) {
    res.status(502).json({ error: e.message || "voice search failed" });
  }
}
