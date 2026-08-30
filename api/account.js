import { accountsMode, sessionEmail, changePassword } from "./_auth.js";
import { kvMget, kvScanKeys } from "./_kv.js";

/* Account self-service + team directory (accounts mode only).
   GET  (signed-in personal session) → { email, users: [{email, createdAt,
        resetAt}] } — every account on this deployment, so the team can see
        who exists and help with lost passwords.
   POST { current, next } → change the signed-in account's password. The
        current password is the credential; other devices stay signed in
        (sessions are stateless 30-day cookies). */

export default async function handler(req, res) {
  const email = sessionEmail(req);
  if (!email) { res.status(401).json({ error: "Sign in first." }); return; }
  if (!accountsMode()) {
    res.status(400).json({ error: "Accounts need BUILDER_PASSWORD + Redis (see the deploy README)." });
    return;
  }
  if (email === "team" || email === "open") {
    res.status(400).json({ error: "You're on a legacy shared-code session — sign out and create a personal account (any signed-in teammate can mint you an invite code)." });
    return;
  }

  try {
    if (req.method === "GET") {
      const keys = (await kvScanKeys("user:*", 300)).map(String);
      const vals = keys.length ? await kvMget(keys) : [];
      const users = keys
        .map((k, i) => {
          let v = null;
          try { v = vals[i] == null ? null : JSON.parse(vals[i]); } catch { /* skip */ }
          return { email: k.slice(5), createdAt: v?.createdAt || null, resetAt: v?.resetAt || null };
        })
        .sort((a, b) => String(a.email).localeCompare(String(b.email)));
      res.status(200).json({ email, users });
      return;
    }
    if (req.method === "POST") {
      const { current, next } = req.body ?? {};
      await changePassword(email, current, next);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "GET or POST" });
  } catch (e) {
    const msg = e.message || "account error";
    res.status(/Wrong|Too many/.test(msg) ? 401 : 400).json({ error: msg });
  }
}
