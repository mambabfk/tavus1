import crypto from "node:crypto";

/* Shared access-code auth for the builder.
   Set BUILDER_PASSWORD in the Vercel env to require login; leave it unset to
   keep the app open (e.g. local dev). The session cookie is a stateless HMAC
   derived from the password — changing the password revokes every session.
   Underscore prefix keeps Vercel from deploying this file as a function. */

const COOKIE = "builder_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function authRequired() {
  return !!process.env.BUILDER_PASSWORD;
}

function sessionToken() {
  const key = crypto
    .createHash("sha256")
    .update(`tavus-builder|${process.env.BUILDER_PASSWORD}`)
    .digest();
  return crypto.createHmac("sha256", key).update("builder-session-v1").digest("hex");
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function isAuthed(req) {
  if (!authRequired()) return true;
  const match = (req.headers.cookie || "").match(/(?:^|;\s*)builder_auth=([^;]+)/);
  return !!match && safeEqual(match[1], sessionToken());
}

export function checkPassword(password) {
  return safeEqual(password, process.env.BUILDER_PASSWORD);
}

export function sessionCookie() {
  return `${COOKIE}=${sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}
