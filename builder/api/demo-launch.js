import { kvAvailable, kvGet, kvIncr } from "./_kv.js";

/* Public endpoint: a visitor on /d/{slug} presses Start. We create a fresh
   Tavus conversation server-side with the team's TAVUS_API_KEY — visitors
   never need any credentials. Lightly rate-limited per demo per hour. */

const LAUNCHES_PER_HOUR = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const slug = String(req.body?.slug ?? "");
  if (!/^[A-Za-z0-9_-]{6,24}$/.test(slug)) { res.status(400).json({ error: "Bad demo link." }); return; }
  if (!kvAvailable()) { res.status(500).json({ error: "Demo-link storage isn't set up on the server." }); return; }
  if (!process.env.TAVUS_API_KEY) {
    res.status(500).json({ error: "TAVUS_API_KEY is not set on the server — shared demo links need it to start conversations. Add it in the Vercel project's environment variables." });
    return;
  }

  try {
    const demo = await kvGet(`demo:${slug}`);
    if (!demo?.payload) { res.status(404).json({ error: "This demo link doesn't exist." }); return; }

    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const launches = await kvIncr(`rl:${slug}:${hourBucket}`, 3700);
    if (launches > LAUNCHES_PER_HOUR) {
      res.status(429).json({ error: "This demo is getting a lot of traffic — try again in a little while." });
      return;
    }

    const r = await fetch("https://tavusapi.com/v2/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.TAVUS_API_KEY },
      body: JSON.stringify(demo.payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(502).json({ error: `Tavus: ${data.message || data.error || r.status}` });
      return;
    }
    res.status(200).json({
      conversation_url: data.conversation_url,
      conversation_id: data.conversation_id,
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "launch failed" });
  }
}
