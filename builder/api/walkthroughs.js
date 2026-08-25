import { isAuthed } from "./_auth.js";
import { kvAvailable, kvHset, kvHgetall, kvHdel } from "./_kv.js";

/* Feature walkthrough videos — app-level content (not per-demo config):
   one optional video + narration script per builder step. The ▶ on a step
   plays the video with the narration rendered live by /api/tts, so swapping
   a recording never involves video editing. Stored in one Redis hash so the
   whole team shares the same library. */

const KEY = "walkthroughs";
const STEP_ID = /^[a-z][a-z0-9_-]{0,32}$/;

export default async function handler(req, res) {
  if (!isAuthed(req)) { res.status(401).json({ error: "Not signed in — enter the access code first." }); return; }
  if (!kvAvailable()) { res.status(501).json({ error: "Walkthrough storage needs Redis (same setup as demo links)." }); return; }

  try {
    if (req.method === "GET") {
      const all = await kvHgetall(KEY);
      res.status(200).json(all || {});
      return;
    }
    if (req.method === "POST") {
      const { stepId, url, narration } = req.body ?? {};
      if (!STEP_ID.test(String(stepId ?? ""))) { res.status(400).json({ error: "Bad step id." }); return; }
      let videoUrl = String(url ?? "").trim().slice(0, 2000);
      if (videoUrl) {
        try {
          const u = new URL(videoUrl);
          if (!/^https?:$/.test(u.protocol)) throw new Error();
          videoUrl = u.href;
        } catch { res.status(400).json({ error: "The video URL must be a full https link." }); return; }
      }
      await kvHset(KEY, stepId, {
        url: videoUrl,
        narration: String(narration ?? "").trim().slice(0, 2400),
        updatedAt: new Date().toISOString(),
      });
      res.status(200).json({ ok: true });
      return;
    }
    if (req.method === "DELETE") {
      const stepId = String(req.query?.stepId ?? "");
      if (!STEP_ID.test(stepId)) { res.status(400).json({ error: "Bad step id." }); return; }
      await kvHdel(KEY, stepId);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "GET, POST or DELETE" });
  } catch (e) {
    res.status(502).json({ error: `Storage: ${e.message}` });
  }
}
