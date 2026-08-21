import { kvAvailable, kvGet, kvIncr, kvLpush, kvLtrim, kvSetRaw } from "./_kv.js";

/* Public endpoint: a visitor on /d/{slug} presses Start. We create a fresh
   Tavus conversation server-side with the team's TAVUS_API_KEY — visitors
   never need any credentials. Lightly rate-limited per demo per hour. */

const LAUNCHES_PER_HOUR = 60;

/* Weave the visitor's guided-journey answers into the conversation payload.
   Answers arrive as step/option INDEXES resolved against the demo's STORED
   journey config — visitors can only select from what the builder composed
   (free text is capped and quoted). Mirrors applyJourneyPrefs in the
   frontend (builder previews) — keep the two in sync. */
function applyJourneyPrefs(payload, journeyArr, prefs) {
  if (!prefs || !Array.isArray(prefs.answers) || !Array.isArray(journeyArr)) return payload;
  const out = { ...payload };
  const lines = [];
  prefs.answers.slice(0, 12).forEach((ans) => {
    const s = journeyArr[Number(ans?.step)];
    if (!s) return;
    if (s.type === "question") {
      const opt = s.options?.[Number(ans.option)];
      if (typeof opt === "string") lines.push(`- ${s.prompt} → ${opt}`);
      // Authored per-option override — how the conversation changes when this
      // option is picked ("Label :: instructions" on the Experience step).
      const oc = Array.isArray(s.optionContext) ? String(s.optionContext[Number(ans.option)] ?? "").trim() : "";
      if (oc) lines.push(oc.slice(0, 600));
    } else if (s.type === "input") {
      const text = String(ans.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (text) lines.push(`- ${s.prompt} → "${text}"`);
    } else if (s.type === "personas") {
      const o = s.options?.[Number(ans.option)];
      if (!o) return;
      lines.push(`- Chosen experience: ${o.label}`);
      if (o.context) lines.push(String(o.context));
      if (o.greeting) {
        out.custom_greeting = String(o.greeting);
        // Keep in sync with applyJourneyPrefs in TavusExperienceBuilder.jsx:
        // the model must know its (overridden) first line.
        lines.push(`- Your first spoken line is already scripted and plays automatically: "${String(o.greeting).slice(0, 300)}" — continue naturally from it; never introduce yourself a second time.`);
      }
      if (o.palId && /^p[a-z0-9_-]{3,60}$/i.test(String(o.palId))) out.pal_id = String(o.palId);
    }
  });
  const email = String(prefs.email ?? "").trim().slice(0, 200);
  if (email) lines.push(`- Email they provided: ${email}`);
  if (lines.length) {
    const intro = "Pre-call setup from this visitor (personalize with it naturally — never recite it back as a list):";
    out.conversational_context = [out.conversational_context, `${intro}\n${lines.join("\n")}`].filter(Boolean).join("\n\n");
  }
  return out;
}

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

    const payload = applyJourneyPrefs(demo.payload, demo.experience?.journey, req.body?.prefs);

    const r = await fetch("https://tavusapi.com/v2/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.TAVUS_API_KEY },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(502).json({ error: `Tavus: ${data.message || data.error || r.status}` });
      return;
    }
    // Per-demo stats (best-effort — never blocks the launch).
    try {
      const now = new Date();
      await kvIncr(`stats:${slug}:launches`);
      await kvIncr(`stats:${slug}:d:${now.toISOString().slice(0, 10)}`, 90 * 86400);
      await kvSetRaw(`stats:${slug}:last`, now.toISOString());
      if (data.conversation_id) {
        await kvLpush(`stats:${slug}:convos`, { id: data.conversation_id, at: now.toISOString() });
        await kvLtrim(`stats:${slug}:convos`, 0, 499);
      }
    } catch { /* stats are non-critical */ }

    res.status(200).json({
      conversation_url: data.conversation_url,
      conversation_id: data.conversation_id,
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "launch failed" });
  }
}
