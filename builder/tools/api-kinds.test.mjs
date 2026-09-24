/* Every kind on /api/generate-persona builds its prompt without crashing.
   `const c = context || {}` is declared per-branch, so a branch that uses `c`
   without declaring it throws at REQUEST time — shipped clean through build,
   lint and the browser smoke, and surfaced only as Vercel's
   FUNCTION_INVOCATION_FAILED once someone clicked the button.

   With no ANTHROPIC_API_KEY set, a healthy branch runs its whole
   prompt-building path and stops at the key check. So: 500-with-that-message
   or a deliberate 400 = the branch is sound; anything thrown = it is not. */
import assert from "node:assert";

delete process.env.ANTHROPIC_API_KEY;
const { default: handler } = await import("../api/generate-persona.js");

const img = { media_type: "image/png", data: "iVBORw0KGgo=" };
const CASES = {
  persona:     { vibe: "friendly onboarding guide", brief: { vibe: "friendly" } },
  demo:        { vibe: "replace our onboarding call" },
  revise:      { draft: "You are Ava.", vibe: "warmer", context: { objectives: "greet" } },
  edit:        { vibe: "make the greeting shorter", context: { prompt: "You are Ava.", greeting: "Hi" } },
  flow:        { vibe: "greet, qualify, book" },
  vision:      { vibe: "notice a held-up document", images: [img], context: { objectives: "greet", guardrails: "no pricing" } },
  canvas:      { vibe: "show pricing tiers" },
  cards:       { vibe: "a pricing chart when tiers come up" },
  coach:       { vibe: "cold call practice", context: { objectives: "greet" } },
  score:       { vibe: "TRAINEE: I asked about budget.", context: { criteria: ["Asks about budget"] } },
  rubric:      { vibe: "Enterprise AE. Discovery, objections, close.", context: { role: "AE", objectives: "greet" } },
  grade:       { vibe: "CANDIDATE: I ask about their process.", context: { role: "AE", rubric: [{ label: "Discovery", good: "asks first" }] } },
  talktrack:   { vibe: "five slides on user management", images: [img], context: { slideCount: 1 } },
  browserflow: { vibe: "show the pricing page", context: { flows: [] } },
  script:      { vibe: "a demo of the deck" },
  duet:        { vibe: "two hosts discussing onboarding" },
  promote:     { draft: "You are Ava, co-hosting.", vibe: "make it a live demo" },
  rehearse:    { vibe: "run the call", context: { prompt: "You are Ava.", greeting: "Hi" } },
  spinup:      { vibe: "a quick demo" },
};

let failed = 0;
for (const [kind, body] of Object.entries(CASES)) {
  let status = 200, out = "";
  const res = {
    status(c) { status = c; return this; },
    json(j) { out += JSON.stringify(j); },
    setHeader() {}, write(t) { out += t; }, end(t) { if (t) out += t; },
    headersSent: false,
  };
  try {
    await handler({ method: "POST", body: { kind, ...body }, headers: {}, url: "/api/generate-persona" }, res);
    const reached = /ANTHROPIC_API_KEY/.test(out);
    const rejected = status === 400;
    if (reached || rejected) {
      console.log(`PASS  ${kind}${rejected ? " (400, validated)" : ""}`);
    } else {
      failed++;
      console.log(`FAIL  ${kind} → ${status} ${out.slice(0, 120)}`);
    }
  } catch (e) {
    failed++;
    console.log(`FAIL  ${kind} → ${e.name}: ${e.message}`);
  }
}
assert.equal(failed, 0, `${failed} kind(s) crash or never reach the model`);
console.log(`\nALL PASS — ${Object.keys(CASES).length} generate-persona kinds build their prompts`);
