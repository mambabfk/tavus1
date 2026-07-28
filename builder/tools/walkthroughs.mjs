/* Auto-builds video walkthrough assets by driving the real app with
   Playwright and recording the browser: scripted cursor, real typing,
   caption overlays. Re-run after feature changes to refresh the videos.

   Usage:  npm run build && node tools/walkthroughs.mjs
   Output: walkthroughs/*.mp4 (falls back to .webm when no ffmpeg)

   Browser resolution: $CHROMIUM_PATH, else the `playwright` package's own
   chromium, else playwright-core + /opt/pw-browsers/chromium.
   ffmpeg resolution: $FFMPEG_PATH, else Playwright's bundled build, else
   `ffmpeg` on PATH. */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "walkthroughs");
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;

/* ── toolchain ─────────────────────────────────────────────── */

async function getChromium() {
  try {
    const pw = await import("playwright");
    return { chromium: pw.chromium, executablePath: process.env.CHROMIUM_PATH || undefined };
  } catch { /* fall through */ }
  const pw = await import("playwright-core");
  const exe = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
  if (!existsSync(exe)) throw new Error("No chromium found — set CHROMIUM_PATH or `npm i -D playwright && npx playwright install chromium`.");
  return { chromium: pw.chromium, executablePath: exe };
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    for (const d of readdirSync(base)) {
      if (d.startsWith("ffmpeg")) {
        const p = join(base, d, "ffmpeg-linux");
        if (existsSync(p)) return p;
      }
    }
  } catch { /* no browsers dir */ }
  return spawnSync("ffmpeg", ["-version"]).status === 0 ? "ffmpeg" : null;
}

/* ── on-page overlay: caption bar + visible cursor ─────────── */

const OVERLAY = () => {
  if (document.getElementById("__wt_cursor")) return;
  const c = document.createElement("div");
  c.id = "__wt_cursor";
  c.style.cssText = "position:fixed;left:60px;top:60px;width:22px;height:22px;border-radius:50%;background:rgba(240,90,60,.85);box-shadow:0 0 0 5px rgba(240,90,60,.25);z-index:999999;pointer-events:none;transform:translate(-50%,-50%);transition:left .5s cubic-bezier(.3,.8,.3,1),top .5s cubic-bezier(.3,.8,.3,1),transform .15s ease;";
  document.body.appendChild(c);
  const t = document.createElement("div");
  t.id = "__wt_caption";
  t.style.cssText = "position:fixed;left:50%;bottom:34px;transform:translateX(-50%);max-width:78%;background:rgba(20,20,22,.92);color:#fff;font:600 19px/1.45 'Instrument Sans',system-ui,sans-serif;padding:13px 24px;border-radius:14px;z-index:999998;pointer-events:none;opacity:0;transition:opacity .35s ease;text-align:center;box-shadow:0 10px 34px rgba(0,0,0,.35);";
  document.body.appendChild(t);
};

async function makeHelpers(page) {
  const install = () => page.evaluate(OVERLAY).catch(() => {});
  await install();
  const say = async (text, holdMs = 1900) => {
    await install();
    await page.evaluate((txt) => {
      const el = document.getElementById("__wt_caption");
      el.textContent = txt;
      el.style.opacity = "1";
    }, text);
    await page.waitForTimeout(holdMs);
  };
  const hush = () => page.evaluate(() => { const el = document.getElementById("__wt_caption"); if (el) el.style.opacity = "0"; }).catch(() => {});
  const moveTo = async (loc) => {
    await install();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const box = await loc.boundingBox();
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.evaluate(([px, py]) => {
      const c = document.getElementById("__wt_cursor");
      c.style.left = `${px}px`;
      c.style.top = `${py}px`;
    }, [x, y]);
    await page.waitForTimeout(560);
  };
  const click = async (loc) => {
    await moveTo(loc);
    await page.evaluate(() => { document.getElementById("__wt_cursor").style.transform = "translate(-50%,-50%) scale(.62)"; });
    await page.waitForTimeout(140);
    await loc.click();
    await page.evaluate(() => { document.getElementById("__wt_cursor").style.transform = "translate(-50%,-50%)"; }).catch(() => {});
    await install(); // page content may have re-rendered a fresh <body> subtree
    await page.waitForTimeout(420);
  };
  const type = async (loc, text) => {
    await click(loc);
    await loc.pressSequentially(text, { delay: 26 });
    await page.waitForTimeout(320);
  };
  return { say, hush, moveTo, click, type };
}

/* ── scenes ────────────────────────────────────────────────── */

async function sceneGuidedJourney(page, h) {
  await h.say("Turn a demo link into a guided product journey — composed per use case", 2600);
  await h.click(page.getByRole("button", { name: "Experience", exact: true }));
  await h.say("Add the steps a visitor walks through before the call", 2000);

  await h.click(page.getByRole("button", { name: "+ Info screen" }));
  await h.type(page.getByPlaceholder("Title — e.g. Welcome to your assessment"), "Welcome to your assessment");
  await h.type(page.getByPlaceholder("A short paragraph the visitor reads before continuing."), "A couple of quick questions before your clinician joins.");

  await h.say("A question — like checking the waiver before a medical intake", 2200);
  await h.click(page.getByRole("button", { name: "+ Question" }));
  await h.type(page.getByPlaceholder("Question — e.g. Have you filled out the waiver form?"), "Have you filled out the waiver form?");
  await h.type(page.getByPlaceholder(/One answer per line/), "Yes, it's done\nNot yet");

  await h.say("A persona picker — one link, multiple experiences", 2200);
  await h.click(page.getByRole("button", { name: "+ Persona picker" }));
  await h.type(page.getByPlaceholder("Prompt — e.g. Who would you like to talk to?"), "Who would you like to talk to?");
  await h.type(page.getByPlaceholder("Option 1 — e.g. Better Santa"), "Nurse intake");
  await h.type(page.getByPlaceholder("Option 2 — e.g. Better Santa"), "Dr. Chen — follow-up");
  await h.hush();

  await h.say("Now walk it as the visitor", 1800);
  await h.click(page.getByRole("button", { name: "Preview the page" }));
  await h.click(page.getByRole("button", { name: "Start the conversation" }));
  await h.say("Guided steps, with progress — this is their onboarding", 2000);
  await h.click(page.getByRole("button", { name: "Continue" }));
  await h.click(page.locator(".exp-opt", { hasText: "Yes, it's done" }));
  await h.click(page.locator(".exp-opt", { hasText: "Dr. Chen" }));
  await h.say("Email capture is built in — you always know who attended", 2200);
  await h.type(page.locator(".exp-input"), "sam@client.com");
  await h.say("Their answers are woven into the conversation — the AI knows them from its first words", 2800);
  await h.say("…and everything lands back in Results: attendee, answers, rating", 2600);
  await h.hush();
  await page.waitForTimeout(600);
}

async function sceneFormatsAndFaces(page, h) {
  await h.say("Face presets — one click, no more hunting for face IDs", 2200);
  await h.click(page.getByRole("button", { name: "Account", exact: true }));
  await h.click(page.locator(".face-chip", { hasText: "Kelly" }));
  await h.click(page.locator(".face-chip", { hasText: "Gloria" }));
  await h.hush();

  await h.click(page.getByRole("button", { name: "Page & Brand", exact: true }));
  await h.type(page.getByRole("textbox", { name: "Headline", exact: true }), "Meet your live travel concierge");
  await h.say("Four page formats — preview the demo on the hardware it'll run on", 2400);

  await h.click(page.locator(".placement-card", { hasText: "Mobile app" }));
  await h.click(page.getByRole("button", { name: "Preview the page" }));
  await h.say("Mobile app — a scrollable in-app screen in a real phone frame", 2200);
  const scroll = page.locator(".app-scroll");
  await scroll.hover().catch(() => {});
  await page.mouse.wheel(0, 380);
  await page.waitForTimeout(900);
  await page.mouse.wheel(0, -380);
  await page.waitForTimeout(600);
  await h.hush(); // captions must not linger across format transitions
  await h.click(page.getByRole("button", { name: "← Builder" }));

  await h.click(page.locator(".placement-card", { hasText: "Kiosk" }));
  await h.click(page.getByRole("button", { name: "Preview the page" }));
  await h.say("Kiosk — a freestanding totem with a touch-to-start attract screen", 2400);
  await h.hush();
  await h.click(page.getByRole("button", { name: "← Builder" }));

  await h.click(page.locator(".placement-card", { hasText: "Hologram" }));
  await h.click(page.getByRole("button", { name: "Preview the page" }));
  await h.say("Hologram — a Proto-style holobox the AI human beams into", 2800);
  await h.hush();
  await page.waitForTimeout(700);
}

const SCENES = [
  { name: "01-guided-journey", run: sceneGuidedJourney },
  { name: "02-formats-and-faces", run: sceneFormatsAndFaces },
];

/* ── main ──────────────────────────────────────────────────── */

const { chromium, executablePath } = await getChromium();
if (!existsSync(join(ROOT, "dist", "index.html"))) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const server = spawn("npx", ["vite", "preview", "--port", String(PORT)], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({ executablePath });
const ffmpeg = findFfmpeg();
const produced = [];

try {
  for (const scene of SCENES) {
    console.log(`▶ recording ${scene.name}…`);
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    const h = await makeHelpers(page);
    try {
      await scene.run(page, h);
    } catch (e) {
      console.error(`  scene error (video kept up to this point): ${e.message}`);
    }
    const video = page.video();
    await ctx.close(); // finalizes the webm
    const raw = await video.path();
    const webm = join(OUT, `${scene.name}.webm`);
    renameSync(raw, webm);
    if (ffmpeg) {
      const mp4 = join(OUT, `${scene.name}.mp4`);
      const res = spawnSync(ffmpeg, ["-y", "-i", webm, "-c:v", "libx264", "-crf", "23", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4], { stdio: "ignore" });
      if (res.status === 0) { rmSync(webm); produced.push(mp4); continue; }
      console.error("  ffmpeg transcode failed — keeping webm");
    }
    produced.push(webm);
  }
} finally {
  await browser.close();
  server.kill();
}

console.log("\nDone:");
for (const f of produced) console.log(`  ${f}`);
