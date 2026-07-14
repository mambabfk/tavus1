import { isAuthed } from "./_auth.js";
import { kvAvailable, kvGet } from "./_kv.js";

/* Config diagnostics for the deployment: which env vars exist (booleans
   only — never values) and whether the Tavus key + Redis actually respond.
   Answers "I added the env var, why doesn't it work?" in one page load. */

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Sign in to the builder first, then reload this page." }); return; }

  const out = {
    anthropic_key_set: !!process.env.ANTHROPIC_API_KEY,
    tavus_key_set: !!process.env.TAVUS_API_KEY,
    tavus_key_works: null,
    redis_attached: kvAvailable(),
    redis_works: null,
    blob_store_set: !!process.env.BLOB_READ_WRITE_TOKEN,
    cartesia_key_set: !!process.env.CARTESIA_API_KEY,
    login_configured: !!process.env.BUILDER_PASSWORD,
  };

  if (out.tavus_key_set) {
    try {
      const r = await fetch("https://tavusapi.com/v2/pals?limit=1", {
        headers: { "x-api-key": process.env.TAVUS_API_KEY },
      });
      out.tavus_key_works = r.ok;
      if (!r.ok) out.tavus_key_error = `Tavus answered ${r.status} — the key is present but rejected (typo, whitespace, or revoked).`;
    } catch (e) {
      out.tavus_key_works = false;
      out.tavus_key_error = e.message;
    }
  }

  if (out.redis_attached) {
    try { await kvGet("health:probe"); out.redis_works = true; }
    catch (e) { out.redis_works = false; out.redis_error = e.message; }
  }

  res.status(200).json(out);
}
