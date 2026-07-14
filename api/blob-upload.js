import { handleUpload } from "@vercel/blob/client";
import { isAuthed } from "./_auth.js";

/* Token endpoint for direct browser → Vercel Blob uploads (client uploads
   bypass the 4.5MB serverless body limit, so 50MB decks work). The public
   blob URL is then fed to the Tavus Knowledge Base by the frontend.
   Requires a Blob store attached to the project (BLOB_READ_WRITE_TOKEN). */

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in — enter the access code first." }); return; }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(500).json({ error: "File uploads aren't set up. In Vercel: Storage → Create Database → Blob (attach to this project), then redeploy." });
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
    res.status(400).json({ error: e.message || "upload failed" });
  }
}
