import { isAuthed } from "./_auth.js";

/* Link finder for the Magic Canvas link catalog. Browsers can't fetch other
   sites (CORS), so this crawls ONE page server-side and returns its real
   links — the operator searches ("linen", "punta norte"), picks matches, and
   the catalog rides conversational_context so link cards only ever share
   URLs that actually exist. Also parses sitemap.xml when pointed at one. */

function safeUrl(raw) {
  try {
    const u = new URL(String(raw));
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || /^(\d+\.){3}\d+$/.test(host) || host.endsWith(".local") || host.endsWith(".internal")) return null;
    return u;
  } catch { return null; }
}

const decodeEntities = (s) =>
  String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in — enter the access code first." }); return; }

  const page = safeUrl(req.query?.url);
  if (!page) { res.status(400).json({ error: "Give a full page URL (https://…)." }); return; }
  const q = String(req.query?.q ?? "").trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(page.href, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        // Commerce sites 403 the default fetch UA — look like a browser.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en,es;q=0.9",
      },
    });
    clearTimeout(t);
    if (!r.ok) {
      res.status(502).json({
        error: [403, 401, 429, 503].includes(r.status)
          ? `The site blocks automated visits (${r.status}) — use the paste box instead: open the page in your own browser, select around the products, Copy, and paste.`
          : `The site answered ${r.status} for that page.`,
      });
      return;
    }
    const base = safeUrl(r.url) || page;
    const body = (await r.text()).slice(0, 3_000_000);

    // meta=1: page metadata instead of links — title + preview image
    // (og:image), for product-card rows in the approved-links catalog.
    if (String(req.query?.meta ?? "") === "1") {
      const pick = (re) => { const m = body.match(re); return m ? decodeEntities(m[1]).trim() : ""; };
      const rawImg =
        pick(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
        pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      let image = "";
      try { if (rawImg) image = new URL(rawImg, base.href).href; } catch { /* skip */ }
      const title =
        pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        pick(/<title[^>]*>([^<]+)<\/title>/i);
      res.status(200).json({ title: title.slice(0, 160), image, page: base.href });
      return;
    }

    const found = new Map(); // url → label
    const add = (href, label) => {
      try {
        const u = new URL(href, base.href);
        if (!/^https?:$/.test(u.protocol)) return;
        // Same-site links only — a product catalog never points off-site.
        const site = base.hostname.replace(/^www\./, "");
        if (u.hostname.replace(/^www\./, "") !== site) return;
        u.hash = "";
        const key = u.href;
        const text = decodeEntities(label).replace(/\s+/g, " ").trim().slice(0, 120);
        if (!found.has(key) || (text && !found.get(key))) found.set(key, text);
      } catch { /* skip malformed */ }
    };

    if (/^\s*<\?xml/.test(body) || /<(urlset|sitemapindex)[\s>]/.test(body)) {
      // Sitemap: every <loc> is a link; the label is the path.
      for (const m of body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) add(m[1], "");
    } else {
      for (const m of body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const label = m[2].replace(/<[^>]+>/g, " ");
        add(m[1], label);
      }
    }

    let links = [...found.entries()].map(([url, text]) => ({
      url,
      text: text || decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "").replace(/[-_]/g, " ").replace(/\.\w+$/, ""),
    }));
    if (terms.length) {
      links = links.filter((l) => {
        const hay = `${l.text} ${l.url}`.toLowerCase();
        return terms.every((x) => hay.includes(x));
      });
    }
    res.status(200).json({ links: links.slice(0, 40), total: links.length, page: base.href });
  } catch (e) {
    res.status(502).json({ error: e.name === "AbortError" ? "The site took too long to answer." : (e.message || "couldn't fetch that page") });
  }
}
