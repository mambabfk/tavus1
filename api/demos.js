import crypto from "node:crypto";
import { isAuthed } from "./_auth.js";
import { kvAvailable, kvGet, kvSet } from "./_kv.js";

/* Shareable demo links.
   POST (builder session required): store an immutable snapshot of a demo
     { name?, site, controls, payload } → { slug }
   GET ?slug=… (public — the link is the credential): the snapshot, for the
     visitor demo page. Never contains API keys. */

const NO_KV_MSG =
  "Demo-link storage isn't set up. In Vercel: Storage → Create Database → Upstash Redis (attach to this project), then redeploy.";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const slug = String(req.query?.slug ?? "");
    if (!/^[A-Za-z0-9_-]{6,24}$/.test(slug)) {
      res.status(400).json({ error: "Bad demo link." });
      return;
    }
    if (!kvAvailable()) { res.status(500).json({ error: NO_KV_MSG }); return; }
    try {
      const demo = await kvGet(`demo:${slug}`);
      if (!demo) { res.status(404).json({ error: "This demo link doesn't exist (or was created before storage was set up)." }); return; }
      const { payload, ...pub } = demo; // visitors don't need the raw Tavus payload
      res.status(200).json(pub);
    } catch (e) {
      res.status(502).json({ error: `Storage: ${e.message}` });
    }
    return;
  }

  if (req.method !== "POST") { res.status(405).json({ error: "GET or POST only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in — enter the access code first." }); return; }
  if (!kvAvailable()) { res.status(500).json({ error: NO_KV_MSG }); return; }

  const { name = "", site = {}, controls = {}, payload = null } = req.body ?? {};
  if (!payload?.pal_id || !payload?.face_id) {
    res.status(400).json({ error: "The demo needs a PAL ID and Face ID before it can be shared." });
    return;
  }
  const size = JSON.stringify({ site, controls, payload }).length;
  if (size > 400_000) {
    res.status(413).json({ error: "This demo config is too large to share — try a smaller logo image." });
    return;
  }

  try {
    const slug = crypto.randomBytes(6).toString("base64url");
    await kvSet(`demo:${slug}`, {
      v: 1,
      name: String(name).slice(0, 120),
      createdAt: new Date().toISOString(),
      site,
      controls,
      payload,
    });
    res.status(200).json({ slug });
  } catch (e) {
    res.status(502).json({ error: `Storage: ${e.message}` });
  }
}
