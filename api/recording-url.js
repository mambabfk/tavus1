import { createHmac, createHash } from "crypto";
import { isAuthed } from "./_auth.js";
import { kvAvailable, kvGet } from "./_kv.js";

/* GET ?id=<conversation_id> → 302 to a presigned S3 GET URL (15 min) for
   that call's recording, served as an attachment named <id>.mp4.

   Needs a READ-ONLY key pair in the env (RECORDINGS_AWS_ACCESS_KEY_ID /
   RECORDINGS_AWS_SECRET_ACCESS_KEY, optional RECORDINGS_AWS_REGION) scoped
   to s3:GetObject on the recordings bucket — the Tavus IAM trust only lets
   Tavus write; reading back out needs our own credential. Zero-dep SigV4
   query presign, same spirit as the REST Redis client. */

function presignGet({ bucket, key, region, accessKey, secretKey, filename, expires = 900 }) {
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const amzDate = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const encPath = "/" + key.split("/").map((s) => encodeURIComponent(s)).join("/");

  const params = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
    "response-content-disposition": `attachment; filename="${filename}"`,
    "response-content-type": "video/mp4",
  };
  const qs = Object.keys(params).sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

  const canonical = ["GET", encPath, qs, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  let k = createHmac("sha256", "AWS4" + secretKey).update(dateStamp).digest();
  for (const part of [region, "s3", "aws4_request"]) k = createHmac("sha256", k).update(part).digest();
  const signature = createHmac("sha256", k).update(toSign).digest("hex");

  return `https://${host}${encPath}?${qs}&X-Amz-Signature=${signature}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Sign in to the builder first." }); return; }

  const accessKey = process.env.RECORDINGS_AWS_ACCESS_KEY_ID;
  const secretKey = process.env.RECORDINGS_AWS_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) {
    res.status(501).json({
      error: "Downloads aren't set up yet: add RECORDINGS_AWS_ACCESS_KEY_ID and RECORDINGS_AWS_SECRET_ACCESS_KEY (a read-only key with s3:GetObject on the recordings bucket) to the Vercel env vars, then redeploy.",
    });
    return;
  }

  const id = String(req.query?.id ?? "");
  if (!/^[a-z0-9]{6,64}$/i.test(id)) { res.status(400).json({ error: "Bad conversation id." }); return; }
  if (!kvAvailable()) { res.status(500).json({ error: "Storage isn't attached." }); return; }

  try {
    const rec = await kvGet(`rec:${id}`);
    if (!rec?.bucket || !rec?.key) {
      res.status(404).json({ error: "No recording is on file for this call." });
      return;
    }
    const url = presignGet({
      bucket: rec.bucket,
      key: rec.key,
      region: process.env.RECORDINGS_AWS_REGION || "us-east-1",
      accessKey,
      secretKey,
      filename: `${id}.mp4`,
    });
    res.writeHead(302, { Location: url, "Cache-Control": "no-store" });
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message || "presign failed" });
  }
}
