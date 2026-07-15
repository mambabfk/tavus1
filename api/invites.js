import crypto from "node:crypto";
import { accountsMode, isAuthed, sessionEmail } from "./_auth.js";
import { kvSetEx, kvLpush, kvLtrim, kvLrange, kvMget } from "./_kv.js";

/* Per-person invite codes. Any signed-in teammate can mint one; each code
   admits exactly one sign-up, expires unused after 30 days, and the list
   shows who created it and who used it.
   POST → { code }        GET → { invites: [{code, createdBy, createdAt, usedBy, usedAt, expired}] } */

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I lookalikes

export default async function handler(req, res) {
  if (!isAuthed(req)) { res.status(401).json({ error: "Sign in first." }); return; }
  if (!accountsMode()) {
    res.status(400).json({ error: "Invites need accounts mode: set BUILDER_PASSWORD and attach Redis." });
    return;
  }

  if (req.method === "POST") {
    const code = "TVS-" + Array.from(crypto.randomBytes(8)).map((b) => ALPHA[b % ALPHA.length]).join("");
    await kvSetEx(`invite:${code}`, {
      createdBy: sessionEmail(req),
      createdAt: new Date().toISOString(),
      usedBy: null,
    }, 30 * 86400);
    await kvLpush("invites:index", code);
    await kvLtrim("invites:index", 0, 199);
    res.status(200).json({ code });
    return;
  }

  if (req.method === "GET") {
    const codes = (await kvLrange("invites:index", 0, 199)).map(String);
    const vals = codes.length ? await kvMget(codes.map((c) => `invite:${c}`)) : [];
    const invites = codes.map((code, i) => {
      let v = null;
      try { v = vals[i] == null ? null : JSON.parse(vals[i]); } catch { /* skip */ }
      return v
        ? { code, createdBy: v.createdBy, createdAt: v.createdAt, usedBy: v.usedBy || null, usedAt: v.usedAt || null, expired: false }
        : { code, expired: true }; // TTL lapsed unused
    });
    res.status(200).json({ invites });
    return;
  }

  res.status(405).json({ error: "GET or POST" });
}
