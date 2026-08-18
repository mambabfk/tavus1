import { isAuthed } from "./_auth.js";

/* Dictation — speech-to-text behind the builder's 🎙 buttons. Engine order:
   1. Cartesia Ink (ink-whisper) when CARTESIA_API_KEY is set — same vendor
      and key as Studio TTS, so most deployments get dictation for free.
   2. Wispr Flow when WISPR_API_KEY is set (WISPR_API_URL overrides the
      endpoint if their docs differ).
   3. Neither → 501, and the frontend falls back to the browser's built-in
      speech recognition.
   The frontend sends base64 16kHz mono WAV, hard-capped at ~75s so the
   payload stays under serverless body limits.

   Env: CARTESIA_API_KEY (+ optional CARTESIA_STT_VERSION, default
   2025-04-16 — STT postdates the 2024-11-13 version our TTS pins), or
   WISPR_API_KEY (+ optional WISPR_API_URL). */

const WISPR_URL = process.env.WISPR_API_URL || "https://api.wisprflow.ai/api";

async function cartesiaTranscribe(wavBuf) {
  const form = new FormData();
  form.append("file", new Blob([wavBuf], { type: "audio/wav" }), "dictation.wav");
  form.append("model", "ink-whisper");
  const r = await fetch("https://api.cartesia.ai/stt", {
    method: "POST",
    headers: {
      // Cartesia has accepted both header styles across versions — send both.
      "X-API-Key": process.env.CARTESIA_API_KEY,
      Authorization: `Bearer ${process.env.CARTESIA_API_KEY}`,
      "Cartesia-Version": process.env.CARTESIA_STT_VERSION || "2025-04-16",
    },
    body: form, // fetch sets the multipart boundary — never set Content-Type here
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Cartesia STT: ${r.status} ${(j && JSON.stringify(j).slice(0, 200)) || ""}`.trim());
  return String(j?.text ?? "").trim();
}

async function wisprTranscribe(b64, language) {
  const r = await fetch(WISPR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WISPR_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      audio: b64,
      ...(language ? { language: [language] } : {}),
      context: {
        app: { name: "tavus-experience-builder", type: "browser" },
        textbox_contents: { before_text: "", selected_text: "", after_text: "" },
      },
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Wispr Flow: ${r.status} ${(j && JSON.stringify(j).slice(0, 200)) || ""}`.trim());
  return String(j?.text ?? "").trim();
}

export default async function handler(req, res) {
  const provider = process.env.CARTESIA_API_KEY ? "cartesia" : process.env.WISPR_API_KEY ? "wisprflow" : null;

  if (req.method === "GET") {
    if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
    res.status(200).json({ available: !!provider, provider: provider || "" });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "GET or POST only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
  if (!provider) {
    res.status(501).json({ error: "No dictation engine configured — CARTESIA_API_KEY covers it (same key as Studio TTS)." });
    return;
  }

  const audio = req.body?.audio;
  if (typeof audio !== "string" || audio.length < 1000) { res.status(400).json({ error: "No audio — record something first." }); return; }
  if (audio.length > 6_000_000) { res.status(413).json({ error: "That recording is too long — keep dictations under about a minute." }); return; }
  const language = typeof req.body?.language === "string" ? req.body.language.slice(0, 8) : "";

  try {
    let text;
    if (provider === "cartesia") {
      try {
        text = await cartesiaTranscribe(Buffer.from(audio, "base64"));
      } catch (e) {
        // Cartesia down or STT not enabled on the account — try Wispr if present.
        if (process.env.WISPR_API_KEY) text = await wisprTranscribe(audio, language);
        else throw e;
      }
    } else {
      text = await wisprTranscribe(audio, language);
    }
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: e.message || "Dictation failed" });
  }
}
