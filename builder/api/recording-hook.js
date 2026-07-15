import { kvAvailable, kvSetEx, kvIncr, kvSetRaw } from "./_kv.js";

/* Public endpoint: receives Tavus application callbacks. When recording to
   the customer's bucket is on, the builder sets the conversation's
   callback_url to this hook, so `application.recording_ready` lands here and
   the Calls & Data step can show each call's recording without anyone
   touching the AWS console.

   Only recording events are stored (90-day TTL, keyed by conversation).
   If the builder user configured their own webhook, it rides along as
   ?fwd= and every event is forwarded there — this hook never swallows
   the customer's integration. Always answers 200 so Tavus doesn't retry. */

const TTL = 90 * 86400;
const EVENTS_PER_HOUR = 5000; // abuse backstop for a public endpoint

function safeForwardUrl(raw) {
  try {
    const u = new URL(String(raw));
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || /^(\d+\.){3}\d+$/.test(host) || host.endsWith(".local") || host.endsWith(".internal")) return null;
    return u.href;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const body = req.body ?? {};
  const eventType = String(body.event_type ?? "");
  const convId = String(body.conversation_id ?? "");

  // Forward everything to the user's own webhook when one was configured.
  const fwd = safeForwardUrl(req.query?.fwd);
  if (fwd) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    // text/plain avoids a CORS-style preflight on catch-hooks (Zapier/Make).
    await fetch(fwd, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    }).catch(() => {}).finally(() => clearTimeout(t));
  }

  // Telemetry for /api/health: proves whether Tavus's callbacks reach this
  // hook at all — the usual failure is a call whose callback_url never
  // pointed here (launched before the feature, or recording off at launch).
  try {
    if (kvAvailable()) {
      await kvIncr("rechook:seen");
      await kvSetRaw("rechook:lastevent", `${eventType || "(no event_type)"} · ${convId || "?"} · ${new Date().toISOString()}`);
    }
  } catch { /* telemetry only */ }

  // Store recording events so the builder can show them next to transcripts.
  try {
    if (
      kvAvailable() &&
      /recording/i.test(eventType) &&
      /^[a-z0-9]{6,64}$/i.test(convId)
    ) {
      const n = await kvIncr(`rl:rechook:${Math.floor(Date.now() / 3_600_000)}`, 3700);
      if (n <= EVENTS_PER_HOUR) {
        const p = body.properties ?? {};
        await kvSetEx(`rec:${convId}`, {
          event: eventType,
          bucket: String(p.bucket_name ?? "").slice(0, 256),
          key: String(p.s3_key ?? "").slice(0, 600),
          uri: String(p.storage_uri ?? "").slice(0, 900),
          provider: String(p.storage_provider ?? "").slice(0, 32),
          duration: Number(p.duration) || 0,
          error: String(p.error_message ?? "").slice(0, 500),
          at: new Date().toISOString(),
        }, TTL);
        await kvIncr("rechook:stored");
        await kvSetRaw("rechook:laststored", `${convId} · ${new Date().toISOString()}`);
      }
    }
  } catch { /* storage is best-effort — never make Tavus retry */ }

  res.status(200).json({ ok: true });
}
