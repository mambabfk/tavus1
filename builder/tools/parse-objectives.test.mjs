/* Executes the REAL parseObjectives from the app source against the shapes
   that caused live-call loops. Exit 1 on any violated invariant. Run:
   node tools/parse-objectives.test.mjs */
import fs from "fs";

const src = fs.readFileSync(new URL("../src/TavusExperienceBuilder.jsx", import.meta.url), "utf8");
const start = src.indexOf("const slugName =");
const end = src.indexOf("return items;\n};", start);
if (start < 0 || end < 0) { console.error("FAIL extraction markers not found — did parseObjectives move?"); process.exit(1); }
const fn = new Function(`${src.slice(start, end + "return items;\n};".length)}; return parseObjectives;`)();

let failures = 0;
const test = (label, text, checks) => {
  const items = fn(text, "auto");
  const names = new Set(items.map((i) => i.objective_name));
  const problems = [];
  for (const it of items) {
    for (const t of [it.next_required_objective, ...Object.keys(it.next_conditional_objectives || {})].filter(Boolean))
      if (!names.has(t)) problems.push(`dangling target ${it.objective_name} → ${t}`);
    if (it.next_conditional_objectives && !Object.values(it.next_conditional_objectives).some((l) => /any other case/i.test(l)))
      problems.push(`no catch-all on ${it.objective_name}`);
  }
  try { checks(items); } catch (e) { problems.push(e.message); }
  if (problems.length) { failures++; console.log(`FAIL  ${label}\n      ${problems.join("\n      ")}`); }
  else console.log(`PASS  ${label}`);
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

test("branch mid-flow rejoins with catch-all",
  "Ask what brings them in\n  if they mention returns -> Handle the return\nOffer the loyalty program",
  (it) => assert(it.length === 3 && it[0].next_conditional_objectives, "expected 3 items with a conditional map"));
test("branch on LAST step gets a wrap node",
  "Ask what brings them in\nBook a visit\n  if they refuse -> Offer email follow-up",
  (it) => assert(it.some((x) => /_wrap$/.test(x.objective_name)), "no synthetic wrap node"));
test("duplicate lines dedupe",
  "Ask their name\nAsk their name\nBook a visit",
  (it) => assert(it.length === 2, `expected 2 items, got ${it.length}`));
test("top-level If stays a step",
  "Greet them\nIf they ask about pricing, redirect to sales\nBook a visit",
  (it) => assert(it.length === 3 && !it[0].next_conditional_objectives, "top-level If was swallowed as a branch"));
test("template-style indented if",
  ["Learn their role", "if manager -> Show the admin view", "Book the IT session"]
    .map((o) => (/^if\s/i.test(o.trim()) ? `  ${o.trim()}` : o.trim())).join("\n"),
  (it) => assert(it[0].next_conditional_objectives && it.length === 3, "indented template branch didn't compile"));
test("single line is a valid one-step flow",
  "Just have a nice open chat",
  (it) => assert(it.length === 1 && !it[0].next_required_objective, "unexpected chain on single step"));

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
