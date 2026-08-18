import { isAuthed } from "./_auth.js";

/* Dictation via the Wispr Flow REST API — the builder's 🎙 buttons record
   mic audio, the frontend encodes it as 16kHz mono WAV, and this proxy
   forwards it with the server-held key (the key never reaches the browser).
   Falls back to the browser's built-in speech recognition when the key is
   absent (GET probes availability).

   Env:
   - WISPR_API_KEY  (required for Wispr dictation; get one at platform.wisprflow.ai)
   - WISPR_API_URL  (optional — override if Wispr's docs give a different
                     endpoint than the default below)

   Note: Vercel caps request bodies well under Wispr's 25MB limit, so the
   frontend hard-caps recordings (~75s) to keep payloads comfortably small. */

const API_URL = process.env.WISPR_API_URL || "https://api.wisprflow.ai/api";

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
    res.status(200).json({ available: !!process.env.WISPR_API_KEY, provider: "wisprflow" });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "GET or POST only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
  if (!process.env.WISPR_API_KEY) {
    res.status(501).json({ error: "Wispr Flow isn't set up — add WISPR_API_KEY to the Vercel project env (platform.wisprflow.ai issues keys)." });
    return;
  }

  const audio = req.body?.audio;
  if (typeof audio !== "string" || audio.length < 1000) { res.status(400).json({ error: "No audio — record something first." }); return; }
  if (audio.length > 6_000_000) { res.status(413).json({ error: "That recording is too long — keep dictations under about a minute." }); return; }
  const language = typeof req.body?.language === "string" ? req.body.language.slice(0, 8) : "";

  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WISPR_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        audio,
        ...(language ? { language: [language] } : {}),
        context: {
          app: { name: "tavus-experience-builder", type: "browser" },
          textbox_contents: { before_text: "", selected_text: "", after_text: "" },
        },
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const detail = j ? JSON.stringify(j).slice(0, 300) : String(r.status);
      res.status(502).json({ error: `Wispr Flow: ${r.status} ${detail} — if the endpoint moved, set WISPR_API_URL to the URL in their docs.` });
      return;
    }
    res.status(200).json({ text: String(j?.text ?? "").trim() });
  } catch (e) {
    res.status(502).json({ error: e.message || "Dictation failed" });
  }
}
