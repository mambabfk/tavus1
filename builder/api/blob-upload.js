import { handleUpload } from "@vercel/blob/client";
import { put } from "@vercel/blob";
import { isAuthed } from "./_auth.js";

/* Uploads for the Knowledge Base. Two paths, because Vercel Blob has two
   credential modes:

   - BLOB_READ_WRITE_TOKEN (legacy token): browser uploads via handleUpload —
     files stream straight to the store, so 50MB decks work.
   - OIDC mode (new-store default: BLOB_STORE_ID + VERCEL_OIDC_TOKEN, no RW
     token): handleUpload can't sign client tokens, but server-side put()
     works — so small files (≤ ~3.5MB, under the serverless body cap) upload
     through this function directly. Bigger files need the RW token enabled
     on the store's project connection.

   The frontend probes (__diag / GET) and picks the right path. */

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.ms-excel", // what Windows browsers report for .csv
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // some OS/browser combos report no real type — Tavus validates content anyway
];

const mode = () =>
  process.env.BLOB_READ_WRITE_TOKEN ? "token" : process.env.BLOB_STORE_ID ? "oidc" : "none";

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in." }); return; }
    res.status(200).json({ configured: mode() !== "none", mode: mode() });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "GET or POST only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in — enter the access code first." }); return; }

  // Diagnostic preflight — the @vercel/blob client swallows this endpoint's
  // error bodies, so the frontend checks ground truth here before uploading.
  if (req.body && req.body.__diag) {
    const t = process.env.BLOB_READ_WRITE_TOKEN || "";
    res.status(200).json({
      ok: true,
      mode: mode(),
      hasToken: !!t,
      hasStoreId: !!process.env.BLOB_STORE_ID,
      store: t ? (t.split("_")[3] || "").slice(0, 14) : (process.env.BLOB_STORE_ID || "").slice(0, 14) || null,
    });
    return;
  }

  // OIDC-mode direct upload: base64 file through this function → put().
  // Serverless body cap keeps this to small files; the frontend enforces it.
  if (req.body && req.body.__direct) {
    if (mode() === "none") { res.status(500).json({ error: "No Blob store is connected to this deployment." }); return; }
    const name = String(req.body.name || "upload").slice(0, 200).replace(/[^\w.\- ]+/g, "_");
    const contentType = ALLOWED_TYPES.includes(req.body.contentType) ? req.body.contentType : "application/octet-stream";
    const data = String(req.body.data || "");
    if (!data || data.length > 5_500_000) { res.status(413).json({ error: "Direct uploads cap at ~3.5MB — enable the store's read-write token for bigger files." }); return; }
    try {
      const blob = await put(name, Buffer.from(data, "base64"), {
        access: "public", // Tavus must be able to download the file to ingest it
        addRandomSuffix: true,
        contentType,
      });
      res.status(200).json({ url: blob.url });
    } catch (e) {
      console.error("blob-upload direct put failed:", e);
      res.status(502).json({ error: e.message || "direct upload failed" });
    }
    return;
  }

  // Browser (client-token) upload path — requires the legacy RW token.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(501).json({
      error: mode() === "oidc"
        ? "This store is connected in OIDC mode — browser uploads need the store's read-write token. In the store's project connection settings, enable BLOB_READ_WRITE_TOKEN, then redeploy."
        : "File uploads aren't set up. In Vercel: Storage → Create Database → Blob (attach to this project), then redeploy.",
    });
    return;
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: 50 * 1024 * 1024, // Tavus's own document cap
        addRandomSuffix: true,
      }),
      // Fires via Vercel's webhook after the browser finishes uploading; the
      // frontend registers the doc with Tavus itself, so nothing to do here.
      onUploadCompleted: async () => {},
    });
    res.status(200).json(jsonResponse);
  } catch (e) {
    console.error("blob-upload handleUpload failed:", e); // visible in Vercel function logs
    res.status(400).json({ error: e.message || "upload failed" });
  }
}
