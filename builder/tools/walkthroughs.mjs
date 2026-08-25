/* Auto-builds video walkthrough assets by driving the real built app with
   Playwright and recording the browser: scripted cursor, real typing,
   caption overlays. Re-run after feature changes to refresh the videos.

   Usage:  npm run build && node tools/walkthroughs.mjs
           (or `npm run walkthroughs`)
   Output: walkthroughs/<scene>.webm — transcoded to .mp4 only when
           $FFMPEG_PATH (or an `ffmpeg` on PATH) can encode H.264;
           Playwright's bundled ffmpeg is VP8-only, so .webm is the norm.

   The backend is fully mocked (page.route) — no Tavus/Anthropic calls are
   made. Scenes that need a "built demo" seed one through the app's own
   cloud-draft restore (`GET /api/scenarios?draft=1`), exactly the payload
   `collectConfig()` produces.

   Browser resolution: $CHROMIUM_PATH, else /opt/pw-browsers/chromium
   (a symlink kept by the image), else the `playwright` package's own
   chromium. */

import { spawnSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "walkthroughs");
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const SIZE = { width: 1440, height: 900 };

/* ── toolchain ─────────────────────────────────────────────── */

async function getChromium() {
  const candidates = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"].filter(Boolean);
  const exe = candidates.find((p) => existsSync(p));
  if (exe) {
    const pw = await import("playwright-core");
    return { chromium: pw.chromium, executablePath: exe };
  }
  try {
    const pw = await import("playwright");
    return { chromium: pw.chromium, executablePath: undefined };
  } catch {
    throw new Error("No chromium found — set CHROMIUM_PATH or `npm i -D playwright && npx playwright install chromium`.");
  }
}

// H.264-capable ffmpeg only — Playwright's bundled ffmpeg is VP8-only and
// can't produce the mp4 we'd want, so we don't even try it.
function findFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  return spawnSync("ffmpeg", ["-version"]).status === 0 ? "ffmpeg" : null;
}

/* ── static SPA server for dist/ (same pattern as smoke-serve) ── */

function serveDist(port) {
  const root = join(ROOT, "dist");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(root, urlPath);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, "index.html");
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

/* ── mock backend fixtures ─────────────────────────────────── */

// What `kind:"demo"` returns — mirrors the shape DEMO_SYSTEM emits. One
// "if …" branch entry (indented on apply), 4 guardrails for the prune
// list, a canvas playbook and a greeting.
const DEMO_TEMPLATE = {
  conversationName: "USAA / New hire onboarding",
  brand: "USAA",
  headline: "Welcome to day one at USAA",
  tagline: "Your onboarding buddy is ready when you are",
  cta: "Start the conversation",
  greeting: "Welcome aboard — I'm Ava, your onboarding buddy. First things first: what team are you joining?",
  personaBrief: {
    product: "USAA new-hire onboarding",
    audience: "new hires on their first day",
    goal: "Get them set up and book the IT session",
    tone: "warm, unhurried",
    emotions: "Warm and upbeat — day one should feel exciting.",
  },
  objectives: [
    "Welcome them and learn what team they're joining",
    "if they are a people manager -> Show the manager onboarding track",
    "Get their laptop and accounts sorted",
    "Walk benefits enrollment together",
    "Book their IT setup session",
  ],
  guardrails: [
    "Never discuss salary, equity, or individual compensation",
    "Never give visa or immigration advice — offer a hand-off to HR",
    "Don't invent policy details — say you'll check when unsure",
    "If they mention a medical issue, point to the benefits hotline instead of advising",
  ],
  canvasPlaybook: "Open with a welcome card naming their team. Show a checklist card during laptop setup. When benefits come up, show the three plan tiers as a question card.",
  visionVibe: "",
  coach: null,
};

const PERSONA_TEXT = [
  "## Identity & Role",
  "You are Ava, USAA's onboarding buddy for new hires. You replace the day-one HR walkthrough — warm, organized, never rushed.",
  "",
  "## Personality & Conversational Style",
  "Base energy: 6/10. SIGNATURE: \"welcome aboard\", \"let's get you sorted\". NEVER-USE: corporate jargon, \"synergy\".",
  "",
  "## Core Behaviors",
  "- Learn their team before anything else.",
  "- Walk benefits enrollment step by step; pause for questions.",
  "- Always end by booking the IT setup session.",
  "",
  "## Guardrails & Constraints",
  "- Salary, equity, visas: hand off to HR gracefully.",
].join("\n");

const REHEARSAL = {
  transcript: [
    { role: "ai", text: "Welcome aboard — I'm Ava, your onboarding buddy. First things first: what team are you joining?" },
    { role: "visitor", text: "Hi! I'm joining the claims engineering team on Monday." },
    { role: "ai", text: "Claims engineering — great group. Let's get you sorted. Has a laptop shipped to you yet, or is that still pending?" },
    { role: "visitor", text: "Nothing's arrived yet. Also, how does the healthcare enrollment work?" },
    { role: "ai", text: "I'll flag the laptop with IT right now. On healthcare — there are three plan tiers, and you have 30 days to enroll. Want the two-minute version of each?" },
    { role: "visitor", text: "Sure. Which one do most engineers pick?" },
    { role: "ai", text: "Most pick the mid tier — low deductible, good HSA match. The top tier only wins if you have dependents. Does that fit your situation?" },
    { role: "visitor", text: "Mid tier sounds right. Oh — can I ask what the salary band for my level is?" },
    { role: "ai", text: "That one's for a human — comp questions go to your HR partner, and I can drop a note so they reach out today. Now, last thing: let's book your IT setup session. Tuesday 10am or Wednesday 2pm?" },
    { role: "visitor", text: "Tuesday at 10 works. Thanks, Ava!" },
  ],
};

const COACH_CARD = {
  title: "The Storm-Chaser Shadow · Mark Whitaker",
  scene: "Mark Whitaker is about to open the door. Last spring a storm chaser took his deposit and vanished.",
  talkHint: "Keep him talking — he'll tell you exactly what went wrong.",
  criteria: [
    { label: "Acknowledged the bad experience before responding", keywords: "" },
    { label: "Asked what happened instead of pitching over it", keywords: "" },
    { label: "Offered something he can independently verify", keywords: "license, reviews, references" },
    { label: "Asked for a specific inspection time", keywords: "inspection, tuesday, morning" },
  ],
};

// A "built demo" — the exact shape collectConfig() saves, restored through
// the app's own cloud-draft path so seeded scenes start from a real state.
const SEEDED_CONFIG = {
  v: 1,
  faceId: "r79e1c033f",
  palId: "p8d2f9c1a4",
  conversationName: "USAA / New hire onboarding",
  greeting: DEMO_TEMPLATE.greeting,
  personaBrief: { vibe: "A warm onboarding buddy for USAA new hires — replaces the day-one HR walkthrough, ends by booking the IT setup session." },
  personaDraft: PERSONA_TEXT,
  objectivesEnabled: true,
  objectivesText: [
    "Welcome them and learn what team they're joining",
    "  if they are a people manager -> Show the manager onboarding track",
    "Get their laptop and accounts sorted",
    "Walk benefits enrollment together",
    "Book their IT setup session",
  ].join("\n"),
  guardrailsEnabled: true,
  guardrailsText: DEMO_TEMPLATE.guardrails.join("\n"),
  canvasEnabled: true,
  canvasPlaybook: DEMO_TEMPLATE.canvasPlaybook,
  demoReplacing: "day-one HR onboarding",
  demoHandoff: "anything about salary or visas",
  site: { brand: "USAA", headline: DEMO_TEMPLATE.headline, tagline: DEMO_TEMPLATE.tagline, cta: "Start the conversation", format: "desktop" },
  expEmailGate: true,
  expRating: true,
  scCards: [],
};

// Scene 8 seeds one saved walkthrough so the rail shows its ▶ badge.
const WALKTHROUGH_LIB = {
  canvas: {
    url: "https://demo-assets.example.com/walkthroughs/magic-canvas.mp4",
    narration: "This is Magic Canvas — watch the card land the moment she says 'pricing'. It fires off the trigger words, not a timer.",
    updatedAt: "2026-08-20T12:00:00.000Z",
  },
};

/* Mock every /api/** call; abort everything that isn't localhost so
   networkidle never hangs on fonts/analytics. */
async function installMocks(ctx, { seed = null, walkthroughLib = {} } = {}) {
  await ctx.route((url) => !String(url).startsWith("http://localhost"), (route) => route.abort());
  await ctx.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (obj, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(obj) });
    const text = (body) => route.fulfill({ status: 200, contentType: "text/plain", body });

    if (p === "/api/login") return json({ authRequired: false, accounts: false, authed: false, email: null }); // open mode
    if (p === "/api/scenarios") {
      if (req.method() === "GET" && url.searchParams.get("draft") === "1") {
        return json(seed ? { at: "2026-08-25T08:00:00.000Z", active: "", config: seed } : {});
      }
      return json({});
    }
    if (p === "/api/walkthroughs") return req.method() === "GET" ? json(walkthroughLib) : json({});
    if (p === "/api/generate-persona") {
      let body = {};
      try { body = req.postDataJSON() || {}; } catch { /* not json */ }
      if (body.kind === "demo") return text(JSON.stringify(DEMO_TEMPLATE));
      if (body.kind === "rehearse") return text(JSON.stringify(REHEARSAL));
      if (body.kind === "coach") return text(JSON.stringify(COACH_CARD));
      return text(PERSONA_TEXT); // the auto persona draft (kind absent) & everything else
    }
    if (p === "/api/dictate") return json({ available: false });
    if (p === "/api/voices") return json({ voices: [] });
    if (p === "/api/tts") return json({ available: false });
    return json({});
  });
}

/* ── on-page overlay: caption bar + visible cursor ─────────── */

const OVERLAY = () => {
  if (document.getElementById("__wt_cursor")) return;
  const c = document.createElement("div");
  c.id = "__wt_cursor";
  c.style.cssText = "position:fixed;left:70px;top:70px;width:22px;height:22px;border-radius:50%;background:rgba(240,90,60,.85);box-shadow:0 0 0 5px rgba(240,90,60,.25);z-index:999999;pointer-events:none;transform:translate(-50%,-50%);transition:left .55s cubic-bezier(.3,.8,.3,1),top .55s cubic-bezier(.3,.8,.3,1),transform .15s ease;";
  document.body.appendChild(c);
  const t = document.createElement("div");
  t.id = "__wt_caption";
  t.style.cssText = "position:fixed;left:50%;bottom:36px;transform:translateX(-50%);max-width:76%;background:rgba(20,20,22,.92);color:#fff;font:600 20px/1.45 'Instrument Sans',system-ui,sans-serif;padding:14px 26px;border-radius:14px;z-index:999998;pointer-events:none;opacity:0;transition:opacity .35s ease;text-align:center;box-shadow:0 10px 34px rgba(0,0,0,.35);";
  document.body.appendChild(t);
};

async function makeHelpers(page) {
  const install = () => page.evaluate(OVERLAY).catch(() => {});
  await install();
  const say = async (text, holdMs = 2300) => {
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
    await page.waitForTimeout(620);
  };
  // moveTo only moves the painted cursor — hover() actually fires the
  // app's mouseenter handlers (the anatomy hub's dots bloom off those).
  const hover = async (loc) => {
    await moveTo(loc);
    await loc.hover().catch(() => {});
  };
  const click = async (loc) => {
    await moveTo(loc);
    await page.evaluate(() => { document.getElementById("__wt_cursor").style.transform = "translate(-50%,-50%) scale(.62)"; });
    await page.waitForTimeout(150);
    await loc.click();
    await page.evaluate(() => { const c = document.getElementById("__wt_cursor"); if (c) c.style.transform = "translate(-50%,-50%)"; }).catch(() => {});
    await install(); // page content may have re-rendered a fresh <body> subtree
    await page.waitForTimeout(480);
  };
  const type = async (loc, text, delay = 24) => {
    await click(loc);
    await loc.pressSequentially(text, { delay });
    await page.waitForTimeout(380);
  };
  return { say, hush, moveTo, hover, click, type };
}

/* ── shared locators ───────────────────────────────────────── */

const rail = (page, label) =>
  page.locator(".rail-btn").filter({ has: page.getByText(label, { exact: true }) }).first();

async function openApp(page, { waitSeed = false } = {}) {
  const restored = waitSeed
    ? page.waitForResponse((r) => r.url().includes("/api/scenarios?draft=1"), { timeout: 15000 }).catch(() => null)
    : null;
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".rail-btn").first().waitFor({ timeout: 20000 });
  if (restored) { await restored; await page.waitForTimeout(700); } // let applyConfig commit
}

/* ── scenes ────────────────────────────────────────────────── */

// 1 · The replace-a-flow intake → ✨ Build my demo → the draft report +
//     guardrail prune list.
async function sceneNewDemo(page, h) {
  await h.say("New Demo — describe the conversation you're replacing, and the whole demo gets built", 3000);
  await h.type(page.getByPlaceholder(/^e\.g\. "the first call our SDRs/), "day-one HR onboarding for new hires");
  await h.say("Walk it through like you're training a new hire — this one answer drives everything", 2600);
  await h.type(
    page.getByPlaceholder(/^They come in nervous on day one/),
    "We greet them, find out what team they're on, get the laptop sorted, walk benefits together, and book their IT setup session before they leave."
  );
  await h.say("One safety question: when should a real person take over?", 2400);
  await h.type(page.getByPlaceholder(/^e\.g\. "anything about salary/), "anything about salary or visas");
  await h.say("Check off the features — each becomes a working part of the demo", 2400);
  await h.click(page.locator("button.pill-btn", { hasText: "Coach scorecard" }).first());
  await h.hush();
  await h.click(page.getByRole("button", { name: "✨ Build my demo" }));
  await page.getByText("What got built", { exact: true }).waitFor({ timeout: 30000 });
  const report = page.getByText("What got built", { exact: true }).locator("xpath=..");
  await report.scrollIntoViewIfNeeded().catch(() => {});
  await h.say("The report: page copy, greeting, chained objectives, guardrails — all drafted", 3200);
  await h.moveTo(page.getByText("Rules it drafted — kill any that don't fit", { exact: true }));
  await h.say("Claude drafts the rest of the rules as a prune list — ✕ kills any that don't fit", 2800);
  await h.click(report.locator("button", { hasText: "✕" }).last());
  await h.say("Review the persona next — every word stays editable", 2600);
  await h.hush();
  await page.waitForTimeout(700);
}

// 2 · The "Your AI human" anatomy hub — hover the parts, click into one.
async function sceneAiHuman(page, h) {
  await h.click(rail(page, "Your AI human"));
  await h.say("Your AI human — architected the way a person works in a conversation", 3000);
  const card = (label) => page.locator(".human-card").filter({ hasText: label }).first();
  await h.hover(card("Thinks"));
  await h.say("Thinks — its personality and way of talking", 2200);
  await h.hover(card("Remembers you"));
  await h.say("Remembers you — next call, it picks up where you left off", 2400);
  await h.hover(card("Hears you"));
  await page.waitForTimeout(700);
  await h.hover(card("Did the homework"));
  await h.say("Did the homework — answers come from your docs, not thin air", 2400);
  await h.hover(card("Shows you things"));
  await h.say("Shows you things — decks, a live browser, cards on screen", 2400);
  await h.hover(card("Sees you"));
  await h.say("Every part is a door into its step — click the eyes…", 2200);
  await h.click(card("Sees you"));
  await page.locator("h1", { hasText: "Vision" }).waitFor({ timeout: 10000 });
  await h.say("…and you land on Perception, ready to configure what it notices", 2800);
  await h.hush();
  await page.waitForTimeout(700);
}

// 3 · Magic moments: pin a card to a step of the flow diagram.
async function sceneMagicMoments(page, h) {
  await h.click(rail(page, "Magic Canvas"));
  await h.say("Magic Canvas — your talk track becomes a flow diagram, and you pin visuals to it", 3000);
  await page.locator(".mm-step").first().waitFor({ timeout: 10000 });
  await h.moveTo(page.locator(".mm-step").nth(0));
  await page.waitForTimeout(500);
  const step2 = page.locator(".mm-step").nth(1);
  await h.moveTo(step2);
  await h.say("Each numbered step is one objective of the conversation", 2400);
  await h.click(step2.getByRole("button", { name: "＋ magic moment here" }));
  await h.say("A magic moment is a scripted card — it fires exactly when this step comes up", 2800);
  const card = step2.locator(".mm-card").first();
  await h.moveTo(card.locator("select"));
  await card.locator("select").selectOption("image");
  await page.waitForTimeout(600);
  await h.type(card.getByPlaceholder("Card title"), "Your setup checklist");
  await h.type(card.getByPlaceholder(/^Image URL/), "https://usaa.example.com/setup-checklist.png", 14);
  await h.moveTo(card.getByPlaceholder("Fires when anyone says…"));
  await h.say("Trigger words are pre-filled from the step — the card lands the instant they're spoken", 3200);
  await h.say("No model judgment, no timers — deterministic, on beat, every take", 2600);
  await h.hush();
  await page.waitForTimeout(700);
}

// 4 · Rehearse the conversation: Claude plays both sides, then coach notes.
async function sceneRehearse(page, h) {
  await h.say("After a build, rehearse the conversation before anyone ever joins a call", 2800);
  // Fast-forward the build (instant fill — scene 1 shows the typing).
  await page.getByPlaceholder(/^They come in nervous on day one/)
    .fill("We greet them, find out their team, sort the laptop, walk benefits together, and book the IT setup session.");
  await h.click(page.getByRole("button", { name: "✨ Build my demo" }));
  await page.getByText("What got built", { exact: true }).waitFor({ timeout: 30000 });
  await h.say("Demo built. Now — 🎬 Rehearse the conversation", 2400);
  await h.click(page.getByRole("button", { name: "🎬 Rehearse the conversation" }));
  await page.getByText("Rehearsal — how this demo would play out").waitFor({ timeout: 30000 });
  await h.say("Claude plays BOTH sides faithfully — flaws included — starting from your scripted greeting", 3200);
  const bubbles = page.getByText("Rehearsal — how this demo would play out").locator("xpath=..");
  await bubbles.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(800);
  // Scroll through the transcript so the viewer can read it.
  await bubbles.locator("div").nth(1).evaluate((el) => { el.scrollTop = el.scrollHeight / 2; }).catch(() => {});
  await h.say("Watch it handle the salary question — the hand-off you asked for", 3000);
  await bubbles.locator("div").nth(1).evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
  await page.waitForTimeout(1200);
  await h.say("Not quite right? Give notes like a coach", 2200);
  await h.type(page.getByPlaceholder(/^Give notes like a coach/), "ask about team size before benefits");
  await h.moveTo(page.getByRole("button", { name: "Apply the notes" }));
  await h.say("Apply routes each note automatically — flow → objectives, rules → guardrails, tone → persona", 3400);
  await h.say("Then rehearse again to see the difference. Nothing here touches a live call.", 2800);
  await h.hush();
  await page.waitForTimeout(700);
}

// 5 · Page & Brand: formats, the screenshot facade, approved links.
async function sceneTheirSite(page, h) {
  await h.click(rail(page, "Page & Brand"));
  await h.say("Page & Brand — the launched demo opens on a clean page that reads as THEIR site", 3000);
  const format = (label) => page.locator(".placement-card").filter({ hasText: label }).first();
  await h.moveTo(page.getByText("Format", { exact: true }));
  await h.say("Four formats — preview on the hardware it'll actually run on", 2400);
  await h.hover(format("Mobile app"));
  await page.waitForTimeout(500);
  await h.hover(format("Hologram"));
  await page.waitForTimeout(500);
  await h.click(format("Kiosk"));
  await h.say("Kiosk — a freestanding totem with a touch-to-start attract screen", 2400);
  await h.click(format("Desktop"));
  await h.hush();
  await h.moveTo(page.getByText("📸 Make it their site", { exact: true }));
  await h.say('The reaction that sells is "wait — that\'s OUR site"', 2600);
  await h.moveTo(page.getByText(/then click here and/));
  await h.say("Screenshot their homepage and paste — it becomes the page itself, with the call on top", 3000);
  await h.click(page.getByRole("button", { name: "…or upload a file" }));
  await page.waitForTimeout(600);
  await h.hush();
  await h.say("And for the links it shares: the Approved links catalog, on Magic Canvas", 2800);
  await h.click(rail(page, "Magic Canvas"));
  await h.moveTo(page.getByText("🔗 Approved links", { exact: true }));
  await h.say("The AI may only share URLs listed here — scanned off the live site, never invented", 3200);
  await h.moveTo(page.getByPlaceholder(/^Page to scan/));
  await page.waitForTimeout(900);
  await h.hush();
  await page.waitForTimeout(700);
}

// 6 · Coach mode: toggle on, draft the scorecard, show the filled fields.
async function sceneCoach(page, h) {
  await h.click(rail(page, "Experience"));
  await h.say("Coach mode turns a call into a roleplay trainer — Rilla-style, with live scoring", 2800);
  const head = page.locator(".skill-head", { hasText: "Coach mode" }).first();
  await h.moveTo(head);
  await h.click(head.locator(".toggle"));
  await h.say("Describe what the trainee should practice…", 2200);
  await h.type(page.getByPlaceholder(/^What should they practice\?/), "door-to-door roof sales — homeowner burned by a storm chaser");
  await h.click(page.getByRole("button", { name: "✨ Draft the scorecard" }));
  await page.waitForFunction(
    () => [...document.querySelectorAll("input")].some((i) => i.value.includes("Storm-Chaser")),
    null, { timeout: 20000 }
  );
  await h.say("Claude drafts the scenario: a character, a scene line, and the scorecard", 2800);
  await h.moveTo(page.getByPlaceholder("The Storm-Chaser Shadow · Mark Whitaker"));
  await page.waitForTimeout(600);
  await h.moveTo(page.getByPlaceholder(/^Acknowledged the bad experience/));
  await h.say("Behaviors tick off LIVE — keyword lines instantly, the rest judged by Claude every ~25s", 3400);
  await h.moveTo(page.getByPlaceholder("Keep them talking."));
  await h.say("The final score lands in Results with the call", 2600);
  await h.hush();
  await page.waitForTimeout(700);
}

// 7 · Memory on the Knowledge Base step: per-visitor vs shared store.
async function sceneMemory(page, h) {
  await h.click(rail(page, "Knowledge Base"));
  await h.say("Knowledge is what it KNOWS — Memory is what it REMEMBERS about the person", 3000);
  const head = page.locator(".skill-head", { hasText: "Memory" }).first();
  await h.moveTo(head);
  await h.click(head.locator(".toggle"));
  await h.say('A returning caller picks up where they left off — "welcome back, how did the rollout go?"', 3200);
  await h.click(page.getByRole("button", { name: "One shared memory" }));
  await h.say("One shared memory — kiosk and event setups, accumulating context all day", 2800);
  await h.click(page.getByRole("button", { name: "Per visitor" }));
  await h.say("Per visitor — each person gets their own memory, keyed by their gate email", 2800);
  await h.type(page.getByPlaceholder("acme_onboarding"), "usaa_onboarding");
  await h.say("Name the store once — changing it later starts a blank memory", 2600);
  await h.hush();
  await page.waitForTimeout(700);
}

// 8 · Feature walkthroughs on the Account step (yes — the feature that
//     plays these very videos).
async function sceneWalkthroughs(page, h) {
  await h.click(rail(page, "Account"));
  await h.say("Feature walkthroughs — give any step in the rail a click-play video", 2800);
  await h.moveTo(page.getByText("🎬 Feature walkthroughs", { exact: true }));
  await page.waitForTimeout(600);
  const stepSelect = page.locator("select").filter({ has: page.locator('option[value="canvas"]') }).first();
  await h.moveTo(stepSelect);
  await stepSelect.selectOption("canvas");
  await page.waitForTimeout(700);
  await h.say("Pick a step — Magic Canvas already has one saved, so it shows a ▶", 2800);
  await h.moveTo(page.getByPlaceholder("https://…"));
  await h.say("Upload a Studio take or paste any video URL — an S3 recording, a Loom…", 2800);
  await h.moveTo(page.getByPlaceholder(/^This is Magic Canvas/));
  await h.say("Narration is spoken LIVE by the same voice stack as your calls — swap the video, never re-edit audio", 3400);
  await h.hover(rail(page, "Magic Canvas").locator(".rail-play"));
  await h.say("The ▶ lands in the rail for the whole team", 2600);
  await h.hush();
  await page.waitForTimeout(700);
}

const SCENES = [
  { name: "new-demo", run: sceneNewDemo, seed: null },
  { name: "ai-human", run: sceneAiHuman, seed: SEEDED_CONFIG },
  { name: "magic-moments", run: sceneMagicMoments, seed: SEEDED_CONFIG },
  { name: "rehearse", run: sceneRehearse, seed: null },
  { name: "their-site", run: sceneTheirSite, seed: SEEDED_CONFIG },
  { name: "coach", run: sceneCoach, seed: SEEDED_CONFIG },
  { name: "memory", run: sceneMemory, seed: SEEDED_CONFIG },
  { name: "walkthroughs", run: sceneWalkthroughs, seed: SEEDED_CONFIG, walkthroughLib: WALKTHROUGH_LIB },
];

/* ── verification: size + rough duration via a probe page ──── */

async function probeDuration(browser, file) {
  // Playwright webms often omit the duration header — the classic seek
  // trick makes Chromium compute it. Best-effort; "?" is acceptable.
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    const b64 = fs.readFileSync(file).toString("base64");
    await page.goto("about:blank");
    const dur = await page.evaluate(async (data) => {
      const blob = await (await fetch(`data:video/webm;base64,${data}`)).blob();
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = URL.createObjectURL(blob);
      await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = no; setTimeout(no, 8000); });
      if (Number.isFinite(v.duration)) return v.duration;
      return await new Promise((ok) => {
        v.ondurationchange = () => { if (Number.isFinite(v.duration)) ok(v.duration); };
        v.currentTime = 1e7;
        setTimeout(() => ok(NaN), 8000);
      });
    }, b64).catch(() => NaN);
    return Number.isFinite(dur) ? dur : NaN;
  } catch {
    return NaN;
  } finally {
    await ctx.close();
  }
}

/* ── main ──────────────────────────────────────────────────── */

const { chromium, executablePath } = await getChromium();
if (!existsSync(join(ROOT, "dist", "index.html"))) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const server = await serveDist(PORT);
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const ffmpeg = findFfmpeg();
const produced = [];
let sceneFailures = 0;

try {
  for (const scene of SCENES) {
    console.log(`▶ recording ${scene.name}…`);
    const ctx = await browser.newContext({
      viewport: SIZE,
      recordVideo: { dir: OUT, size: SIZE },
    });
    await installMocks(ctx, { seed: scene.seed, walkthroughLib: scene.walkthroughLib || {} });
    const page = await ctx.newPage();
    page.on("filechooser", () => { /* scene 5 opens one on purpose — swallow it */ });
    try {
      await openApp(page, { waitSeed: !!scene.seed });
      const h = await makeHelpers(page);
      await scene.run(page, h);
    } catch (e) {
      sceneFailures++;
      console.error(`  scene error (video kept up to this point): ${e.message.split("\n")[0]}`);
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

  console.log("\nscene            size      duration");
  console.log("─".repeat(44));
  let verifyFailures = 0;
  for (const f of produced) {
    const name = path.basename(f);
    const size = existsSync(f) ? statSync(f).size : 0;
    const dur = f.endsWith(".webm") ? await probeDuration(browser, f) : NaN;
    const ok = size > 200 * 1024;
    if (!ok) verifyFailures++;
    console.log(`${name.padEnd(20)} ${(size / 1024).toFixed(0).padStart(6)}KB  ${Number.isFinite(dur) ? `~${dur.toFixed(0)}s` : "?"}${ok ? "" : "   ⚠ under 200KB"}`);
  }
  if (verifyFailures || sceneFailures) {
    console.error(`\n${sceneFailures} scene error(s), ${verifyFailures} file(s) under 200KB`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.close();
}

console.log("\nDone:");
for (const f of produced) console.log(`  ${f}`);
