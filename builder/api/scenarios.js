import { isAuthed, sessionEmail } from "./_auth.js";
import { kvAvailable, kvHset, kvHget, kvHdel, kvHkeys, kvHgetall } from "./_kv.js";

/* Cloud-synced builder scenarios — the durable copy behind the localStorage
   cache, so saved demos survive cleared browser storage, blocked storage
   (preview iframes), and follow the account across devices/browsers.

   Storage: one Redis hash per account (scenarios:{email}; "team" for legacy
   shared-code sessions), one field per scenario name. Field values are
   { name, config, updatedAt, savedBy }. Configs never contain the Tavus API
   key — collectConfig() excludes it on the client.

   GET            → { names: [...] } for the picker
   GET ?name=…    → one scenario entry
   POST {name, config} → upsert
   DELETE ?name=… → remove */

const NO_KV_MSG =
  "Scenario cloud sync isn't set up. In Vercel: Storage → Create Database → Upstash Redis (attach to this project), then redeploy. Scenarios still save in this browser.";

const normName = (n) => String(n ?? "").trim().slice(0, 80);

export default async function handler(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Not signed in — enter the access code first." });
    return;
  }
  if (!kvAvailable()) {
    res.status(501).json({ error: NO_KV_MSG });
    return;
  }

  const owner = sessionEmail(req) || "team";
  const key = `scenarios:${owner}`;

  try {
    if (req.method === "GET") {
      const name = normName(req.query?.name);
      if (name) {
        const entry = await kvHget(key, name);
        if (!entry) {
          res.status(404).json({ error: `No cloud copy of "${name}".` });
          return;
        }
        res.status(200).json(entry);
        return;
      }
      const names = (await kvHkeys(key)) || [];
      // Lightweight per-scenario metadata (updatedAt/savedBy) lives in a
      // sibling hash so listing never has to pull full configs (logos make
      // them big). Entries saved before the meta hash existed just have none.
      let meta = {};
      try { meta = await kvHgetall(`scenmeta:${owner}`); } catch { /* optional */ }
      res.status(200).json({ names: names.sort(), meta });
      return;
    }

    if (req.method === "POST") {
      const { name: rawName, config } = req.body ?? {};
      const name = normName(rawName);
      if (!name) { res.status(400).json({ error: "The scenario needs a name." }); return; }
      if (!config || typeof config !== "object" || Array.isArray(config)) {
        res.status(400).json({ error: "Nothing to save — the scenario config is missing." });
        return;
      }
      if (JSON.stringify(config).length > 400_000) {
        res.status(413).json({ error: "This scenario is too large to sync — try a smaller logo image." });
        return;
      }
      const updatedAt = new Date().toISOString();
      await kvHset(key, name, { name, config, updatedAt, savedBy: owner });
      try { await kvHset(`scenmeta:${owner}`, name, { updatedAt, savedBy: owner }); } catch { /* meta is best-effort */ }
      res.status(200).json({ ok: true, name, updatedAt });
      return;
    }

    if (req.method === "DELETE") {
      const name = normName(req.query?.name);
      if (!name) { res.status(400).json({ error: "Which scenario? Pass ?name=…" }); return; }
      await kvHdel(key, name);
      try { await kvHdel(`scenmeta:${owner}`, name); } catch { /* meta is best-effort */ }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "GET, POST or DELETE only" });
  } catch (e) {
    res.status(502).json({ error: `Storage: ${e.message}` });
  }
}
