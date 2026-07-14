import {
  authRequired, accountsMode, sessionEmail,
  createAccount, verifyAccount, sessionCookieFor, clearSessionCookie,
  checkPassword, sessionCookie,
} from "./_auth.js";

/* GET  → { authRequired, accounts, authed, email }   (session check)
   POST → accounts mode: { mode: "signin"|"signup"|"signout", email, password, invite }
          legacy mode:   { password }  (shared access code)                    */

export default async function handler(req, res) {
  if (req.method === "GET") {
    const email = sessionEmail(req);
    res.status(200).json({
      authRequired: authRequired(),
      accounts: accountsMode(),
      authed: !!email,
      email: email && email !== "team" && email !== "open" ? email : null,
    });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "GET or POST only" }); return; }

  const { mode = "signin", email, password, invite } = req.body ?? {};

  if (mode === "signout") {
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(200).json({ ok: true });
    return;
  }

  if (!authRequired()) { res.status(200).json({ ok: true }); return; }

  try {
    if (accountsMode()) {
      const who = mode === "signup"
        ? await createAccount(email, password, invite)
        : await verifyAccount(email, password);
      res.setHeader("Set-Cookie", sessionCookieFor(who));
      res.status(200).json({ ok: true, email: who });
    } else {
      // Legacy: single shared access code (no Redis attached).
      if (!checkPassword(password)) { res.status(401).json({ error: "Wrong access code." }); return; }
      res.setHeader("Set-Cookie", sessionCookie());
      res.status(200).json({ ok: true });
    }
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
}
