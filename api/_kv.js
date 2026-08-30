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
export const kvGetRaw = (key) => redis(["GET", key]);

/* Key scan — for small, bounded namespaces only (e.g. the team's user:*
   accounts). Walks SCAN cursors with a hard cap so it can never run away. */
export async function kvScanKeys(match, limit = 300) {
  let cursor = "0";
  const keys = [];
  for (let i = 0; i < 20; i++) {
    const out = await redis(["SCAN", cursor, "MATCH", match, "COUNT", "200"]);
    const [next, chunk] = Array.isArray(out) ? out : ["0", []];
    keys.push(...(chunk || []));
    cursor = String(next);
    if (cursor === "0" || keys.length >= limit) break;
  }
  return keys.slice(0, limit);
}

/* Hash helpers — one hash per user, one field per item. Each request only
   carries a single item, so a big collection never hits request-size caps. */
export const kvHset = (key, field, value) => redis(["HSET", key, field, JSON.stringify(value)]);
export async function kvHget(key, field) {
  const v = await redis(["HGET", key, field]);
  return v == null ? null : JSON.parse(v);
}
export const kvHdel = (key, field) => redis(["HDEL", key, field]);
export const kvHkeys = (key) => redis(["HKEYS", key]);
export async function kvHgetall(key) {
  const arr = (await redis(["HGETALL", key])) || [];
  const out = {};
  for (let i = 0; i + 1 < arr.length; i += 2) {
    try { out[arr[i]] = JSON.parse(arr[i + 1]); } catch { out[arr[i]] = arr[i + 1]; }
  }
  return out;
}
