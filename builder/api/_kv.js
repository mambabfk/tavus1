/* Tiny Redis-over-REST client for Upstash (Vercel Marketplace) / Vercel KV.
   No dependencies — commands go as JSON arrays to the REST endpoint.
   Underscore prefix keeps Vercel from deploying this as a function. */

const base =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const token =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const kvAvailable = () => !!(base && token);

async function redis(command) {
  const r = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `storage error (${r.status})`);
  return j.result;
}

export async function kvGet(key) {
  const v = await redis(["GET", key]);
  return v == null ? null : JSON.parse(v);
}

export function kvSet(key, value) {
  return redis(["SET", key, JSON.stringify(value)]);
}

/* SET with an expiry — for data that should age out on its own. */
export function kvSetEx(key, value, ttlSeconds) {
  return redis(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
}

/* Increment with a TTL set on first touch — for rate limits / day counters. */
export async function kvIncr(key, ttlSeconds) {
  const n = await redis(["INCR", key]);
  if (n === 1 && ttlSeconds) await redis(["EXPIRE", key, String(ttlSeconds)]);
  return n;
}

export const kvLpush = (key, value) => redis(["LPUSH", key, JSON.stringify(value)]);
export const kvLtrim = (key, start, stop) => redis(["LTRIM", key, String(start), String(stop)]);

export async function kvLrange(key, start, stop) {
  const arr = (await redis(["LRANGE", key, String(start), String(stop)])) || [];
  return arr.map((s) => { try { return JSON.parse(s); } catch { return s; } });
}

export async function kvMget(keys) {
  if (!keys.length) return [];
  return (await redis(["MGET", ...keys])) || [];
}

export const kvSetRaw = (key, value) => redis(["SET", key, String(value)]);
