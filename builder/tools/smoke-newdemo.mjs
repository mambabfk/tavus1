/* Drives the built Tavus Experience Builder and verifies the New Demo
   generator flow end to end with a mocked backend. */
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE || "http://localhost:4173";
const SHOT = process.env.SMOKE_SHOT || "/tmp/smoke-newdemo-report.png";

const results = [];
let failures = 0;
async function check(name, fn, diagFn) {
  try {
    await fn();
    results.push(`PASS  ${name}`);
    console.log(`PASS  ${name}`);
  } catch (e) {
    failures++;
    let diag = "";
    try { diag = diagFn ? await diagFn() : ""; } catch { /* ignore */ }
    results.push(`FAIL  ${name} — ${e.message}${diag ? `\n      DOM: ${String(diag).slice(0, 500)}` : ""}`);
    console.log(`FAIL  ${name} — ${e.message}`);
    if (diag) console.log(`      DOM: ${String(diag).slice(0, 500)}`);
  }
}

const DEMO_TEMPLATE = {
  conversationName: "USAA / New hire onboarding",
  brand: "USAA",
  headline: "Welcome to USAA",
  tagline: "Your onboarding buddy is ready",
  cta: "Start the conversation",
  greeting: "Welcome aboard — I'm Ava.",
  personaBrief: {
    product: "USAA new-hire onboarding",
    audience: "new hires",
    goal: "Book the IT session",
    tone: "warm",
    emotions: "Warm and upbeat.",
  },
  objectives: ["Learn their role", "if manager -> Show the admin view", "Book the IT session"],
  guardrails: ["Never discuss salary"],
  canvasPlaybook: "Open with a welcome card",
  visionVibe: "",
  coach: null,
};

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined, // set when not using playwright-managed browsers
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => pageErrors.push(String(e)));

// ── Backend mocks ────────────────────────────────────────────────────────
await page.route("**/api/**", async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const p = url.pathname;
  const json = (obj, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(obj) });

  if (p === "/api/login") {
    // OPEN mode: no password set → { authRequired:false, accounts:false, authed:false }
    return json({ authRequired: false, accounts: false, authed: false, email: null });
  }
  if (p === "/api/generate-persona") {
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* not json */ }
    if (body.kind === "demo") {
      return route.fulfill({ status: 200, contentType: "text/plain", body: JSON.stringify(DEMO_TEMPLATE) });
    }
    // the auto persona draft (kind absent) and everything else → plain text stream
    return route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "## Identity & Role\nYou are Ava, USAA's onboarding buddy for new hires.",
    });
  }
  if (p === "/api/scenarios") return json({});           // no cloud names, no draft
  if (p === "/api/voices") return json({ voices: [] });
  if (p === "/api/tts") return json({});
  if (p === "/api/dictate") return json({ available: false });
  if (p === "/api/blob-upload") return json({});
  if (p === "/api/recordings") return json({});
  if (p === "/api/experience") return json({});
  if (p === "/api/brand-theme") return json({}, 500);    // must never be called (URL left empty)
  return json({});
});

await page.goto(BASE, { waitUntil: "networkidle" });

const rail = (label) => page.locator(".rail-btn", { has: page.locator(".rail-label", { hasText: label }) }).first();
const railExact = (label) =>
  page.locator(".rail-btn").filter({ has: page.getByText(label, { exact: true }) }).first();

// ── (a) Account step: API key + PAL ID ──────────────────────────────────
await railExact("Account").click();
await page.getByPlaceholder("tvs-…").fill("tvs-test");
const palInput = page.getByPlaceholder(/^p… /); // "p… (or create one in the Persona step)"
await check("a. PAL ID field visible on Account step", async () => {
  if (!(await palInput.count())) throw new Error("no input with placeholder starting 'p…'");
});
await palInput.fill("p12345test");

// ── (b) New Demo step: fill the questionnaire ────────────────────────────
await railExact("New Demo").click();
const q1 = page.getByPlaceholder(/^They come in nervous on day one/);
await q1.fill("An onboarding buddy for Acme new hires — books the IT session at the end.");
await page.getByPlaceholder(/^e\.g\. "the first call our SDRs/).fill("day-one HR onboarding at Acme");
await page.getByPlaceholder(/^e\.g\. "anything about salary/).fill("anything about salary or visas");
// website field stays EMPTY → brand-theme never called

// ── (c) Feature checklist ────────────────────────────────────────────────
const featureBtn = (label) => page.locator("button.pill-btn", { hasText: label }).first();
await check("c. Magic Canvas feature shows ✓ by default", async () => {
  const t = await featureBtn("Magic Canvas").innerText();
  if (!t.includes("✓")) throw new Error(`button text: ${JSON.stringify(t)}`);
});
await check("c. Email gate feature shows ✓ by default", async () => {
  const t = await featureBtn("Email gate").innerText();
  if (!t.includes("✓")) throw new Error(`button text: ${JSON.stringify(t)}`);
});
await featureBtn("Coach scorecard").click();
await check("c. Coach scorecard toggled ON (✓)", async () => {
  const t = await featureBtn("Coach scorecard").innerText();
  if (!t.includes("✓")) throw new Error(`button text: ${JSON.stringify(t)}`);
});

// ── (d) Build my demo → report card ──────────────────────────────────────
await page.getByRole("button", { name: "✨ Build my demo" }).click();
await check("d. 'What got built' report card appears", async () => {
  await page.getByText("What got built").waitFor({ timeout: 20000 });
}, () => page.locator(".idea-box").innerText());

// the "What got built" label div's PARENT is the report card container
const reportBox = page.getByText("What got built", { exact: true }).locator("xpath=..");
const fullReport = await reportBox.innerText().catch(() => "");

// ── (e) Report content assertions ────────────────────────────────────────
const assertReport = (name, re) =>
  check(`e. report: ${name}`, async () => {
    if (!re.test(fullReport)) throw new Error(`not found: ${re}`);
  }, () => fullReport);
await assertReport("page copy for USAA", /Page copy \+ greeting drafted for USAA/);
await assertReport("objectives 3 steps", /Objectives: 3 steps chained/);
await assertReport("guardrails 1 rule", /Guardrails: 1 rule/);
await assertReport("Magic Canvas on — card plan drafted", /Magic Canvas on — card plan drafted/);
await assertReport("Coach on — 🔶 draft-the-scorecard line", /🔶\s*Coach on — ✨ draft the scorecard on the Experience step/);

// (email gate is implied — the feature button stays ✓ and expEmailGate is set; no report line exists)
await check("e. Email gate feature still shows ✓ after draft", async () => {
  const t = await featureBtn("Email gate").innerText();
  if (!t.includes("✓")) throw new Error(`button text: ${JSON.stringify(t)}`);
});

// screenshot of the report card state (scrolled into view)
await reportBox.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: SHOT, fullPage: false });

// ── (f) Goals & Rules (Objectives & Guardrails step) ─────────────────────
await railExact("Objectives & Guardrails").click();
const objTa = page.getByPlaceholder(/^Ask which product they're evaluating/);
await check("f. objectives textarea has the 3 lines with indented branch", async () => {
  const v = await objTa.inputValue();
  if (!v.includes("Learn their role")) throw new Error(`missing 'Learn their role' in ${JSON.stringify(v)}`);
  if (!v.includes("\n  if manager -> Show the admin view")) throw new Error(`branch line not indented: ${JSON.stringify(v)}`);
  if (!v.includes("Book the IT session")) throw new Error(`missing final step: ${JSON.stringify(v)}`);
}, () => objTa.inputValue());
const grTa = page.getByPlaceholder(/^Never discuss competitors/);
await check("f. guardrails textarea contains 'Never discuss salary'", async () => {
  const v = await grTa.inputValue();
  if (!v.includes("Never discuss salary")) throw new Error(`value: ${JSON.stringify(v)}`);
}, () => grTa.inputValue());

// ── (g) Persona step ─────────────────────────────────────────────────────
await railExact("Persona").click();
const vibeTa = page.getByPlaceholder(/^e\.g\. A warm, sharp intake specialist/);
const draftTa = page.getByPlaceholder("You are…");
await check("g. persona vibe box + draft carry content", async () => {
  const vibe = await vibeTa.inputValue().catch(() => "");
  const draft = await draftTa.inputValue().catch(() => "");
  if (!vibe.trim() && !draft.includes("You are Ava")) {
    throw new Error(`vibe=${JSON.stringify(vibe)} draft=${JSON.stringify(draft.slice(0, 120))}`);
  }
});
await check("g. persona draft contains the mocked stream 'You are Ava'", async () => {
  await page.waitForFunction(
    () => [...document.querySelectorAll("textarea")].some((t) => t.value.includes("You are Ava")),
    null, { timeout: 15000 }
  );
}, () => draftTa.inputValue());

// ── (h) Account step: PAL ID survived the net-new reset ──────────────────
await railExact("Account").click();
await check("h. PAL ID still 'p12345test' after the reset", async () => {
  const v = await page.getByPlaceholder(/^p… /).inputValue();
  if (v !== "p12345test") throw new Error(`value: ${JSON.stringify(v)}`);
});

// ── (j) greeting field on Account step ───────────────────────────────────
await check("j. greeting field contains \"Welcome aboard — I'm Ava.\"", async () => {
  const v = await page.getByPlaceholder(/^Hi — I'm ready to walk you through/).inputValue();
  if (!v.includes("Welcome aboard — I'm Ava.")) throw new Error(`value: ${JSON.stringify(v)}`);
});

// ── (i) Magic Canvas step toggle + playbook, Experience coach toggle ─────
await railExact("Magic Canvas").click();
await check("i. Magic Canvas toggle is ON", async () => {
  const pressed = await page.locator(".skill-head .toggle").first().getAttribute("aria-pressed");
  if (pressed !== "true") throw new Error(`aria-pressed=${pressed}`);
}, () => page.locator(".skill-head").first().innerText());
await check("i. canvas playbook contains 'welcome card'", async () => {
  const v = await page.getByPlaceholder(/^e\.g\. Open with a question card/).inputValue();
  if (!v.toLowerCase().includes("welcome card")) throw new Error(`value: ${JSON.stringify(v)}`);
});

await railExact("Experience").click();
await check("i. Coach mode toggle is ON (Experience step)", async () => {
  const head = page.locator(".skill-head", { hasText: "Coach mode" }).first();
  const pressed = await head.locator(".toggle").getAttribute("aria-pressed");
  if (pressed !== "true") throw new Error(`aria-pressed=${pressed}`);
}, async () => page.locator(".skill-head", { hasText: "Coach mode" }).first().innerText());

// ── Summary ──────────────────────────────────────────────────────────────
console.log("\n===== SUMMARY =====");
results.forEach((r) => console.log(r));
console.log(`\n${results.length - failures}/${results.length} assertions passed`);
if (pageErrors.length) console.log("\nPAGE ERRORS:\n" + pageErrors.join("\n"));
if (consoleErrors.length) console.log("\nCONSOLE ERRORS:\n" + consoleErrors.slice(0, 20).join("\n"));
if (!pageErrors.length && !consoleErrors.length) console.log("\nNo page/console errors.");

await browser.close();
process.exit(failures ? 1 : 0);
