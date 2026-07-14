import { isAuthed } from "./_auth.js";
import { kvAvailable, kvLrange, kvMget } from "./_kv.js";

/* Per-demo stats dashboard (builder session required).
   GET            → all shared demos with total launches + last activity
   GET ?slug=…    → one demo: daily counts (last 14 days) + recent
                    conversation IDs (click through to transcripts) */

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in — enter the access code first." }); return; }
  if (!kvAvailable()) {
    res.status(500).json({ error: "Demo-link storage isn't set up. In Vercel: Storage → Create Database → Upstash Redis, then redeploy." });
    return;
  }

  try {
    const slug = String(req.query?.slug ?? "");

    if (slug) {
      if (!/^[A-Za-z0-9_-]{6,24}$/.test(slug)) { res.status(400).json({ error: "Bad slug." }); return; }
      const days = [];
      for (let i = 13; i >= 0; i--) {
        days.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
      }
      const values = await kvMget([
        `stats:${slug}:launches`,
        `stats:${slug}:last`,
        ...days.map((d) => `stats:${slug}:d:${d}`),
      ]);
      const convos = await kvLrange(`stats:${slug}:convos`, 0, 99);
      res.status(200).json({
        slug,
        launches: parseInt(values[0], 10) || 0,
        last: values[1] || null,
        days: days.map((date, i) => ({ date, count: parseInt(values[i + 2], 10) || 0 })),
        convos,
      });
      return;
    }

    const index = await kvLrange("demos:index", 0, 99);
    const demos = index.filter((d) => d && d.slug);
    const values = demos.length
      ? await kvMget(demos.flatMap((d) => [`stats:${d.slug}:launches`, `stats:${d.slug}:last`]))
      : [];
    res.status(200).json({
      demos: demos.map((d, i) => ({
        ...d,
        launches: parseInt(values[i * 2], 10) || 0,
        last: values[i * 2 + 1] || null,
      })),
    });
  } catch (e) {
    res.status(502).json({ error: `Storage: ${e.message}` });
  }
}
