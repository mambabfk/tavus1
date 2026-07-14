import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "./_auth.js";

/* POST { url } → fetches the company website server-side, has Claude extract
   a brand theme (colors, name, headline, logo) as JSON, and returns it. The
   demo page applies it as CSS variables — instant "looks like their site". */

const THEME_SYSTEM = `You are a brand designer. Given a company website's HTML, design a matching theme for a demo page where visitors talk face-to-face with the company's AI expert.

Return ONLY valid JSON — no code fences, no commentary:
{
  "brand": "Company name",
  "headline": "Short hero headline in the brand's voice (about talking to their AI expert)",
  "tagline": "One supporting sentence",
  "colors": {
    "canvas": "#hex — page background, subtly tinted toward the brand (keep it light unless the site is clearly dark-themed)",
    "surface": "#hex — card background",
    "border": "#hex — hairline borders",
    "text": "#hex — primary text, strong contrast on canvas/surface",
    "muted": "#hex — secondary text",
    "accent": "#hex — the brand's primary accent color"
  },
  "font": "CSS font-family stack matching the site's typographic feel (fall back to system fonts)",
  "logoUrl": "absolute URL of the company's logo image, or null if none found"
}

For logoUrl prefer, in order: an <img> whose src/alt/class mentions logo, og:image if it looks like a logo (not a photo), apple-touch-icon, a rel=icon that isn't a tiny .ico. Never invent a URL — null when unsure. All colors must be real hex values actually grounded in the site's palette.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Not signed in — enter the access code first." });
    return;
  }

  let target;
  try {
    target = new URL(String(req.body?.url ?? "").trim());
    if (!/^https?:$/.test(target.protocol)) throw new Error("bad protocol");
    const host = target.hostname.toLowerCase();
    if (host === "localhost" || /^(\d+\.){3}\d+$/.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
      throw new Error("blocked host");
    }
  } catch {
    res.status(400).json({ error: "Paste a full public website URL, like https://acme.com" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server. Add it in the Vercel project's environment variables." });
    return;
  }

  let html;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const r = await fetch(target.href, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TavusExperienceBuilder/1.0)", Accept: "text/html" },
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`the site answered ${r.status}`);
    html = await r.text();
  } catch (e) {
    res.status(502).json({ error: `Couldn't fetch that site (${e.name === "AbortError" ? "timed out" : e.message}). Check the URL.` });
    return;
  }

  // Trim to what matters for branding: full <head>, then body with scripts
  // stripped (keeps inline styles/classes/img tags for color + logo hunting).
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [""])[0].slice(0, 30_000);
  const body = html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .slice(0, 25_000);

  try {
    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      system: THEME_SYSTEM,
      messages: [{ role: "user", content: `Website: ${target.href}\n\n${head}\n\n${body}` }],
    });
    const msg = await stream.finalMessage();
    const text = msg.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());

    if (parsed.logoUrl) {
      try { parsed.logoUrl = new URL(parsed.logoUrl, target.href).href; }
      catch { parsed.logoUrl = null; }
    }
    res.status(200).json(parsed);
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      res.status(502).json({ error: `Anthropic API error: ${e.message}` });
    } else if (e instanceof SyntaxError) {
      res.status(502).json({ error: "Claude's theme came back malformed — try again." });
    } else {
      res.status(500).json({ error: e.message || "theming failed" });
    }
  }
}
