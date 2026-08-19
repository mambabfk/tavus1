import { isAuthed } from "./_auth.js";

/* TTS for Studio takes — renders the scripted "visitor" lines as audio that
   the take engine plays into the call as the microphone. Cartesia (Sonic)
   behind a server-side key — the same voice stack Tavus uses, so takes sound
   native. GET probes availability so the Studio step can show setup guidance
   instead of a mid-take failure.

   Env:
   - CARTESIA_API_KEY   (required)
   - CARTESIA_VOICE_ID  (optional — defaults to the first voice on the account)
   - CARTESIA_MODEL     (optional — default "sonic-2")
   - CARTESIA_VERSION   (optional — Cartesia-Version header, default "2024-11-13") */

const API_BASE = "https://api.cartesia.ai";
const headers = () => ({
  "X-API-Key": process.env.CARTESIA_API_KEY,
  "Cartesia-Version": process.env.CARTESIA_VERSION || "2024-11-13",
  "Content-Type": "application/json",
});

/* Default voice: first voice on the account, resolved once per warm function.
   Set CARTESIA_VOICE_ID to pin one (recommended once you've picked a voice). */
let cachedVoiceId = null;
async function resolveVoiceId() {
  if (process.env.CARTESIA_VOICE_ID) return process.env.CARTESIA_VOICE_ID;
  if (cachedVoiceId) return cachedVoiceId;
  const r = await fetch(`${API_BASE}/voices`, { headers: headers() });
  if (!r.ok) throw new Error(`Cartesia voices: ${r.status}`);
  const j = await r.json().catch(() => null);
  const list = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
  const id = list[0]?.id;
  if (!id) throw new Error("No voices on this Cartesia account — set CARTESIA_VOICE_ID.");
  cachedVoiceId = id;
  return id;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
    res.status(200).json({
      available: !!process.env.CARTESIA_API_KEY,
      provider: "cartesia",
      voice: process.env.CARTESIA_VOICE_ID || "account default",
      model: process.env.CARTESIA_MODEL || "sonic-2",
    });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "GET or POST only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
  if (!process.env.CARTESIA_API_KEY) {
    res.status(501).json({ error: "TTS isn't set up — add CARTESIA_API_KEY to the Vercel project env (Studio visitor lines only; CARTESIA_VOICE_ID pins a voice)." });
    return;
  }

  // Normalize for the voice engine: strip emoji/symbols and collapse
  // stretched spellings ("Ayyyy" → "Ayy") — Cartesia can't read them.
  const text = String(req.body?.text ?? "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/([a-zA-Z])\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
  if (!text) { res.status(400).json({ error: "Nothing to say — text is required." }); return; }

  try {
    // Optional voice override — lets the Voice step audition catalog voices.
    const reqVoice = String(req.body?.voice || "").trim();
    const voiceId = /^[\w-]{8,64}$/.test(reqVoice) ? reqVoice : await resolveVoiceId();
    const lang = String(req.body?.language || "").trim().toLowerCase().slice(0, 2);
    const r = await fetch(`${API_BASE}/tts/bytes`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model_id: process.env.CARTESIA_MODEL || "sonic-2",
        transcript: text,
        voice: { mode: "id", id: voiceId },
        ...(/^[a-z]{2}$/.test(lang) ? { language: lang } : {}),
        output_format: { container: "mp3", bit_rate: 128000, sample_rate: 44100 },
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      res.status(502).json({ error: `Cartesia: ${r.status} ${detail.slice(0, 300)}` });
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).json({ error: e.message || "TTS failed" });
  }
}
