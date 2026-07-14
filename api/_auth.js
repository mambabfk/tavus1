import crypto from "node:crypto";
import { kvAvailable, kvGet, kvSet, kvIncr } from "./_kv.js";

/* Auth for the builder.
   - Accounts mode (BUILDER_PASSWORD set + Redis attached): per-user email +
     password accounts stored in Redis (scrypt-hashed). BUILDER_PASSWORD acts
     as the INVITE CODE required to create an account. Sessions are signed,
     expiring cookies carrying the email. Rotating BUILDER_PASSWORD signs
     everyone out (accounts survive; they just sign in again).
   - Legacy mode (BUILDER_PASSWORD set, no Redis): single shared access code.
   - Open mode (no BUILDER_PASSWORD): no login at all (local dev).
   Underscore prefix keeps Vercel from deploying this file as a function. */

const COOKIE = "builder_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const authRequired = () => !!process.env.BUILDER_PASSWORD;
export const accountsMode = () => authRequired() && kvAvailable();

const signingKey = () =>
  crypto.createHash("sha256").update(`tavus-builder-v2|${process.env.BUILDER_PASSWORD}`).digest();
const sign = (msg) => crypto.createHmac("sha256", signingKey()).update(msg).digest("base64url");

function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ""));
  const y = Buffer.from(String(b ?? ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* Legacy shared-code token (kept so pre-account sessions don't all break,
   and as the fallback when Redis isn't attached). */
const legacyToken = () =>
  crypto.createHmac(
    "sha256",
    crypto.createHash("sha256").update(`tavus-builder|${process.env.BUILDER_PASSWORD}`).digest()
  ).update("builder-session-v1").digest("hex");

/* Who is this request? Returns the email, "team" for a legacy session,
   "open" when auth is off, or null when unauthenticated. */
export function sessionEmail(req) {
  if (!authRequired()) return "open";
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)builder_auth=([^;]+)/);
  if (!m) return null;
  const val = decodeURIComponent(m[1]);
  if (val.startsWith("v2.")) {
    const [, emailB64, exp, sig] = val.split(".");
    if (!emailB64 || !exp || !sig) return null;
    if (Number(exp) < Date.now() / 1000) return null;
    if (!safeEqual(sig, sign(`${emailB64}|${exp}`))) return null;
    try { return Buffer.from(emailB64, "base64url").toString("utf8"); } catch { return null; }
  }
  return safeEqual(val, legacyToken()) ? "team" : null;
}

export const isAuthed = (req) => !!sessionEmail(req);

export function sessionCookieFor(email) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const eb = Buffer.from(email).toString("base64url");
  const val = `v2.${eb}.${exp}.${sign(`${eb}|${exp}`)}`;
  return `${COOKIE}=${encodeURIComponent(val)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export const clearSessionCookie = () =>
  `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

const normEmail = (e) => String(e ?? "").trim().toLowerCase();
const hashPassword = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString("base64url");

export async function createAccount(email, password, invite) {
  email = normEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That doesn't look like an email address.");
  if (String(password ?? "").length < 8) throw new Error("Password needs at least 8 characters.");
  if (!safeEqual(invite, process.env.BUILDER_PASSWORD)) throw new Error("Wrong invite code.");
  if (await kvGet(`user:${email}`)) throw new Error("That account already exists — sign in instead.");
  const salt = crypto.randomBytes(16).toString("base64url");
  await kvSet(`user:${email}`, { salt, hash: hashPassword(password, salt), createdAt: new Date().toISOString() });
  return email;
}

export async function verifyAccount(email, password) {
  email = normEmail(email);
  const attempts = await kvIncr(`auth:rl:${email}`, 900); // 15-minute window
  if (attempts > 10) throw new Error("Too many attempts — try again in 15 minutes.");
  const user = await kvGet(`user:${email}`);
  if (!user || !safeEqual(hashPassword(password, user.salt), user.hash)) {
    throw new Error("Wrong email or password.");
  }
  return email;
}

/* Legacy shared-code helpers (no-Redis fallback). */
export const checkPassword = (password) => safeEqual(password, process.env.BUILDER_PASSWORD);
export const sessionCookie = () =>
  `${COOKIE}=${legacyToken()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
