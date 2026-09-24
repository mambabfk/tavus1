/* Demo tool endpoints for the CIO Office Morning Notes demo.
   Tavus calls these directly (tool delivery: api) and the PAL speaks the JSON
   that comes back. Every figure here comes from the 14 September morning note
   or is clearly labelled illustrative — the PAL's guardrails forbid it from
   inventing numbers, so this is the only place they can come from.
   Public, read-only, no side effects, no secrets. */

const QUOTES = {
  brent:   { instrument: "Brent crude", level: "$101.40", change: "+1.2% today", note: "second week higher; East-West pipeline shutdown" },
  gold:    { instrument: "Gold", level: "$2,287/oz", change: "-0.6% today", note: "slipping on firmer Fed expectations" },
  spx:     { instrument: "S&P 500", level: "5,412", change: "-0.4% today", note: "outperformed the Dow and small caps last week, still negative" },
  ust10:   { instrument: "US 10-year Treasury", level: "4.82%", change: "+6bp today", note: "curve shifted sharply higher last week" },
  bitcoin: { instrument: "Bitcoin", level: "$71,900", change: "+0.9% today", note: "ticked higher against the risk-off tone" },
};

const ALIAS = {
  oil: "brent", crude: "brent", "brent crude": "brent",
  "s&p": "spx", "s&p 500": "spx", sp500: "spx", equities: "spx",
  "10 year": "ust10", "10-year": "ust10", treasury: "ust10", treasuries: "ust10", yields: "ust10",
  btc: "bitcoin",
};

const EXPOSURES = {
  energy:           { weight: "6.8%", benchmark: "4.1%", stance: "overweight", moved: "+90bp over the last month" },
  duration:         { weight: "4.2 years", benchmark: "6.1 years", stance: "short duration", moved: "unchanged this quarter" },
  "emerging markets": { weight: "8.4%", benchmark: "9.0%", stance: "slightly underweight", moved: "-40bp this quarter" },
  equities:         { weight: "58%", benchmark: "60%", stance: "neutral to slightly underweight", moved: "-200bp since July" },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only." });
    return;
  }
  const fn = String(req.query?.fn ?? "").toLowerCase();
  const body = req.body ?? {};
  const key = (v) => String(v ?? "").trim().toLowerCase();

  if (fn === "quote") {
    const asked = key(body.instrument);
    const hit = QUOTES[asked] || QUOTES[ALIAS[asked]];
    // An unknown instrument returns a plain miss rather than a guess — the PAL
    // is told never to fill a gap with a plausible number.
    res.status(200).json(hit
      ? { ...hit, as_of: "this morning", basis: "illustrative demo data" }
      : { found: false, instrument: body.instrument || "(none given)", say: "I don't have a live level for that one — I'll get it from the desk." });
    return;
  }

  if (fn === "exposure") {
    const cls = key(body.asset_class);
    const hit = EXPOSURES[cls] || EXPOSURES[Object.keys(EXPOSURES).find((k) => cls && k.includes(cls))];
    res.status(200).json(hit
      ? { asset_class: body.asset_class, ...hit, basis: "illustrative demo portfolio" }
      : { found: false, asset_class: body.asset_class || "(none given)", say: "That one isn't broken out in the summary — your adviser can pull the full look-through." });
    return;
  }

  if (fn === "book") {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    if (!name || !email) {
      res.status(200).json({ booked: false, say: "I still need a name and an email before I can book that." });
      return;
    }
    res.status(200).json({
      booked: true,
      name,
      email,
      topic: String(body.topic ?? "").trim() || "the morning note",
      slot: "tomorrow at 9:15",
      say: `Booked — ${name} with the adviser tomorrow at 9:15, and I've flagged ${String(body.topic ?? "the note").trim()}.`,
    });
    return;
  }

  res.status(400).json({ error: "Unknown fn. Use ?fn=quote, ?fn=exposure or ?fn=book." });
}
