import { isAuthed } from "./_auth.js";

/* TTS for Studio takes — renders the scripted "visitor" lines as audio that
   the take engine plays into the call as the microphone. OpenAI TTS behind a
   server-side key (OPENAI_API_KEY, used only for this); GET probes
   availability so the Studio step can show setup guidance instead of a
   mid-take failure. */

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
    res.status(200).json({
      available: !!process.env.OPENAI_API_KEY,
      voice: process.env.STUDIO_TTS_VOICE || "alloy",
    });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "GET or POST only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
  if (!process.env.OPENAI_API_KEY) {
    res.status(501).json({ error: "TTS isn't set up — add OPENAI_API_KEY to the Vercel project env (Studio visitor lines only)." });
    return;
  }

  const text = String(req.body?.text ?? "").trim().slice(0, 600);
  if (!text) { res.status(400).json({ error: "Nothing to say — text is required." }); return; }

  try {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.STUDIO_TTS_MODEL || "gpt-4o-mini-tts",
        voice: process.env.STUDIO_TTS_VOICE || "alloy",
        input: text,
        response_format: "mp3",
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      res.status(502).json({ error: `TTS provider: ${r.status} ${detail.slice(0, 200)}` });
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
