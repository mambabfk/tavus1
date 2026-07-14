import { authRequired, isAuthed, checkPassword, sessionCookie } from "./_auth.js";

/* GET  → { authRequired, authed }  (session check on app load)
   POST → { password } → sets the session cookie on success */

export default async function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({ authRequired: authRequired(), authed: isAuthed(req) });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "GET or POST only" });
    return;
  }
  if (!authRequired()) {
    res.status(200).json({ ok: true });
    return;
  }
  const { password } = req.body ?? {};
  if (checkPassword(password)) {
    res.setHeader("Set-Cookie", sessionCookie());
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ error: "Wrong access code." });
  }
}
