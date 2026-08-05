import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useDaily } from "@daily-co/daily-react";
import DailyIframe from "@daily-co/daily-js";
import { upload as blobUpload } from "@vercel/blob/client";

/* ─────────────────────────────────────────────────────────────
   Tavus Experience Builder — Alto edition
   Styled to approximate Alto (Tavus Design System): warm light
   canvas, white cards, hairline borders, large radii, black pill
   actions, peach accent. All tokens live in :root below — paste
   real Alto values there to match exactly.
   ───────────────────────────────────────────────────────────── */

const API_BASE = "https://tavusapi.com/v2";

const LANGUAGES = [
  "multilingual", "english", "spanish", "french", "german", "portuguese",
  "italian", "dutch", "polish", "swedish", "turkish", "russian",
  "chinese", "japanese", "korean", "hindi",
];

const CANVAS_COMPONENTS = [
  { key: "question", label: "Question", desc: "Multiple-choice cards; answers flow back to the PAL and your webhook." },
  { key: "input", label: "Input", desc: "Free-form input fields the user can type into mid-conversation." },
  { key: "calendar", label: "Calendar", desc: "Date and time-slot pickers; availability comes from PAL context or tools." },
  { key: "text", label: "Text", desc: "Supporting text or markdown cards shown beside the PAL." },
  { key: "chart", label: "Chart", desc: "Bar, line, or pie charts the PAL renders on the fly." },
  { key: "alert", label: "Alert", desc: "Info / success / warning / error notices with optional auto-dismiss." },
  { key: "scheduling_embed", label: "Scheduling", desc: "Your live Calendly page embedded in-call for real booking. Needs a URL below to activate." },
];

const STEPS = [
  { id: "start", label: "New Demo", group: "Start" },
  { id: "setup", label: "Account", group: "Start" },
  { id: "persona", label: "Persona", group: "The AI human" },
  { id: "guide", label: "Objectives & Guardrails", group: "The AI human" },
  { id: "vision", label: "Perception", group: "The AI human" },
  { id: "kb", label: "Knowledge Base", group: "The AI human" },
  { id: "presentation", label: "Presentation", group: "The experience" },
  { id: "canvas", label: "Magic Canvas", group: "The experience" },
  { id: "speech", label: "Voice", group: "The experience" },
  { id: "site", label: "Page & Brand", group: "The experience" },
  { id: "experience", label: "Experience", group: "The experience" },
  { id: "tools", label: "Integrations", group: "Run it" },
  { id: "controls", label: "Timing", group: "Run it" },
  { id: "launch", label: "Launch & Share", group: "Run it" },
  { id: "studio", label: "Studio", group: "Run it" },
  { id: "calls", label: "Results", group: "Run it" },
];

/* Tavus-hosted LLMs available for a PAL's brain (layers.llm.model). */
const PAL_LLMS = [
  { v: "tavus-glm-4.7", label: "GLM 4.7 — recommended", desc: "Best overall: fast, smart, 200K context." },
  { v: "tavus-gpt-5.2", label: "GPT 5.2", desc: "Strong reasoning; latency less critical." },
  { v: "tavus-claude-haiku-4.5", label: "Claude Haiku 4.5", desc: "Quick and capable." },
  { v: "tavus-gemini-3-flash", label: "Gemini 3 Flash", desc: "Fast, current Gemini." },
  { v: "tavus-gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Low latency." },
  { v: "tavus-gpt-oss", label: "GPT-OSS", desc: "Snappiest, lightweight fallback." },
];

/* Formats the Knowledge Base can turn into presentation slides. */
const PRESENTABLE = /\.(pdf|png|jpe?g|pptx)(\?|#|$)/i;

/* Face presets — the team's go-to stock faces, one click instead of hunting
   down the r… ID every time. The free-text field still takes any face ID. */
const FACE_PRESETS = [
  { name: "Kelly", vibe: "casual", id: "r862e3a3c5e0" },
  { name: "Mark", vibe: "casual", id: "rcea962f9f9b" },
  { name: "Celine", vibe: "casual", id: "r1a0108fbd75" },
  { name: "Gloria", vibe: "warm", id: "r3f427f43c9d" },
];

const SITE_FORMATS = [
  { v: "desktop", label: "Desktop", desc: "Full page — headline, tagline, wide 16:9 stage. The default." },
  { v: "phone", label: "Mobile app", desc: "A scrollable in-app screen inside a real phone frame — how it feels living in your app." },
  { v: "kiosk", label: "Kiosk", desc: "A freestanding kiosk totem with a touch-to-start attract screen. Go live for real kiosk hardware." },
  { v: "hologram", label: "Hologram", desc: "A Proto-style holobox — white enclosure, glowing life-size screen the AI beams into." },
];

/* Video URL → embeddable source for journey video steps. YouTube/Loom/Vimeo
   share links become embeds; direct media files play in a <video> tag;
   anything else iframes as-is. */
function videoEmbed(url) {
  const u = String(url || "").trim();
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return { kind: "file", src: u };
  let m = u.match(/youtube\.com\/watch\?.*v=([\w-]{6,20})/) || u.match(/youtu\.be\/([\w-]{6,20})/) || u.match(/youtube\.com\/shorts\/([\w-]{6,20})/);
  if (m) return { kind: "iframe", src: `https://www.youtube.com/embed/${m[1]}` };
  m = u.match(/loom\.com\/(?:share|embed)\/([a-f0-9]{16,40})/i);
  if (m) return { kind: "iframe", src: `https://www.loom.com/embed/${m[1]}` };
  m = u.match(/vimeo\.com\/(\d{6,12})/);
  if (m) return { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}` };
  return { kind: "iframe", src: u };
}

/* Weave a completed pre-call journey into a conversation payload: context
   lines from the visitor's answers, plus greeting/PAL overrides when they
   picked a persona. Mirrored server-side in api/demo-launch.js for shared
   links — keep the two in sync. */
function applyJourneyPrefs(payload, journeyArr, prefs) {
  if (!prefs || !Array.isArray(prefs.answers) || !Array.isArray(journeyArr)) return payload;
  const out = { ...payload };
  const lines = [];
  prefs.answers.slice(0, 12).forEach((ans) => {
    const s = journeyArr[ans.step];
    if (!s) return;
    if (s.type === "question") {
      const opt = s.options?.[ans.option];
      if (typeof opt === "string") lines.push(`- ${s.prompt} → ${opt}`);
    } else if (s.type === "input") {
      const text = String(ans.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (text) lines.push(`- ${s.prompt} → "${text}"`);
    } else if (s.type === "personas") {
      const o = s.options?.[ans.option];
      if (!o) return;
      lines.push(`- Chosen experience: ${o.label}`);
      if (o.context) lines.push(String(o.context));
      if (o.greeting) out.custom_greeting = String(o.greeting);
      if (o.palId && /^p[a-z0-9_-]{3,60}$/i.test(String(o.palId))) out.pal_id = String(o.palId);
    }
  });
  if (prefs.email) lines.push(`- Email they provided: ${String(prefs.email).trim().slice(0, 200)}`);
  if (lines.length) {
    const intro = "Pre-call setup from this visitor (personalize with it naturally — never recite it back as a list):";
    out.conversational_context = [out.conversational_context, `${intro}\n${lines.join("\n")}`].filter(Boolean).join("\n\n");
  }
  return out;
}

/* Turn a plain-English line into an API-safe objective/guardrail name */
const slugName = (text, prefix, i) => {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return `${prefix}_${i + 1}_${s || "item"}`;
};

/* Objectives DSL → Tavus objective graph.
   - Top-level lines are the main flow, chaining in order (next_required_objective).
   - Indented "if <condition> -> <objective>" lines under a step become
     next_conditional_objectives branches (Tavus if/then routing). Branch
     detours rejoin the main flow at the next top-level step, and a catch-all
     to that step is added automatically so an uncovered answer never stalls
     the conversation (docs recommend always having a catch-all path).
   - Legacy: a "| var1, var2" suffix still extracts output_variables (kept for
     old saved scenarios) but the syntax is no longer surfaced in the UI. */
const parseObjectives = (text, confirmationMode) => {
  const applyVars = (item, varsPart) => {
    if (!varsPart) return;
    const vars = varsPart.split(",").map((v) => v.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")).filter(Boolean);
    if (vars.length) item.output_variables = vars;
  };
  const slugCore = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "item";

  // Pass 1: group lines into main steps + their branches.
  const mains = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const indented = /^\s/.test(raw);
    const line = raw.trim().replace(/^(?:->|→)\s*/, "");
    const branch = line.match(/^if\s+(.+?)\s*(?:->|→|:)\s*(.+)$/i);
    if (branch && (indented || mains.length) && mains.length) {
      const [p, v] = branch[2].split("|").map((s) => s.trim());
      if (p) mains[mains.length - 1].branches.push({ condition: branch[1].trim(), prompt: p.slice(0, 1000), vars: v });
      continue;
    }
    const [p, v] = line.split("|").map((s) => s.trim());
    if (p) mains.push({ prompt: p.slice(0, 1000), vars: v, branches: [] });
  }

  // Pass 2: emit the graph — branches sit right after their parent step.
  mains.forEach((m, i) => { m.name = slugName(m.prompt, "obj", i); });
  const items = [];
  mains.forEach((m, i) => {
    const nextMain = mains[i + 1] || null;
    const item = { objective_name: m.name, objective_prompt: m.prompt, confirmation_mode: confirmationMode };
    applyVars(item, m.vars);
    if (m.branches.length) {
      const cond = {};
      m.branches.forEach((b, k) => {
        b.name = `obj_${i + 1}_if${k + 1}_${slugCore(b.prompt)}`;
        cond[b.name] = `If ${b.condition}`;
      });
      if (nextMain) cond[nextMain.name] = "In any other case";
      item.next_conditional_objectives = cond; // mutually exclusive with next_required
    } else if (nextMain) {
      item.next_required_objective = nextMain.name;
    }
    items.push(item);
    m.branches.forEach((b) => {
      const bItem = { objective_name: b.name, objective_prompt: b.prompt, confirmation_mode: confirmationMode };
      applyVars(bItem, b.vars);
      if (nextMain) bItem.next_required_objective = nextMain.name; // detour rejoins the flow
      items.push(bItem);
    });
  });
  return items;
};

/* One guardrail per line. "[visual]" anywhere in the line marks it visual. */
const parseGuardrails = (text) => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const visual = /\[visual\]/i.test(line);
    const prompt = line.replace(/\[visual\]/gi, "").trim().slice(0, 1000);
    return {
      guardrail_name: slugName(prompt, "gr", i),
      guardrail_prompt: prompt,
      modality: visual ? "visual" : "verbal",
    };
  });
};

/* One rule per line: "word = how to say it". Add [ipa] for IPA notation,
   [case] for case-sensitive matching. "=" ":" or "->" all work as separators. */
const parsePronunciation = (text) => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rules = [];
  const seen = new Set();
  for (const line of lines) {
    const ipa = /\[ipa\]/i.test(line);
    const caseSensitive = /\[case\]/i.test(line);
    const cleaned = line.replace(/\[(ipa|case)\]/gi, "").trim();
    const m = cleaned.match(/^(.+?)\s*(?:=|:|->)\s*(.+)$/);
    if (!m) continue;
    const word = m[1].trim().slice(0, 200);
    const pron = m[2].trim().slice(0, 500);
    if (!word || !pron || seen.has(word.toLowerCase())) continue; // API rejects duplicate text
    seen.add(word.toLowerCase());
    const rule = { text: word, pronunciation: pron, type: ipa ? "ipa" : "alias" };
    if (caseSensitive) rule.case_sensitive = true;
    rules.push(rule);
  }
  return rules;
};

/* Parse Claude's vision draft (VISUAL:/AUDIO: sections with "- query" lines). */
const parseVisionDraft = (text) => {
  const visual = [];
  const audio = [];
  let target = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^visual:?\s*$/i.test(line)) { target = visual; continue; }
    if (/^audio:?\s*$/i.test(line)) { target = audio; continue; }
    const m = line.match(/^[-*•]\s*(.+)/);
    if (m && target) target.push(m[1].trim());
  }
  return { visual, audio };
};

/* First few words of a prompt, for consumer-friendly summaries (no slugs). */
const shortLabel = (text, max = 38) =>
  text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;

/* ── Visitor mode: /d/{slug} (or ?demo=slug) renders a shared demo — no
      builder, no login. Config comes from /api/demos; Start creates a fresh
      conversation server-side via /api/demo-launch. ── */
/* The full stylesheet, shared by the builder AND the standalone visitor
   page (/d/ links render VisitorDemo without the builder component, so
   they must carry the styles themselves — unstyled-logo bug). */
const BUILDER_CSS = `
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        /* ── Alto tokens (approximated — paste real values here) ── */
        :root {
          --canvas: #F5F4F1;     /* page background */
          --surface: #FFFFFF;    /* cards, inputs */
          --surface-2: #FAF9F7;  /* subtle fills */
          --border: #E6E4DF;     /* hairline */
          --text: #17181A;       /* primary text */
          --muted: #7A7B74;      /* secondary text (gray-olive) */
          --accent: #FF6B5E;     /* tavus peach */
          --accent-soft: #FFF0EE;
          --ok: #2E9E6B;
          --danger: #D64545;
          --r-lg: 16px; --r-md: 12px; --r-sm: 9px;
          --font: 'Instrument Sans', system-ui, sans-serif;
          --mono: 'JetBrains Mono', monospace;
        }
        * { box-sizing: border-box; }
        .root { min-height:100vh; background:var(--canvas); color:var(--text); font-family:var(--font); font-size:14px; display:flex; flex-direction:column; }

        /* top bar */
        .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 28px; flex-wrap:wrap; }
        .scenario-bar { display:flex; align-items:center; gap:8px; flex:1; justify-content:center; flex-wrap:wrap; }
        .scenario-bar select, .scenario-bar input { width:auto; padding:8px 12px; font-size:13px; border-radius:999px; }
        /* demo library panel + post-launch save prompt */
        .lib-overlay { position:fixed; inset:0; z-index:70; background:rgba(20,20,22,.35); display:flex; align-items:flex-start; justify-content:center; padding:70px 20px 20px; }
        .lib-panel { width:min(640px, 100%); max-height:76vh; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); box-shadow:0 30px 80px -20px rgba(20,20,20,.4); display:flex; flex-direction:column; padding:18px 20px; }
        .lib-head { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
        .lib-head .lib-hint { color:var(--muted); font-size:12px; flex:1; }
        .lib-list { overflow-y:auto; margin-top:6px; }
        .lib-group { font-family:var(--mono); font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); padding:14px 2px 5px; }
        .lib-row { display:flex; align-items:center; gap:9px; padding:7px 10px; border-radius:var(--r-sm); }
        .lib-row:hover { background:var(--surface-2); }
        .lib-name { flex:1; min-width:0; text-align:left; background:none; border:none; font:inherit; font-size:13.5px; font-weight:500; color:var(--text); cursor:pointer; padding:2px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .lib-active { color:var(--ok); font-size:11px; font-weight:600; margin-left:8px; }
        .lib-time { color:var(--muted); font-size:11.5px; flex-shrink:0; }
        .saveprompt { position:fixed; right:20px; bottom:20px; z-index:60; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); box-shadow:0 20px 60px -18px rgba(20,20,20,.4); padding:16px 18px; display:flex; flex-direction:column; gap:9px; width:300px; }
        .saveprompt-sub { color:var(--muted); font-size:12.5px; line-height:1.5; }
        /* duet stage: two AI humans side by side, recorded from the tab */
        .duet-root { position:fixed; inset:0; z-index:55; background:#101114; display:flex; flex-direction:column; }
        .duet-bar { display:flex; align-items:center; gap:14px; padding:12px 18px; color:#e8e9ec; }
        .duet-brand { font-weight:700; font-size:16px; letter-spacing:-.3px; flex:1; }
        .duet-rec { font-family:var(--mono); font-size:12px; color:#ff6b5e; animation:recpulse 1.6s ease-in-out infinite; }
        .duet-stage { flex:1; min-height:0; display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 14px; }
        .duet-frame { width:100%; height:100%; border:none; border-radius:14px; background:#000; }
        .duet-wait { display:flex; align-items:center; justify-content:center; color:#5a5f6a; font-size:13px; font-family:var(--mono); }
        .duet-note { padding:10px 18px 14px; color:#9aa0ab; font-size:13px; text-align:center; min-height:38px; }
        .logo-wrap { display:flex; align-items:center; gap:10px; }
        .logo-word { font-weight:700; font-size:19px; letter-spacing:-.4px; }
        .logo-sub { font-family:var(--mono); font-size:11px; color:var(--muted); background:var(--surface); border:1px solid var(--border); border-radius:999px; padding:4px 10px; }
        .status-pill { font-family:var(--mono); font-size:11px; color:var(--muted); }
        .status-pill b { color:var(--ok); font-weight:500; }

        .layout { display:flex; flex:1; min-height:0; gap:16px; padding:0 16px 16px; }

        /* left rail */
        .rail { width:190px; flex-shrink:0; display:flex; flex-direction:column; gap:4px; padding-top:8px; }
        .rail-btn { display:flex; align-items:center; gap:10px; width:100%; background:none; border:none; color:var(--muted); cursor:pointer; padding:10px 14px; border-radius:var(--r-md); font:inherit; font-weight:500; text-align:left; }
        .rail-btn:hover { background:var(--surface); color:var(--text); }
        .rail-btn.active { background:var(--surface); color:var(--text); border:1px solid var(--border); box-shadow:0 1px 2px rgba(20,20,20,.04); }
        .rail-check { margin-left:auto; color:var(--ok); font-size:11px; }
        .rail-group { font-family:var(--mono); font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); opacity:.75; padding:14px 14px 4px; }
        .rail > div:first-child .rail-group { padding-top:2px; }
        .flow-nav { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:36px; padding-top:18px; border-top:1px solid var(--border); }
        .flow-pos { font-family:var(--mono); font-size:11px; color:var(--muted); }

        /* main card */
        .main { flex:1; min-width:0; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:32px 36px; overflow-y:auto; box-shadow:0 1px 3px rgba(20,20,20,.04); }
        .main h1 { font-size:24px; font-weight:700; letter-spacing:-.5px; margin:0 0 6px; }
        .main .lede { color:var(--muted); margin:0 0 26px; max-width:560px; line-height:1.55; }
        .subhead { font-size:16px; font-weight:600; letter-spacing:-.2px; margin:26px 0 8px; }

        .field { display:flex; flex-direction:column; gap:6px; margin-bottom:18px; max-width:560px; }
        .field-label { font-weight:600; font-size:13px; }
        .field-hint { font-size:12px; color:var(--muted); line-height:1.5; }
        input, select, textarea { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); color:var(--text); padding:10px 13px; font:inherit; outline:none; width:100%; }
        input:focus, select:focus, textarea:focus { border-color:var(--text); }
        input::placeholder, textarea::placeholder { color:#B4B3AD; }
        .mono { font-family:var(--mono); font-size:13px; }
        textarea { resize:vertical; min-height:72px; }

        .skill-head { display:flex; align-items:center; justify-content:space-between; max-width:560px; margin-bottom:4px; }

        .toggle { width:42px; height:24px; border-radius:999px; border:1px solid var(--border); background:var(--surface-2); position:relative; cursor:pointer; flex-shrink:0; padding:0; }
        .toggle-dot { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#C9C8C2; transition:all .15s ease; }
        .toggle-on { background:var(--text); border-color:var(--text); }
        .toggle-on .toggle-dot { left:20px; background:#fff; }

        .seg { display:flex; background:var(--surface-2); border:1px solid var(--border); border-radius:999px; padding:3px; width:fit-content; }
        .seg button { background:none; border:none; color:var(--muted); padding:7px 15px; font:inherit; font-weight:500; cursor:pointer; border-radius:999px; }
        .seg button.on { background:var(--text); color:#fff; }

        .comp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:10px; max-width:800px; }
        .comp-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:14px; display:flex; flex-direction:column; gap:7px; }
        .comp-card.off { opacity:.45; background:var(--surface-2); }
        .comp-top { display:flex; align-items:center; justify-content:space-between; }
        .comp-name { font-weight:600; font-size:14px; }
        .comp-desc { font-size:12px; color:var(--muted); line-height:1.5; }
        .rule-input { margin-top:2px; font-size:12px; padding:7px 10px; border-radius:var(--r-sm); background:var(--surface-2); }

        .placement-row { display:flex; gap:10px; max-width:560px; margin-top:8px; }
        .placement-card { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:12px; cursor:pointer; text-align:center; color:var(--muted); font-size:13px; font-weight:500; }
        .placement-card.on { border-color:var(--text); color:var(--text); box-shadow:0 1px 3px rgba(20,20,20,.06); }
        .face-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
        .face-chip { display:flex; flex-direction:column; align-items:center; gap:2px; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:8px 16px; cursor:pointer; font:inherit; color:var(--muted); }
        .face-chip:hover { color:var(--text); }
        .face-chip.on { border-color:var(--text); color:var(--text); box-shadow:0 1px 3px rgba(20,20,20,.06); }
        .face-chip-name { font-weight:600; font-size:13px; }
        .face-chip-vibe { font-size:10.5px; font-family:var(--mono); }
        /* journey composer (Experience step) */
        .jr-list { display:flex; flex-direction:column; gap:10px; max-width:640px; margin-bottom:12px; }
        .jr-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:12px 14px; }
        .jr-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .jr-num { font-weight:700; font-size:12px; color:var(--muted); }
        .jr-type { font-family:var(--mono); font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); background:var(--surface-2); border-radius:999px; padding:3px 10px; }
        .jr-btns { margin-left:auto; display:flex; gap:2px; }
        .jr-card input, .jr-card textarea { margin-bottom:6px; }
        .jr-opt { border:1px dashed var(--border); border-radius:var(--r-sm); padding:9px 9px 3px; margin-bottom:8px; }
        /* scripted cards (deterministic canvas) */
        .sc-card { width:calc(var(--canvas-panel-w, 340px) - 48px); max-width:100%; background:var(--surface,#fff); border:1px solid var(--border,#E6E4DF); border-radius:16px; padding:18px; box-shadow:0 22px 48px -20px rgba(20,20,20,.30); display:flex; flex-direction:column; gap:12px; }
        .canvas-panel .sc-card { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); }
        .sc-title { font-weight:700; font-size:15px; letter-spacing:-.2px; }
        .sc-note p { margin:0 0 8px; font-size:13.5px; line-height:1.55; }
        .sc-note p:last-child { margin-bottom:0; }
        .sc-chart { display:flex; flex-direction:column; gap:8px; }
        .sc-bar-row { display:grid; grid-template-columns:minmax(56px,38%) 1fr auto; align-items:center; gap:8px; font-size:12px; }
        .sc-bar-label { color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sc-bar-track { background:var(--surface-2,#F0EEE9); border-radius:5px; height:12px; overflow:hidden; }
        .sc-bar { display:block; height:100%; background:var(--accent,#F05A3C); border-radius:5px; }
        .sc-bar-val { font-weight:600; }
        .sc-stat { text-align:center; padding:6px 0; }
        .sc-stat-value { display:block; font-size:36px; font-weight:700; letter-spacing:-1.2px; line-height:1.1; }
        .sc-stat-label { color:var(--muted); font-size:13px; }
        .sc-img { width:100%; border-radius:10px; object-fit:cover; }
        .sc-preview { flex:0 0 260px; background:var(--canvas); border:1px dashed var(--border); border-radius:var(--r-md); padding:14px; display:flex; align-items:center; justify-content:center; }
        .sc-preview .sc-card { position:static; transform:none; width:100%; box-shadow:0 10px 30px -14px rgba(20,20,20,.25); }
        .sc-preview-empty { color:var(--muted); font-size:12px; text-align:center; line-height:1.6; }
        .sc-options { display:flex; flex-direction:column; gap:7px; }
        .sc-opt { border:1px solid var(--border,#E6E4DF); background:var(--surface,#fff); border-radius:11px; padding:10px 13px; cursor:pointer; font:inherit; font-size:13px; font-weight:600; text-align:left; color:var(--text,#17181A); }
        .sc-opt:hover:not(:disabled) { border-color:var(--text,#17181A); }
        .sc-opt.on { border-color:var(--accent,#F05A3C); background:var(--accent-soft,#FDEEE9); }
        .sc-opt:disabled:not(.on) { opacity:.45; cursor:default; }
        .sc-answered { color:var(--ok,#3E9B5F); font-size:12px; font-weight:600; }
        .canvas-panel .sc-card { pointer-events:auto; }
        .duet-card { position:absolute; left:50%; bottom:72px; transform:translateX(-50%); z-index:5; animation:duetcard .45s ease; }
        .duet-card .sc-card { position:static; transform:none; width:340px; box-shadow:0 30px 70px -18px rgba(0,0,0,.65); }
        @keyframes duetcard { from { opacity:0; transform:translateX(-50%) translateY(16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        .placement-viz { display:flex; gap:4px; height:42px; margin-bottom:8px; }
        .pv-video { flex:1; background:var(--border); border-radius:6px; }
        .pv-rail { width:15px; background:var(--accent); border-radius:6px; }
        .pv-rail.ghost { opacity:.2; }

        .pill-btn { border-radius:999px; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:10px 18px; font:inherit; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:8px; }
        .pill-btn:hover { border-color:var(--text); }
        .pill-btn.primary { background:var(--text); color:#fff; border-color:var(--text); }
        .pill-btn.primary:hover { opacity:.88; }
        .pill-btn.primary:disabled { opacity:.35; cursor:not-allowed; }
        .pill-btn.big { padding:15px 32px; font-size:16px; }
        .pill-btn.ghost { background:var(--surface); }

        /* Global toast: the latest log line, visible on every step (the full
           log only lives on Launch). z above the demo overlay (z-50). */
        .toast { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:200; display:flex; align-items:center; gap:12px; background:#17181A; color:#fff; border-radius:999px; padding:11px 20px; font-size:13px; line-height:1.45; max-width:min(760px,92vw); box-shadow:0 8px 28px rgba(0,0,0,.28); }
        .toast-err { background:#B93B3B; }
        .toast-ok { background:#1D7A4C; }
        .toast button { background:none; border:none; color:#fff; opacity:.7; font-size:16px; cursor:pointer; padding:0 2px; line-height:1; }
        .toast button:hover { opacity:1; }

        .log { max-width:640px; margin-top:20px; display:flex; flex-direction:column; gap:6px; }
        .log-row { font-family:var(--mono); font-size:12px; display:flex; gap:10px; line-height:1.5; }
        .log-t { color:var(--muted); flex-shrink:0; }
        .log-ok { color:var(--ok); } .log-err { color:var(--danger); } .log-info { color:var(--text); }

        /* right preview */
        .preview { width:360px; flex-shrink:0; display:flex; flex-direction:column; gap:12px; padding-top:8px; }
        .preview-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:16px; display:flex; flex-direction:column; gap:12px; flex:1; box-shadow:0 1px 3px rgba(20,20,20,.04); }
        .preview-head { display:flex; align-items:center; justify-content:space-between; }
        .preview-title { font-family:var(--mono); font-size:11px; color:var(--accent); }
        .preview-code { background:#17181A; border-radius:var(--r-md); padding:14px; font-family:var(--mono); font-size:11.5px; line-height:1.6; white-space:pre-wrap; word-break:break-all; color:#D8D9DE; overflow-y:auto; flex:1; }
        .preview-note { font-size:11.5px; color:var(--muted); line-height:1.55; }

        /* demo page */
        .demo-root { position:fixed; inset:0; z-index:50; background:var(--canvas); color:var(--text); font-family:var(--font); display:flex; flex-direction:column; overflow-y:auto; }
        .demo-nav { display:flex; align-items:center; justify-content:space-between; padding:16px 28px; position:sticky; top:0; background:var(--canvas); z-index:2; }
        .demo-brandwrap { display:flex; align-items:center; gap:11px; }
        .demo-logo { height:30px; border-radius:7px; object-fit:contain; }
        .demo-monogram { width:32px; height:32px; border-radius:9px; background:var(--text); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:700; }
        .demo-brand { font-weight:700; font-size:18px; letter-spacing:-.3px; }
        .demo-main { flex:1; display:flex; flex-direction:column; align-items:center; padding:24px 24px 48px; }
        .demo-header { text-align:center; margin-bottom:28px; }
        /* Brand carry-through on themed pages: accent eyebrow + accent CTA +
           a soft accent wash behind the hero. Alto default stays untouched. */
        .demo-eyebrow { display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:700; letter-spacing:1.6px; text-transform:uppercase; color:var(--accent); margin-bottom:14px; }
        .demo-eyebrow::before, .demo-eyebrow::after { content:""; width:26px; height:1.5px; background:var(--accent); opacity:.5; }
        .demo-themed .demo-main { background:radial-gradient(60% 340px at 50% 0, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%); }
        .demo-themed .demo-cta .pill-btn.primary { background:var(--accent); border-color:var(--accent); color:#fff; box-shadow:0 6px 22px -8px color-mix(in srgb, var(--accent) 65%, transparent); }
        .demo-themed .demo-cta .pill-btn.primary:hover { opacity:.92; }
        .demo-themed .demo-stage { border-top:3px solid var(--accent); }
        .demo-header h1 { font-size:clamp(28px,4.5vw,44px); font-weight:700; letter-spacing:-1.2px; margin:0; line-height:1.1; max-width:760px; }
        .demo-header p { color:var(--muted); font-size:16px; line-height:1.6; max-width:600px; margin:14px auto 0; }
        .demo-stage { width:min(1080px,100%); aspect-ratio:16/9; background:var(--surface); border:1px solid var(--border); border-radius:20px; overflow:hidden; box-shadow:0 20px 60px -24px rgba(20,20,20,.18); display:flex; align-items:center; justify-content:center; position:relative; }
        .demo-stage iframe { width:100%; height:100%; border:none; }
        .cvi-wrap { position:relative; width:100%; height:100%; background:#0e0f12; overflow:hidden; --canvas-panel-w:min(480px, 46%); }
        .cvi-wrap > * { width:100%; height:100%; }
        /* Split layout: an active side card claims a dedicated panel and the
           video pane RESIZES into the remaining width — the canvas gets its own
           screen region instead of cards overlaying (cutting into) the video. */
        /* width/height:auto — size from the insets; the .cvi-wrap > * 100% sizing
           would otherwise win the over-constraint tie and pin the pane full-width */
        .cvi-video-pane { position:absolute; inset:0; width:auto; height:auto; overflow:hidden; transition:left .55s cubic-bezier(.22,.9,.3,1), right .55s cubic-bezier(.22,.9,.3,1); }
        .cvi-video-pane > * { width:100%; height:100%; }
        /* The vendored conversation container is aspect-ratio:16/9 + max-height:90vh —
           exact fit for a full 16:9 stage, but a letterboxed strip (black bars) once
           the pane narrows for the split. Make it fill the pane; the video itself is
           object-fit:cover so it crops instead of squishing. Structural selector
           because the module class names are hashed. */
        .cvi-wrap .cvi-video-pane > * > * { height:100%; max-height:none; aspect-ratio:auto; border-radius:0; }
        .canvas-split-right .cvi-video-pane { right:var(--canvas-panel-w); }
        .canvas-split-left .cvi-video-pane { left:var(--canvas-panel-w); }
        /* A light sheet (site canvas color), not a dark strip — it should read as
           the card's own screen, matching the page, never as a dead black region. */
        .canvas-panel { position:absolute; top:0; bottom:0; width:var(--canvas-panel-w); background:var(--canvas,#F5F4F1); opacity:0; transition:opacity .45s ease; pointer-events:none; }
        .canvas-panel-right { right:0; border-left:1px solid var(--border,#E6E4DF); }
        .canvas-panel-left { left:0; border-right:1px solid var(--border,#E6E4DF); }
        .canvas-split .canvas-panel { opacity:1; }
        /* Keep Magic Canvas cards inside the stage instead of a full-viewport overlay */
        .canvas-contained { position:absolute !important; inset:0 !important; }
        /* Fit the side slots to the panel (the vendored module sizes them off
           100vw, which overflows a stage narrower than the viewport). */
        .canvas-contained [data-canvas-slot="safe-area-right"],
        .canvas-contained [data-canvas-slot="safe-area-left"] { width:calc(var(--canvas-panel-w) - 32px); }
        /* Alto-style card chrome on the panel — the module's flat 8px card
           washes out against the light panel background. */
        .canvas-contained [data-canvas-card] { border-radius:16px; border:1px solid var(--border,#E6E4DF); box-shadow:0 22px 48px -20px rgba(20,20,20,.30); }
        /* Call controls stay over the video, not under the canvas panel */
        .canvas-split-right .interrupt-btn { right:calc(var(--canvas-panel-w) + 18px); }
        .canvas-split-left .rec-live { left:calc(var(--canvas-panel-w) + 14px); }
        .interrupt-btn { position:absolute; bottom:18px; right:18px; z-index:30; border-radius:999px; border:none; background:rgba(255,255,255,.92); color:#17181A; padding:10px 16px; font:inherit; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,.25); }
        /* pointer-events:none — must never block call controls under it */
        .rec-live { position:absolute; top:14px; left:14px; z-index:30; pointer-events:none; display:inline-flex; align-items:center; gap:7px; background:rgba(0,0,0,.55); color:#fff; border-radius:999px; padding:6px 13px; font-size:12px; font-weight:600; letter-spacing:.3px; }
        .rec-live.rec-fail { background:rgba(214,69,69,.92); }
        .stage-rec-btn { position:absolute; bottom:18px; left:18px; z-index:30; border-radius:999px; border:none; background:rgba(214,69,69,.94); color:#fff; padding:10px 16px; font:inherit; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,.25); display:inline-flex; align-items:center; gap:8px; }
        .stage-rec-btn:hover { background:rgba(214,69,69,1); }
        .interrupt-btn:hover { background:#fff; }
        .demo-cta { display:flex; flex-direction:column; align-items:center; gap:14px; }
        /* pre-call email gate & post-call feedback screens (inside the stage) */
        .exp-screen { display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; padding:28px 24px; max-width:460px; width:100%; }
        .exp-screen h3 { font-size:22px; letter-spacing:-.4px; margin:0; line-height:1.2; }
        .exp-hint { color:var(--muted); font-size:13.5px; line-height:1.55; margin:0; }
        .demo-hologram .exp-hint { color:#8f9ab8; }
        .exp-input { width:100%; max-width:320px; text-align:center; }
        .exp-comment { width:100%; max-width:360px; min-height:74px; }
        .exp-err { color:var(--danger); font-size:12.5px; margin:0; }
        .exp-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:4px; }
        .exp-actions a.pill-btn { text-decoration:none; }
        .exp-screen { max-height:100%; overflow-y:auto; }
        .flow-dots { display:flex; gap:6px; justify-content:center; }
        .flow-dots span { width:7px; height:7px; border-radius:50%; background:var(--border); }
        .flow-dots span.on { background:var(--accent); }
        .exp-video { width:100%; max-width:420px; aspect-ratio:16/9; border:none; border-radius:12px; background:#000; }
        .exp-options { display:flex; flex-direction:column; gap:8px; width:100%; max-width:340px; }
        .exp-opt { border:1px solid var(--border); background:var(--surface); border-radius:12px; padding:11px 14px; cursor:pointer; font:inherit; font-size:14px; font-weight:600; text-align:left; color:var(--text); }
        .exp-opt:hover, .exp-opt.on { border-color:var(--text); box-shadow:0 1px 3px rgba(20,20,20,.08); }
        .exp-opt-desc { display:block; color:var(--muted); font-size:12px; font-weight:400; margin-top:2px; }
        .star-row { display:flex; gap:6px; }
        .star { border:none; background:none; font-size:34px; line-height:1; cursor:pointer; color:var(--border); padding:2px; transition:transform .12s ease; }
        .star.on { color:#F3B93F; }
        .star:hover { transform:scale(1.12); }
        .demo-cta-hint { color:var(--muted); font-size:13px; }
        .demo-powered { color:var(--muted); font-size:11px; font-family:var(--mono); margin-top:30px; }
        @keyframes recpulse { 0%,100%{opacity:1} 50%{opacity:.35} }

        .idea-box { background:var(--accent-soft); border:1px solid var(--border); border-radius:var(--r-lg); padding:18px 20px; margin-bottom:26px; max-width:600px; }

        /* demo dashboard */
        .stat-bars { display:flex; align-items:flex-end; gap:5px; padding:10px 12px; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); width:fit-content; }
        .stat-col { display:flex; flex-direction:column; align-items:center; gap:3px; }
        .stat-bar { width:16px; background:var(--accent); border-radius:3px 3px 0 0; }
        .stat-day { font-family:var(--mono); font-size:9px; color:var(--muted); }

        /* calls & data */
        .transcript { display:flex; flex-direction:column; gap:8px; max-width:640px; margin-top:8px; }
        .t-row { display:flex; gap:10px; font-size:13px; line-height:1.55; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:9px 12px; }
        .t-row.t-assistant { background:var(--surface-2); }
        .t-role { font-weight:600; flex-shrink:0; min-width:56px; color:var(--muted); font-size:12px; padding-top:1px; }
        .perception-card { max-width:640px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--r-md); padding:12px 14px; font-size:13px; line-height:1.6; white-space:pre-wrap; margin-bottom:8px; }

        /* knowledge base list */
        .kb-list { display:flex; flex-direction:column; gap:6px; max-width:640px; margin-top:10px; }
        .kb-row { display:flex; align-items:center; gap:10px; background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:8px 12px; }
        .kb-name { flex:1; border:1px solid transparent; background:none; padding:4px 6px; border-radius:var(--r-sm); font-size:13px; }
        .kb-name:hover, .kb-name:focus { border-color:var(--border); background:var(--surface-2); }
        .kb-status { font-family:var(--mono); font-size:10.5px; padding:3px 8px; border-radius:999px; background:var(--surface-2); color:var(--muted); flex-shrink:0; }
        .kb-ready { color:var(--ok); }
        .kb-error { color:var(--danger); }
        .kb-processing, .kb-started, .kb-recrawling { color:#B8860B; }
        .kb-use { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--muted); cursor:pointer; flex-shrink:0; }
        .kb-del, .kb-move { border:none; background:none; color:var(--muted); cursor:pointer; font-size:13px; padding:2px 6px; border-radius:6px; flex-shrink:0; }
        .kb-del:hover { color:var(--danger); background:var(--surface-2); }
        .kb-move:hover:not(:disabled) { color:var(--text); background:var(--surface-2); }
        .kb-move:disabled { opacity:.25; cursor:default; }

        /* format picker icons */
        .format-viz { display:flex; align-items:center; justify-content:center; height:42px; margin-bottom:8px; }
        .fv-desktop { width:56px; height:34px; border:2px solid currentColor; border-radius:5px; opacity:.65; }
        .fv-phone { width:20px; height:38px; border:2px solid currentColor; border-radius:6px; opacity:.65; }
        .fv-kiosk { width:22px; height:30px; border:2px solid currentColor; border-radius:3px; opacity:.55; position:relative; }
        .fv-kiosk::after { content:""; position:absolute; left:50%; top:100%; transform:translateX(-50%); width:8px; height:8px; border-left:2px solid currentColor; border-right:2px solid currentColor; }
        .fv-holo { width:24px; height:38px; border:2px solid currentColor; border-radius:6px; opacity:.65; padding:3px; }
        .fv-holo::before { content:""; display:block; width:100%; height:100%; background:currentColor; opacity:.35; border-radius:2px; }

        /* phone format: a scrollable in-app screen inside a device frame —
           the demo reads as a screen of the prospect's own mobile app, with
           skeleton content standing in for the app around the conversation. */
        .demo-phone .demo-main { justify-content:center; }
        .phone-frame { position:relative; width:min(390px, 92vw); aspect-ratio:9/19; background:#0e0f12; border-radius:44px; padding:10px; box-shadow:0 30px 80px -30px rgba(20,20,20,.45), 0 0 0 2px rgba(20,20,20,.9); display:flex; }
        .phone-frame::before { content:""; position:absolute; right:-4px; top:118px; width:3px; height:62px; background:#26272b; border-radius:2px; }
        .phone-frame::after { content:""; position:absolute; left:-4px; top:98px; width:3px; height:88px; background:#26272b; border-radius:2px; }
        .phone-island { position:absolute; top:20px; left:50%; transform:translateX(-50%); width:96px; height:25px; background:#0e0f12; border-radius:14px; z-index:3; }
        .phone-screen { position:relative; flex:1; border-radius:34px; overflow:hidden; background:var(--canvas); display:flex; flex-direction:column; min-height:0; }
        .demo-phone .demo-stage { width:100%; height:100%; aspect-ratio:auto; flex:1; border-radius:0; border:none; box-shadow:none; }
        .app-status { display:flex; justify-content:space-between; align-items:center; padding:15px 24px 4px; font-size:12px; font-weight:600; flex-shrink:0; }
        .app-status-icons { letter-spacing:2px; font-size:10px; opacity:.75; }
        .app-scroll { flex:1; min-height:0; overflow-y:auto; padding:4px 14px 14px; }
        .app-header { display:flex; align-items:center; gap:8px; font-weight:700; font-size:15px; letter-spacing:-.2px; padding:8px 6px 4px; }
        .app-logo { height:22px; border-radius:5px; object-fit:contain; }
        .app-monogram { width:24px; height:24px; border-radius:7px; background:var(--text); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; }
        .app-hero { background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:20px 16px; margin:10px 0 12px; text-align:center; display:flex; flex-direction:column; gap:10px; align-items:center; }
        .demo-themed .app-hero { border-top:3px solid var(--accent); }
        .app-hero h2 { font-size:19px; margin:0; letter-spacing:-.4px; line-height:1.2; }
        .app-hero p { color:var(--muted); font-size:13px; margin:0; line-height:1.5; }
        .app-skeleton { display:flex; flex-direction:column; gap:10px; }
        .app-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:12px; display:flex; flex-direction:column; gap:8px; flex-shrink:0; }
        .app-line { height:9px; border-radius:5px; background:var(--border); }
        .app-line.dim { opacity:.55; }
        .app-tabbar { display:flex; justify-content:space-around; align-items:center; padding:11px 0 17px; border-top:1px solid var(--border); background:var(--surface); color:var(--border); font-size:9px; flex-shrink:0; }
        .app-tabbar .on { color:var(--accent); }

        /* kiosk format: a framed freestanding totem with an attract screen —
           the in-context preview. "Go live" (demo-kiosk-live) strips the frame
           to chrome-less full-viewport for real kiosk/tablet hardware. */
        .demo-kiosk .demo-main { justify-content:center; }
        .kiosk-scene { display:flex; flex-direction:column; align-items:center; gap:24px; width:100%; }
        .kiosk-totem { display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 36px 40px rgba(20,20,20,.30)); }
        /* Width also bounded by the height budget (via the aspect ratio) so the
           whole totem + Go-live button fit the viewport without scrolling. */
        .kiosk-screen { width:min(420px, 90vw, calc(56vh * 9 / 14)); aspect-ratio:9/14; background:var(--canvas); border-radius:18px; border:13px solid #1b1c1f; box-shadow:inset 0 0 0 2px #000; overflow:hidden; display:flex; }
        .kiosk-neck { width:82px; height:min(96px, 9vh); background:linear-gradient(90deg, #232427, #3a3b3f 50%, #232427); }
        .kiosk-base { width:230px; height:16px; background:#1b1c1f; border-radius:8px 8px 3px 3px; }
        .demo-kiosk:not(.demo-kiosk-live) .demo-stage { width:100%; height:100%; max-width:none; aspect-ratio:auto; border-radius:0; border:none; box-shadow:none; }
        .kiosk-attract { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:13px; text-align:center; padding:26px 22px; }
        .kiosk-logo { height:42px; object-fit:contain; border-radius:9px; margin-bottom:4px; }
        .kiosk-attract h2 { font-size:23px; letter-spacing:-.5px; margin:0; line-height:1.15; }
        .kiosk-attract p { color:var(--muted); font-size:14px; margin:0; line-height:1.5; }
        .kiosk-cta { position:relative; margin-top:12px; border:none; border-radius:999px; background:var(--text); color:#fff; font:inherit; font-weight:600; font-size:16px; padding:16px 30px; cursor:pointer; }
        .kiosk-cta:disabled { opacity:.6; cursor:default; }
        .kiosk-cta::after { content:""; position:absolute; inset:-9px; border-radius:999px; border:2px solid var(--accent); animation:kioskpulse 2.2s ease-out infinite; }
        @keyframes kioskpulse { 0% { transform:scale(.9); opacity:.9; } 70% { transform:scale(1.12); opacity:0; } 100% { opacity:0; } }
        .demo-kiosk-live .demo-nav, .demo-kiosk-live .demo-header, .demo-kiosk-live .demo-powered { display:none; }
        .demo-kiosk-live .demo-main { padding:0; }
        .demo-kiosk-live .demo-stage { width:100vw; height:100vh; max-width:none; aspect-ratio:auto; border-radius:0; border:none; }
        .demo-kiosk-live .demo-cta { transform:scale(1.25); }
        .kiosk-exit { position:fixed; top:14px; right:14px; z-index:60; width:38px; height:38px; border-radius:50%; border:1px solid var(--border); background:rgba(255,255,255,.85); color:var(--muted); font-size:20px; line-height:1; cursor:pointer; opacity:.35; }
        .kiosk-exit:hover { opacity:1; }

        /* hologram format: a Proto-style holobox — a life-size white
           enclosure with speaker grilles and a glowing portrait screen the
           AI human "beams into". Bright and physical, not dark sci-fi. */
        .demo-hologram .demo-main { justify-content:center; }
        .holo-scene { display:flex; flex-direction:column; align-items:center; width:100%; }
        .holo-head { text-align:center; margin-bottom:20px; }
        .holo-head h2 { font-size:clamp(22px, 3.4vw, 34px); letter-spacing:-.6px; margin:0; line-height:1.15; }
        .holo-head p { color:var(--muted); font-size:15px; line-height:1.6; max-width:520px; margin:10px auto 0; }
        .holo-box { position:relative; display:flex; flex-direction:column; align-items:center; background:linear-gradient(180deg, #fbfbfc, #ececef); border-radius:24px; padding:16px 34px 20px; box-shadow:0 44px 90px -38px rgba(20,20,20,.5), inset 0 1px 0 #fff, 0 0 0 1px #d9d9de; }
        .holo-topbar { display:flex; align-items:center; justify-content:space-between; gap:18px; width:100%; padding:4px 2px 12px; }
        .holo-topbar .holo-brand { font-weight:800; letter-spacing:.22em; text-transform:uppercase; font-size:13px; color:#3c3c40; }
        .holo-topbar .holo-tag { font-size:12px; color:#77777d; }
        /* speaker grilles on the enclosure's inner walls */
        .holo-box::before, .holo-box::after { content:""; position:absolute; top:120px; bottom:120px; width:8px; background-image:radial-gradient(circle, #c9c9cf 1.2px, transparent 1.4px); background-size:8px 8px; }
        .holo-box::before { left:12px; }
        .holo-box::after { right:12px; }
        /* portrait glowing screen, width bounded by the height budget */
        .holo-screen { position:relative; width:min(400px, 84vw, calc(58vh * 9 / 16)); aspect-ratio:9/16; border-radius:12px; overflow:hidden; background:radial-gradient(120% 90% at 50% 26%, #a6d4fb, #4f9be4 62%, #2f6fb6); box-shadow:inset 0 0 60px rgba(255,255,255,.4), inset 0 0 0 2px rgba(20,40,70,.35), 0 0 54px rgba(96,168,255,.4); animation:hologlow 5s ease-in-out infinite; }
        .demo-hologram .demo-stage.holo-stage { position:absolute; inset:0; width:100%; height:100%; max-width:none; aspect-ratio:auto; background:transparent; border:none; border-radius:0; box-shadow:none; }
        /* the video beams in over the glow: crop to fill the portrait panel */
        .holo-stage .cvi-wrap, .holo-stage .cvi-video-pane > * > * { background:transparent; }
        .holo-foot { padding-top:12px; font-size:12px; color:#77777d; }
        .demo-hologram .holo-stage .demo-cta-hint { color:#eaf4ff; text-shadow:0 1px 8px rgba(30,80,140,.6); }
        @keyframes hologlow { 0%, 100% { box-shadow:inset 0 0 60px rgba(255,255,255,.4), inset 0 0 0 2px rgba(20,40,70,.35), 0 0 54px rgba(96,168,255,.4); } 50% { box-shadow:inset 0 0 74px rgba(255,255,255,.5), inset 0 0 0 2px rgba(20,40,70,.35), 0 0 70px rgba(96,168,255,.55); } }

        @media (max-width:1100px){ .preview { display:none; } }
        @media (max-width:760px){
          .rail { width:56px; }
          .rail-btn span.rail-label, .rail-check { display:none; }
          .main { padding:20px; }
          .layout { padding:0 10px 10px; gap:10px; }
        }
      `;

function VisitorDemo({ slug }) {
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversation, setConversation] = useState(null);

  useEffect(() => {
    fetch(`/api/demos?slug=${encodeURIComponent(slug)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "This demo link isn't available.");
        setDemo(j);
        document.title = j.site?.brand ? `${j.site.brand} — live demo` : "Live demo";
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  const start = async (prefs) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/demo-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          // Guided-journey answers (option/step indexes + short free text) —
          // the server resolves them against the STORED journey config.
          ...(prefs && Array.isArray(prefs.answers)
            ? { prefs: { email: String(prefs.email || "").slice(0, 200), answers: prefs.answers.slice(0, 12) } }
            : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't start the conversation — try again.");
      setConversation(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const center = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F4F1", color: "#17181A", fontFamily: "'Instrument Sans', system-ui, sans-serif", fontSize: 14, textAlign: "center", padding: 24 };
  if (error && !demo) return <div style={center}>{error}</div>;
  if (!demo) return <div style={center}>Loading…</div>;

  return (
    <>
      {/* Visitor pages never mount the builder component, so they must carry
          the stylesheet themselves. */}
      <style>{BUILDER_CSS}</style>
      <DemoSite
        site={demo.site || {}}
        controls={demo.controls || {}}
        experience={demo.experience || {}}
        slug={slug}
        conversationUrl={conversation?.conversation_url || null}
        conversationId={conversation?.conversation_id || null}
        onStart={start}
        onExit={() => setConversation(null)}
        onCallEnd={() => setConversation(null)}
        busy={busy}
        visitor
      />
      {error && (
        <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 99, background: "#fff", border: "1px solid #E6E4DF", color: "#D64545", borderRadius: 999, padding: "9px 18px", fontSize: 13, fontFamily: "'Instrument Sans', system-ui, sans-serif", boxShadow: "0 4px 14px rgba(0,0,0,.12)" }}>
          {error}
        </div>
      )}
    </>
  );
}

/* ── Duet: two AI humans in conversation, each in its own same-origin iframe
      (Daily allows one call object per page — iframes are separate pages).
      The parent is a text switchboard: when one replica finishes a turn, its
      words go to the other room as conversation.respond. No microphones
      anywhere, so there are no feedback loops; both voices play in the tab
      and the tab capture records the whole stage locally. ── */

/* Joiner page: /?duet=join&url=…&id=…&side=a|b — joins one room, renders the
   replica full-bleed, relays finished turns up, accepts respond/leave down. */
function DuetJoiner({ url, id, side }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const screenRef = useRef(null);
  const [hasScreen, setHasScreen] = useState(false); // replica screen track (slides/browser) present
  useEffect(() => {
    let call = null;
    let buf = [];
    const origin = window.location.origin;
    const post = (m) => window.parent?.postMessage({ __duet: true, from: side, ...m }, origin);
    const onParent = (e) => {
      if (e.origin !== origin || e.data?.__duet !== true) return;
      if (e.data.type === "respond" && e.data.text) {
        try {
          call?.sendAppMessage({
            message_type: "conversation",
            event_type: "conversation.respond",
            conversation_id: id,
            properties: { text: String(e.data.text).slice(0, 4000) },
          }, "*");
        } catch { /* room gone */ }
      }
      if (e.data.type === "leave") { try { call?.leave(); } catch { /* gone */ } }
    };
    window.addEventListener("message", onParent);
    (async () => {
      try {
        call = DailyIframe.createCallObject();
        const attach = (el, track) => {
          if (!el) return;
          const stream = el.srcObject instanceof MediaStream ? el.srcObject : new MediaStream();
          stream.getTracks().filter((t) => t.kind === track.kind).forEach((t) => stream.removeTrack(t));
          stream.addTrack(track);
          el.srcObject = stream;
          el.play?.().catch(() => post({ type: "autoplay-blocked" }));
        };
        call.on("track-started", (ev) => {
          if (ev?.participant?.local || !ev?.track) return;
          if (ev.track.kind === "audio") { attach(audioRef.current, ev.track); return; }
          // Presentation slides / Browser Use arrive as the replica's screen
          // track — render it dominant with the face as a corner tile.
          const isScreen = ev.participant?.tracks?.screenVideo?.track?.id === ev.track.id;
          if (isScreen) { attach(screenRef.current, ev.track); setHasScreen(true); }
          else attach(videoRef.current, ev.track);
        });
        call.on("track-stopped", (ev) => {
          const scr = screenRef.current?.srcObject;
          if (ev?.track && scr instanceof MediaStream && scr.getTracks().some((t) => t.id === ev.track.id)) {
            screenRef.current.srcObject = null;
            setHasScreen(false);
          }
        });
        call.on("app-message", (e2) => {
          const d = e2?.data;
          if (!d?.event_type) return;
          // Role arrives as properties.role ("pal"/"replica"/"user") or embedded
          // in the event type (conversation.replica.stopped_speaking).
          const role = String(
            d.properties?.role ?? (/\.user\./i.test(d.event_type) ? "user" : "replica")
          ).toLowerCase();
          if (role === "user") return; // duet rooms have no microphone anyway
          // Exact match: conversation.utterance-streaming would duplicate text.
          if (/^conversation\.utterance$/i.test(d.event_type)) {
            const t = String(d.properties?.speech ?? d.properties?.text ?? "").trim();
            if (t) buf.push(t);
          }
          // End of the replica's turn → hand its words to the other room.
          if (/stopped_speaking/i.test(d.event_type)) {
            const text = buf.join(" ").trim();
            buf = [];
            if (text) setTimeout(() => post({ type: "turn", text }), 700);
          }
        });
        call.on("left-meeting", () => post({ type: "left" }));
        await call.join({ url, startVideoOff: true, startAudioOff: true });
        try { call.setLocalAudio(false); call.setLocalVideo(false); } catch { /* already off */ }
        post({ type: "ready" });
      } catch (err) {
        post({ type: "fatal", error: err?.message || "join failed" });
      }
    })();
    return () => {
      window.removeEventListener("message", onParent);
      try { call?.leave(); } catch { /* gone */ }
      try { call?.destroy(); } catch { /* gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#101114" }}>
      <video
        ref={screenRef}
        autoPlay
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000", display: hasScreen ? "block" : "none" }}
      />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        style={hasScreen
          ? { position: "absolute", right: 12, bottom: 12, width: "26%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.5)", zIndex: 2 }
          : { width: "100%", height: "100%", objectFit: "cover" }}
      />
      <audio ref={audioRef} autoPlay />
    </div>
  );
}

/* The duet stage the builder sees: branded chrome, two rooms side by side,
   REC indicator, turn counter, End button. Records the captured tab locally
   (MediaRecorder) and downloads the file when the duet ends. */
function DuetStage({ run, brand, maxTurns, cards = [], onExit }) {
  const frameA = useRef(null);
  const frameB = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const turnsRef = useRef(0);
  const [turns, setTurns] = useState(0);
  const [note, setNote] = useState("Your AI human is connecting…");
  const endedRef = useRef(false);
  // Scripted cards in duets: the parent sees every relayed turn as text, so
  // keyword cards fire off what EITHER AI actually says; start/time cards
  // arm when side A connects. Rendered as an overlay — it's in the recording.
  const [duetCard, setDuetCard] = useState(null);
  const cardFiredRef = useRef(new Set());
  const cardTimersRef = useRef([]);
  const cardCurrentRef = useRef(-1);
  const cardsArmedRef = useRef(false);
  const showDuetCard = (i) => {
    if (cardFiredRef.current.has(i)) return;
    cardFiredRef.current.add(i);
    cardCurrentRef.current = i;
    setDuetCard(cards[i]);
    const hide = Number(cards[i].hideAfter) || 0;
    if (hide > 0) cardTimersRef.current.push(setTimeout(() => {
      if (cardCurrentRef.current === i) { cardCurrentRef.current = -1; setDuetCard(null); }
    }, hide * 1000));
  };
  // Side A (the demo's AI human) mounts and speaks first; side B (the
  // partner) only joins once A's opener has landed — deterministic order,
  // no colliding greetings. Messages for a not-yet-ready room queue up.
  const [mountB, setMountB] = useState(false);
  const readyRef = useRef({ a: false, b: false });
  const pendingRef = useRef({ a: [], b: [] });

  const endDuet = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    const origin = window.location.origin;
    [frameA, frameB].forEach((f) => f.current?.contentWindow?.postMessage({ __duet: true, type: "leave" }, origin));
    const rec = recorderRef.current;
    const finish = () => {
      if (chunksRef.current.length) {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "video/webm" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `tavus-duet-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      }
      run.stream?.getTracks().forEach((t) => t.stop());
      onExit();
    };
    if (rec && rec.state !== "inactive") {
      rec.onstop = finish;
      setTimeout(() => { try { rec.stop(); } catch { finish(); } }, 800); // let the last words land
    } else {
      finish();
    }
  }, [onExit, run.stream]);

  useEffect(() => {
    const origin = window.location.origin;
    const deliver = (side, text) => {
      const frame = side === "a" ? frameA : frameB;
      if (readyRef.current[side]) {
        frame.current?.contentWindow?.postMessage({ __duet: true, type: "respond", text }, origin);
      } else {
        pendingRef.current[side].push(text); // flushed when that room reports ready
      }
    };
    const onMsg = (e) => {
      if (e.origin !== origin || e.data?.__duet !== true) return;
      const d = e.data;
      if (d.type === "ready" && (d.from === "a" || d.from === "b")) {
        readyRef.current[d.from] = true;
        const frame = d.from === "a" ? frameA : frameB;
        pendingRef.current[d.from].splice(0).forEach((text) =>
          frame.current?.contentWindow?.postMessage({ __duet: true, type: "respond", text }, origin));
        if (d.from === "a") {
          setNote("Live — waiting for your AI human's opener…");
          if (!cardsArmedRef.current) {
            cardsArmedRef.current = true;
            cards.forEach((c, i) => {
              if (c.trigger === "start") showDuetCard(i);
              else if (c.trigger === "time" && Number(c.atSeconds) > 0) cardTimersRef.current.push(setTimeout(() => showDuetCard(i), c.atSeconds * 1000));
            });
          }
        }
      }
      if (d.type === "fatal") setNote(`Room ${String(d.from).toUpperCase()} failed: ${d.error}`);
      if (d.type === "autoplay-blocked") setNote("Audio blocked by the browser — click anywhere on this page once.");
      if (d.type === "turn" && d.text) {
        turnsRef.current += 1;
        setTurns(turnsRef.current);
        setNote(`${String(d.from).toUpperCase()}: “${String(d.text).slice(0, 110)}${d.text.length > 110 ? "…" : ""}”`);
        if (turnsRef.current >= maxTurns * 2) { endDuet(); return; }
        if (d.from === "a") setMountB(true); // the opener landed — bring in the partner
        deliver(d.from === "a" ? "b" : "a", d.text);
        // Keyword cards fire off what either AI actually says.
        const lower = String(d.text).toLowerCase();
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i];
          if (c.trigger !== "keyword" || cardFiredRef.current.has(i)) continue;
          const kws = String(c.keywords || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
          if (kws.some((k) => lower.includes(k))) { showDuetCard(i); break; }
        }
      }
    };
    window.addEventListener("message", onMsg);
    // If the opener never registers (event hiccup), bring the partner in anyway.
    const mountFallback = setTimeout(() => setMountB(true), 18_000);

    // Local recording of the captured tab — both faces, both voices.
    if (run.stream) {
      try {
        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
        const rec = new MediaRecorder(run.stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
        rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
        rec.start(1000);
        recorderRef.current = rec;
      } catch (err) { setNote(`Recorder failed (${err.message}) — the duet still runs, unrecorded.`); }
      run.stream.getVideoTracks()[0]?.addEventListener("ended", endDuet); // user hit "stop sharing"
    }

    const hardStop = setTimeout(endDuet, 5 * 60_000); // absolute cap
    return () => {
      clearTimeout(hardStop);
      clearTimeout(mountFallback);
      cardTimersRef.current.forEach(clearTimeout);
      window.removeEventListener("message", onMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const src = (conv, side) =>
    `${window.location.origin}/?duet=join&side=${side}&id=${encodeURIComponent(conv.conversation_id || "")}&url=${encodeURIComponent(conv.conversation_url || "")}`;

  return (
    <div className="duet-root">
      <header className="duet-bar">
        <span className="duet-brand">{brand || "Tavus"} — AI duet</span>
        <span className="duet-rec">⏺ REC · {turns} turns</span>
        <button className="pill-btn" onClick={endDuet}>■ End &amp; save</button>
      </header>
      <div className="duet-stage">
        <iframe ref={frameA} title="Duet A" className="duet-frame" allow="autoplay" src={src(run.a, "a")} />
        {mountB
          ? <iframe ref={frameB} title="Duet B" className="duet-frame" allow="autoplay" src={src(run.b, "b")} />
          : <div className="duet-frame duet-wait">joining…</div>}
      </div>
      {duetCard && (
        <div className="duet-card">
          <ScriptedCard card={duetCard} />
        </div>
      )}
      <footer className="duet-note">{note}</footer>
    </div>
  );
}

/* ── Studio runtime: audio buffers + captured tab stream for the take that's
      about to run. Module-level because the take spans two component trees
      (the builder prepares it, CallExtras inside the call consumes it). ── */
let STUDIO_RUNTIME = null;
const setStudioRuntime = (rt) => { STUDIO_RUNTIME = rt; };
const getStudioRuntime = () => STUDIO_RUNTIME;

/* ── In-call extras: timers, wake reminders, interrupt button, guardrail echo.
      Lives INSIDE CVIProvider so it can use the Daily call object; these
      features need the custom call UI (they're inert in the iframe fallback). */
function CallExtras({ controls, conversationId, onForceLeave, visitor = false, onScriptedCard = null }) {
  const daily = useDaily();

  // Scripted cards — deterministic, SE-authored canvas content. Triggers are
  // hard rules (spoken keyword, elapsed time, call start); the model is never
  // consulted. Each card fires once; a new card replaces the current one.
  useEffect(() => {
    const cards = Array.isArray(controls.scriptedCards) ? controls.scriptedCards : [];
    if (!daily || !cards.length || !onScriptedCard) return;
    const fired = new Set();
    const timers = [];
    let current = -1;
    let armed = false;
    const showCard = (i) => {
      if (fired.has(i)) return;
      fired.add(i);
      current = i;
      onScriptedCard({
        card: cards[i],
        seq: i,
        // Question cards: the visitor's pick goes to the LLM as if spoken.
        answer: (text) => {
          try {
            daily.sendAppMessage({
              message_type: "conversation",
              event_type: "conversation.respond",
              conversation_id: conversationId,
              properties: { text: String(text).slice(0, 500) },
            }, "*");
          } catch { /* room gone */ }
        },
      });
      const hide = Number(cards[i].hideAfter) || 0;
      if (hide > 0) timers.push(setTimeout(() => { if (current === i) { current = -1; onScriptedCard(null); } }, hide * 1000));
    };
    const arm = () => {
      if (armed) return;
      armed = true;
      cards.forEach((c, i) => {
        if (c.trigger === "start") showCard(i);
        else if (c.trigger === "time" && Number(c.atSeconds) > 0) timers.push(setTimeout(() => showCard(i), Number(c.atSeconds) * 1000));
      });
    };
    // Keyword cards match what's actually SAID (either side) — Tavus streams
    // utterance events as app-messages, so cards land in sync with the talk track.
    const onMsg = (e) => {
      const d = e?.data;
      if (!d?.event_type || !/utterance/i.test(d.event_type)) return;
      const speech = String(d.properties?.speech ?? d.properties?.text ?? "").toLowerCase();
      if (!speech) return;
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        if (c.trigger !== "keyword" || fired.has(i)) continue;
        const kws = String(c.keywords || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        if (kws.some((k) => speech.includes(k))) { showCard(i); break; }
      }
    };
    const onJoined = () => arm();
    daily.on("app-message", onMsg);
    daily.on("joined-meeting", onJoined);
    if (daily.meetingState() === "joined-meeting") arm();
    return () => {
      timers.forEach(clearTimeout);
      daily.off("app-message", onMsg);
      daily.off("joined-meeting", onJoined);
      onScriptedCard(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, controls.scriptedCards]);
  // Studio takes: drive the conversation with pre-rendered TTS visitor lines
  // and record the tab-captured stage — Daily's composed recordings can't see
  // DOM overlays, so this is the only capture that includes Magic Canvas
  // cards (and shows presentation slides exactly as the visitor sees them).
  useEffect(() => {
    const rt = controls.studio ? getStudioRuntime() : null;
    if (!daily || !rt) return;
    let disposed = false;
    let quietTimer, fallbackTimer;
    let lineIdx = 0;
    let playing = false;
    let finishing = false;

    const finishTake = () => {
      if (finishing || disposed) return;
      finishing = true;
      try { daily.stopRecording(); } catch { /* not recording */ }
      setTimeout(() => {
        try { daily.stopScreenShare(); } catch { /* already gone */ }
        window.__tavusStageCapture = false;
        onForceLeave?.();
      }, 2000);
    };

    const playNext = () => {
      if (disposed || playing || finishing) return;
      if (lineIdx >= rt.buffers.length) { finishTake(); return; }
      playing = true;
      const src = rt.ctx.createBufferSource();
      src.buffer = rt.buffers[lineIdx];
      src.connect(rt.dest);
      src.onended = () => {
        playing = false;
        lineIdx += 1;
        // Safety net: if the replica's reply never registers, advance anyway.
        clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(playNext, 16_000);
      };
      try { src.start(); } catch { playing = false; }
    };

    // The replica going quiet for a beat = our turn to speak the next line.
    const onMsg = (e) => {
      const d = e?.data;
      if (!d?.event_type || !/utterance|speech|respond/i.test(d.event_type)) return;
      clearTimeout(quietTimer);
      if (playing || finishing) return;
      quietTimer = setTimeout(playNext, 1700);
    };

    const begin = async () => {
      try { await rt.ctx.resume(); } catch { /* already running */ }
      try { await daily.setLocalVideo(false); } catch { /* no camera is fine */ }
      try { await daily.setInputDevicesAsync({ audioSource: rt.dest.stream.getAudioTracks()[0] }); }
      catch (err) { console.error("[studio] couldn't set the TTS mic track:", err); }
      try { await daily.setLocalAudio(true); } catch { /* default is on */ }
      // The tab was captured on the Record-take click (gesture requirement);
      // publish it and record with the stage dominant — same path as the
      // manual ⏺ full-stage button.
      if (rt.displayStream?.getVideoTracks().length) {
        try {
          window.__tavusStageCapture = true;
          daily.startScreenShare({ mediaStream: rt.displayStream });
          setTimeout(() => {
            try { daily.startRecording({ layout: { preset: "default", max_cam_streams: 9 } }); } catch { /* badge shows the failure */ }
          }, 1200);
        } catch (err) { console.error("[studio] stage capture publish failed:", err); }
      }
      // The greeting opens most calls; if nothing is ever heard, start anyway.
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(playNext, 12_000);
    };

    const onJoined = () => begin();
    daily.on("joined-meeting", onJoined);
    daily.on("app-message", onMsg);
    if (daily.meetingState() === "joined-meeting") begin();
    return () => {
      disposed = true;
      clearTimeout(quietTimer);
      clearTimeout(fallbackTimer);
      daily.off("joined-meeting", onJoined);
      daily.off("app-message", onMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, controls.studio]);

  // "Full stage" recording is builder-only (visitors must never see a share
  // prompt) — visitor calls with a stage snapshot fall back to the grid.
  const stageMode = controls.recordingLayout === "stage" && !visitor;

  const say = (text) =>
    daily?.sendAppMessage(
      { message_type: "conversation", event_type: "conversation.echo", conversation_id: conversationId, properties: { text } },
      "*"
    );

  const interrupt = () =>
    daily?.sendAppMessage(
      { message_type: "conversation", event_type: "conversation.interrupt", conversation_id: conversationId },
      "*"
    );

  // S3 recording: Tavus writes the file to the configured bucket, but the
  // recording does NOT start on its own — the frontend has to kick it off
  // once the participant has joined. Non-fatal: a recording hiccup must
  // never take down a live demo. recStatus drives the on-screen ⏺ REC badge
  // so "is it actually recording?" is answerable at a glance.
  const [recStatus, setRecStatus] = useState(""); // "" | "starting" | "recording" | "error"

  /* Full-stage capture: getDisplayMedia needs a user gesture, so it rides the
     ⏺ button click. The tab is published into the call as a screenshare and
     the recording composes it dominant — canvas + avatar + humans + all audio
     in one file. The vendored UI ignores this share (window flag) so the
     visitor's own screen doesn't show a mirror tunnel. */
  const startStageRecording = async () => {
    if (!daily) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false, // audio comes from the call's own mic + replica tracks
        preferCurrentTab: true, // Chrome pre-selects this tab; other browsers show the picker
        selfBrowserSurface: "include",
      });
      window.__tavusStageCapture = true;
      daily.startScreenShare({ mediaStream: stream });
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        window.__tavusStageCapture = false;
        try { daily.stopScreenShare(); } catch { /* already gone */ }
      });
      setRecStatus("starting");
      // Give the track a beat to publish, then record with the screen dominant.
      setTimeout(() => {
        try { daily.startRecording({ layout: { preset: "default", max_cam_streams: 9 } }); }
        catch { setRecStatus("error"); }
      }, 900);
    } catch { /* user dismissed the share prompt — no recording, no drama */ }
  };
  useEffect(() => () => { window.__tavusStageCapture = false; }, []);

  useEffect(() => {
    if (!daily || !controls.recording) return;
    let started = false;
    let retryTimer;
    // Bare startRecording() uses the room default, which composes only the
    // digital human — pass an explicit layout so the visitor is in the file.
    const recOpts =
      controls.recordingLayout === "pal" ? undefined
      : controls.recordingLayout === "speaker" ? { layout: { preset: "active-participant" } }
      : { layout: { preset: "default", max_cam_streams: 9 } }; // everyone, side by side
    const kickoff = () => (recOpts ? daily.startRecording(recOpts) : daily.startRecording());
    const startRec = () => {
      if (stageMode) return; // stage capture starts from the ⏺ button, not on join
      if (started) return;
      if (daily.meetingState() !== "joined-meeting") return;
      started = true;
      setRecStatus("starting");
      try { kickoff(); } catch { setRecStatus("error"); }
    };
    const onStarted = () => {
      setRecStatus("recording");
      // Re-assert the layout once recording is live: if it started before the
      // local camera published, the composition can miss the visitor.
      if (recOpts) setTimeout(() => { try { daily.updateRecording(recOpts); } catch { /* best effort */ } }, 2000);
    };
    const onStopped = () => setRecStatus((s) => (s === "error" ? s : ""));
    const onError = () => {
      // One retry — recording infra can hiccup right at join time.
      setRecStatus("error");
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        try { kickoff(); setRecStatus("starting"); } catch { /* stay in error */ }
      }, 2500);
    };
    daily.on("joined-meeting", startRec);
    daily.on("recording-started", onStarted);
    daily.on("recording-stopped", onStopped);
    daily.on("recording-error", onError);
    startRec(); // already joined by the time this mounts
    return () => {
      clearTimeout(retryTimer);
      daily.off("joined-meeting", startRec);
      daily.off("recording-started", onStarted);
      daily.off("recording-stopped", onStopped);
      daily.off("recording-error", onError);
    };
  }, [daily, controls.recording]);

  useEffect(() => {
    if (!daily) return;

    const timers = [];
    // Time-limit warning, spoken with 2 minutes left.
    if (controls.maxSeconds && controls.timeWarning) {
      const fireAt = (controls.maxSeconds - 120) * 1000;
      if (fireAt > 5000) timers.push(setTimeout(() => say(controls.timeWarning), fireAt));
    }

    // Inactivity: quiet for N seconds → spoken reminder → 10s grace → leave.
    let inactivityTimer;
    let graceTimer;
    const armInactivity = () => {
      clearTimeout(inactivityTimer);
      clearTimeout(graceTimer);
      if (!controls.inactivitySeconds || !controls.inactivityUtterance) return;
      inactivityTimer = setTimeout(() => {
        say(controls.inactivityUtterance);
        graceTimer = setTimeout(() => onForceLeave?.(), 10_000);
      }, controls.inactivitySeconds * 1000);
    };

    const onAppMessage = (e) => {
      const d = e?.data;
      if (!d?.event_type) return;
      // Anyone talking (user utterances, PAL speech events) counts as engagement.
      if (/utterance|speaking|respond/i.test(d.event_type)) armInactivity();
      // Guardrail fired → optional spoken acknowledgement.
      if (/guardrail/i.test(d.event_type) && controls.guardrailEcho) say(controls.guardrailEcho);
      // Custom tool call → forward to the configured webhook (Zapier/Make/…).
      // text/plain body avoids a CORS preflight so any catch-hook accepts it.
      if (/tool_?call/i.test(d.event_type) && !/result/i.test(d.event_type) && controls.toolWebhook) {
        fetch(controls.toolWebhook, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            source: "tavus-demo",
            conversation_id: conversationId,
            tool: d.properties?.name || d.properties?.function_name || "",
            arguments: d.properties?.arguments ?? d.properties?.args ?? null,
            at: new Date().toISOString(),
          }),
        }).catch(() => {});
        if (controls.toolEcho) say(controls.toolEcho);
      }
    };
    const onSpeaker = () => armInactivity();

    daily.on("app-message", onAppMessage);
    daily.on("active-speaker-change", onSpeaker);
    armInactivity();

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(inactivityTimer);
      clearTimeout(graceTimer);
      daily.off("app-message", onAppMessage);
      daily.off("active-speaker-change", onSpeaker);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily]);

  return (
    <>
      {/* No badge while recording works — it covered call buttons. Only a
          failure warrants pixels, and it's click-transparent. */}
      {controls.recording && recStatus === "error" && (
        <span className="rec-live rec-fail" title="daily recording-error — the call continues but may not be recorded">⚠ recording failed</span>
      )}
      {/* Full-stage capture can't auto-start (browsers require a click for tab
          capture) — one button, one click, then it runs for the whole call. */}
      {stageMode && controls.recording && (!recStatus || recStatus === "error") && (
        <button className="stage-rec-btn" onClick={startStageRecording}
          title='Approve the "share this tab" prompt once — the recording then captures the full stage (canvas, avatar, you) with all audio to S3'>
          ⏺ Record full stage
        </button>
      )}
      {controls.interruptButton && (
        <button className="interrupt-btn" onClick={interrupt} title="Stop the PAL mid-sentence">
          ✋ Interrupt
        </button>
      )}
    </>
  );
}

/* ── Safe storage: persists in a normal browser (your local Vite app);
      silently no-ops where storage is blocked (e.g. claude.ai preview). ── */
const store = {
  get(key, fallback) {
    try { const v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
};
const SCENARIOS_KEY = "tavus_builder_scenarios_v1";
const SCENMETA_KEY = "tavus_builder_scenario_meta_v1"; // name → {updatedAt} for the library list
const REC_KEY = "tavus_builder_recording_v1"; // S3 recording defaults (non-secret identifiers)
const WEBHOOK_KEY = "tavus_builder_webhook_v1"; // callback URL — account plumbing, survives scenario loads
const PROMPT_HISTORY_KEY = "tavus_builder_prompt_history_v1"; // per-PAL persona versions
const APIKEY_KEY = "tavus_builder_api_key_v1";
const SHOWAPI_KEY = "tavus_builder_showapi_v1";

function Field({ label, hint, children }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button className={"toggle" + (on ? " toggle-on" : "")} onClick={() => onChange(!on)} aria-pressed={on} type="button">
      <span className="toggle-dot" />
    </button>
  );
}

/* ── Scripted card renderer: SE-authored content, rendered verbatim.
      Styles: note (text), chart (one "Label: value" bar per line),
      stat (big value + label), image (URL). No model involved. ── */
function ScriptedCard({ card, onAnswer }) {
  const [picked, setPicked] = useState(null); // question style: chosen option index
  useEffect(() => { setPicked(null); }, [card]);
  const lines = String(card.body || "").split("\n").map((l) => l.trim()).filter(Boolean);
  let inner;
  if (card.style === "question") {
    inner = (
      <div className="sc-options">
        {lines.slice(0, 4).map((opt, i) => (
          <button
            key={i}
            type="button"
            className={"sc-opt" + (picked === i ? " on" : "")}
            disabled={picked !== null}
            onClick={() => { setPicked(i); onAnswer?.(opt); }}
          >
            {opt}
          </button>
        ))}
        {picked !== null && <span className="sc-answered">✓ {onAnswer ? "sent to the conversation" : "answered"}</span>}
      </div>
    );
  } else if (card.style === "chart") {
    const rows = lines
      .map((l) => { const m = l.match(/^(.*?)[:|=]\s*([\d.,]+)\s*(.*)$/); return m ? { label: m[1].trim(), value: parseFloat(m[2].replace(/,/g, "")) || 0, suffix: m[3].trim() } : null; })
      .filter(Boolean);
    const max = Math.max(1, ...rows.map((r) => r.value));
    inner = (
      <div className="sc-chart">
        {rows.map((r, i) => (
          <div key={i} className="sc-bar-row">
            <span className="sc-bar-label" title={r.label}>{r.label}</span>
            <span className="sc-bar-track"><span className="sc-bar" style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <span className="sc-bar-val">{r.value.toLocaleString()}{r.suffix ? ` ${r.suffix}` : ""}</span>
          </div>
        ))}
      </div>
    );
  } else if (card.style === "stat") {
    inner = (
      <div className="sc-stat">
        <span className="sc-stat-value">{lines[0] || ""}</span>
        {lines.length > 1 && <span className="sc-stat-label">{lines.slice(1).join(" ")}</span>}
      </div>
    );
  } else if (card.style === "image") {
    inner = <img className="sc-img" src={card.url || ""} alt={card.title || ""} />;
  } else {
    inner = <div className="sc-note">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>;
  }
  return (
    <div className="sc-card">
      {card.title && <div className="sc-title">{card.title}</div>}
      {inner}
    </div>
  );
}

/* ── Demo page: minimal Alto shell around the conversation ──── */

function DemoSite({ site, conversationUrl, conversationId, controls, onStart, onExit, busy, visitor = false, experience = null, slug = null, onCallEnd = null }) {
  // Experience arc: a guided pre-call journey (builder-composed steps +
  // email gate) and a post-call feedback screen around the conversation.
  // All off = the classic landing→call flow.
  const exp = experience || {};
  const journey = Array.isArray(exp.journey) ? exp.journey : [];
  const flowLen = journey.length + (exp.emailGate ? 1 : 0); // email gate is the final flow screen
  const postEnabled = !!(exp.rating || (exp.booking && exp.schedulingUrl) || exp.talkAgain || exp.thanks);
  const [flowIdx, setFlowIdx] = useState(-1); // -1 = not in the pre-call flow
  const [flowAnswers, setFlowAnswers] = useState([]); // [{step, option?, text?}]
  const [gateEmail, setGateEmail] = useState("");
  const [gateErr, setGateErr] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const prefsRef = useRef(null); // completed journey prefs — reused by "talk again"
  const [postCall, setPostCall] = useState(null); // conversation id of the call that just ended
  const [fbRating, setFbRating] = useState(0);
  const [fbComment, setFbComment] = useState("");
  const [fbSent, setFbSent] = useState(false);
  const attendSent = useRef(null);

  /* Resolve raw answers ({step, option, text}) into readable {q, a} pairs —
     what gets stored with the call and shown in Results. */
  const answersRecord = (answers) => (answers || []).map((ans) => {
    const s = journey[ans.step];
    if (!s) return null;
    if (s.type === "question") {
      const a = s.options?.[ans.option];
      return typeof a === "string" ? { q: s.prompt, a } : null;
    }
    if (s.type === "input") {
      const a = String(ans.text ?? "").trim().slice(0, 200);
      return a ? { q: s.prompt, a } : null;
    }
    if (s.type === "personas") {
      const o = s.options?.[ans.option];
      return o ? { q: s.prompt || "Experience", a: o.label } : null;
    }
    return null;
  }).filter(Boolean);

  // Record attendance (and fire the owner's alert webhook, server-side) once
  // per conversation. Builder previews without a captured email skip it —
  // there's nothing to record and the team shouldn't get pinged by tests.
  useEffect(() => {
    if (!conversationId || attendSent.current === conversationId) return;
    const record = answersRecord(prefsRef.current?.answers);
    if (!slug && !visitorEmail && !record.length) return;
    attendSent.current = conversationId;
    fetch("/api/experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "attend",
        conversation_id: conversationId,
        ...(slug ? { slug } : {}),
        ...(visitorEmail ? { email: visitorEmail } : {}),
        ...(record.length ? { answers: record } : {}),
      }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, slug, visitorEmail]);

  const submitFeedback = () => {
    setFbSent(true); // optimistic — feedback is best-effort decoration
    fetch("/api/experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "feedback",
        conversation_id: postCall,
        ...(slug ? { slug } : {}),
        ...(fbRating ? { rating: fbRating } : {}),
        ...(fbComment.trim() ? { comment: fbComment.trim() } : {}),
        ...(visitorEmail ? { email: visitorEmail } : {}),
      }),
    }).catch(() => {});
  };

  // Magic Canvas layout: when a side card is active the stage splits into a
  // video pane + a dedicated canvas panel (the card never overlays the video).
  // The side is kept after deactivation so the exit slide goes back the same way.
  const [canvasPanel, setCanvasPanel] = useState({ active: false, side: "right" });
  // Scripted card currently on screen (deterministic canvas — see CallExtras).
  const [scCard, setScCard] = useState(null);
  useEffect(() => { if (!conversationUrl) setScCard(null); }, [conversationUrl]);
  const onCanvasLayout = useCallback((l) => {
    setCanvasPanel((prev) => ({ active: Boolean(l?.active), side: (l?.active && l.side) || prev.side }));
  }, []);

  // True when the logo image is a wordmark (wide) — the brand text is skipped
  // to avoid "Sendoso Sendoso" in the nav.
  const [logoIsWordmark, setLogoIsWordmark] = useState(false);

  // Load the vendored CVI components (committed under src/components/cvi).
  // The custom call UI is the ONLY call path — there is no hosted-iframe
  // fallback. A load failure (e.g. a chunk lost to a network blip) shows a
  // reload prompt instead of silently downgrading to the Daily prebuilt UI.
  const [cvi, setCvi] = useState(undefined); // undefined=loading, null=load failed, object=ready
  useEffect(() => {
    let alive = true;
    const mods = import.meta.glob("./components/cvi/components/*/index.{tsx,ts,jsx,js}");
    const load = (name) => {
      const key = Object.keys(mods).find((k) => k.includes(`/${name}/`));
      return key ? mods[key]() : Promise.reject(new Error(`${name} not bundled`));
    };
    Promise.all([load("cvi-provider"), load("conversation"), load("magic-canvas")])
      .then(([p, c, m]) => alive && setCvi({ CVIProvider: p.CVIProvider, Conversation: c.Conversation, MagicCanvas: m.MagicCanvas }))
      .catch((e) => {
        console.error("[builder] call interface failed to load:", e);
        if (alive) setCvi(null);
      });
    return () => { alive = false; };
  }, []);

  const stage = () => {
    if (!conversationUrl) {
      if (postCall && postEnabled) {
        return (
          <div className="exp-screen">
            <h3>{exp.thanks || "Thanks for the conversation!"}</h3>
            {exp.rating && !fbSent && (
              <>
                <div className="star-row">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" className={"star" + (fbRating >= n ? " on" : "")} onClick={() => setFbRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>★</button>
                  ))}
                </div>
                <textarea className="exp-comment" value={fbComment} onChange={(e) => setFbComment(e.target.value)} placeholder="Anything you'd tell the team? (optional)" />
                <button className="pill-btn primary" onClick={submitFeedback} disabled={!fbRating && !fbComment.trim()}>Send feedback</button>
              </>
            )}
            {exp.rating && fbSent && <p className="exp-hint">Got it — thank you!</p>}
            <div className="exp-actions">
              {exp.booking && exp.schedulingUrl && (
                <a className={"pill-btn" + (!exp.rating || fbSent ? " primary" : "")} href={exp.schedulingUrl} target="_blank" rel="noreferrer">📅 Book a meeting</a>
              )}
              {exp.talkAgain && (
                <button className="pill-btn" onClick={() => { setPostCall(null); handleStart(); }} disabled={busy}>{busy ? "Connecting…" : "Talk again"}</button>
              )}
              <button className="pill-btn ghost" onClick={() => setPostCall(null)}>Done</button>
            </div>
          </div>
        );
      }
      if (flowIdx >= 0) {
        const dots = (
          <div className="flow-dots" aria-hidden="true">
            {Array.from({ length: flowLen }, (_, d) => <span key={d} className={d <= flowIdx ? "on" : ""} />)}
          </div>
        );
        const back = flowIdx > 0 && (
          <button className="pill-btn ghost" onClick={() => setFlowIdx(flowIdx - 1)}>← Back</button>
        );
        // Final screen: the email gate (when enabled).
        if (flowIdx >= journey.length) {
          return (
            <div className="exp-screen">
              {dots}
              <h3>{journey.length ? "One last thing…" : "Before we start…"}</h3>
              <p className="exp-hint">{exp.emailPrompt || "Where can we reach you? The team likes to know who they're talking to."}</p>
              <input
                className="exp-input"
                type="email"
                value={gateEmail}
                onChange={(e) => { setGateEmail(e.target.value); setGateErr(""); }}
                onKeyDown={(e) => e.key === "Enter" && submitGate()}
                placeholder="you@company.com"
                autoFocus
              />
              {gateErr && <p className="exp-err">{gateErr}</p>}
              <div className="exp-actions">
                {back}
                <button className="pill-btn primary" onClick={submitGate} disabled={busy}>{busy ? "Connecting…" : "Start the conversation"}</button>
                {exp.emailRequired === false && <button className="pill-btn ghost" onClick={() => finishFlow("")} disabled={busy}>Skip</button>}
              </div>
            </div>
          );
        }
        const s = journey[flowIdx];
        const current = flowAnswers.find((a) => a.step === flowIdx);
        if (s.type === "info") {
          return (
            <div className="exp-screen">
              {dots}
              {s.title && <h3>{s.title}</h3>}
              {s.body && <p className="exp-hint" style={{ whiteSpace: "pre-wrap" }}>{s.body}</p>}
              <div className="exp-actions">{back}<button className="pill-btn primary" onClick={advanceFlow}>Continue</button></div>
            </div>
          );
        }
        if (s.type === "video") {
          const embed = videoEmbed(s.url);
          return (
            <div className="exp-screen">
              {dots}
              {s.title && <h3>{s.title}</h3>}
              {embed.kind === "file"
                ? <video className="exp-video" src={embed.src} controls playsInline />
                : <iframe className="exp-video" src={embed.src} title={s.title || "Video"} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />}
              <div className="exp-actions">{back}<button className="pill-btn primary" onClick={advanceFlow}>Continue</button></div>
            </div>
          );
        }
        if (s.type === "question" || s.type === "personas") {
          const opts = s.type === "question" ? (s.options || []).map((o) => ({ label: o })) : (s.options || []);
          return (
            <div className="exp-screen">
              {dots}
              <h3>{s.prompt}</h3>
              <div className="exp-options">
                {opts.map((o, oi) => (
                  <button key={oi} type="button" className={"exp-opt" + (current?.option === oi ? " on" : "")}
                    onClick={() => { setAnswer(flowIdx, { option: oi }); advanceFlow(); }}>
                    {o.label}
                    {o.desc && <span className="exp-opt-desc">{o.desc}</span>}
                  </button>
                ))}
              </div>
              {back && <div className="exp-actions">{back}</div>}
            </div>
          );
        }
        // free-text input step
        return (
          <div className="exp-screen">
            {dots}
            <h3>{s.prompt}</h3>
            <input
              className="exp-input"
              value={current?.text || ""}
              onChange={(e) => setAnswer(flowIdx, { text: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && advanceFlow()}
              placeholder={s.placeholder || "Type your answer…"}
              autoFocus
            />
            <div className="exp-actions">{back}<button className="pill-btn primary" onClick={advanceFlow}>Continue</button></div>
          </div>
        );
      }
      return (
        <div className="demo-cta">
          <button className="pill-btn primary big" onClick={handleStart} disabled={busy}>
            {busy ? "Connecting…" : site.cta || "Start the conversation"}
          </button>
          <span className="demo-cta-hint">Camera and microphone required</span>
        </div>
      );
    }
    if (cvi === undefined) {
      return <span className="demo-cta-hint">Loading…</span>;
    }
    if (cvi) {
      const { CVIProvider, Conversation, MagicCanvas } = cvi;
      // Only wide stages split for canvas cards — the phone screen, the framed
      // kiosk, and the hologram panel are too narrow (or too stylized), so
      // cards keep the overlay behavior there. Scripted cards use the same
      // panel; an interactive Magic Canvas card wins when both are active.
      const wide = format === "desktop" || (format === "kiosk" && kioskLive);
      const split = (canvasPanel.active || !!scCard) && wide;
      return (
        <CVIProvider>
          <div className={"cvi-wrap" + (split ? ` canvas-split canvas-split-${canvasPanel.side}` : "")}>
            {/* The video pane resizes into the space the canvas panel doesn't
                claim, so active cards get their own screen region beside the
                video instead of cutting into it. */}
            <div className="cvi-video-pane">
              <Conversation conversationUrl={conversationUrl} onLeave={handleLeave} />
            </div>
            <div className={`canvas-panel canvas-panel-${canvasPanel.side}`} aria-hidden={scCard && !canvasPanel.active ? undefined : "true"}>
              {scCard && !canvasPanel.active && wide && (
                <ScriptedCard
                  key={scCard.seq}
                  card={scCard.card}
                  onAnswer={(opt) => {
                    scCard.answer?.(opt);
                    // The pick lands with the call record (Results / webhook).
                    if (conversationId) {
                      fetch("/api/experience", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          kind: "attend",
                          conversation_id: conversationId,
                          ...(slug ? { slug } : {}),
                          answers: [{ q: scCard.card.title || "Card question", a: opt }],
                        }),
                      }).catch(() => {});
                    }
                  }}
                />
              )}
            </div>
            {/* Contained inside the stage instead of a full-viewport overlay */}
            <MagicCanvas className="canvas-contained" onError={(e) => console.error("canvas error", e)} onLayoutEffectChange={onCanvasLayout} />
            <CallExtras controls={controls} conversationId={conversationId} onForceLeave={handleLeave} visitor={visitor} onScriptedCard={setScCard} />
          </div>
        </CVIProvider>
      );
    }
    // Load failed — never fall back to the Daily prebuilt UI; ask for a reload.
    return (
      <div className="demo-cta">
        <span className="demo-cta-hint">The call interface didn't load — usually a momentary network blip.</span>
        <button className="pill-btn primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  };

  const format = site.format || "desktop";

  // Kiosk has two faces: the framed totem preview (default — visualize the
  // experience on the hardware) and "live" (chrome-less full-viewport for an
  // actual kiosk/tablet). Fullscreen needs a user gesture, so it rides on the
  // Go-live click; leaving fullscreen (Escape) drops back to the framed view.
  const [kioskLive, setKioskLive] = useState(false);
  const goFullscreen = () => document.documentElement.requestFullscreen?.().catch(() => {});
  const exitFullscreen = () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  const goLive = () => { setKioskLive(true); goFullscreen(); };
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setKioskLive(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const beginCall = () => {
    if (format === "kiosk" && kioskLive) goFullscreen();
    onStart(prefsRef.current || undefined);
  };
  const handleStart = () => {
    // First start walks the guided flow; "talk again" reuses the answers.
    if (flowLen > 0 && !prefsRef.current) { setFlowIdx(0); return; }
    beginCall();
  };
  // Ref mirrors the answers state — an option click can advance and finish
  // the flow in the same tick, before React commits the state update.
  const flowAnswersRef = useRef([]);
  const setAnswer = (stepIdx, ans) => {
    flowAnswersRef.current = [...flowAnswersRef.current.filter((a) => a.step !== stepIdx), { step: stepIdx, ...ans }];
    setFlowAnswers(flowAnswersRef.current);
  };
  const finishFlow = (email) => {
    prefsRef.current = { email: email || "", answers: flowAnswersRef.current };
    if (email) setVisitorEmail(email);
    setFlowIdx(-1);
    beginCall();
  };
  const advanceFlow = () => {
    if (flowIdx + 1 < flowLen) setFlowIdx(flowIdx + 1);
    else finishFlow(""); // no email gate configured — journey ends straight into the call
  };
  const submitGate = () => {
    const e = gateEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setGateErr("That doesn't look like an email address."); return; }
    finishFlow(e);
  };
  // Call over: with any post-call element configured, land on the feedback
  // screen (clearing just the conversation) instead of leaving the page.
  const handleLeave = () => {
    if (postEnabled && conversationId) {
      setPostCall(conversationId);
      setFbRating(0); setFbComment(""); setFbSent(false);
      if (onCallEnd) onCallEnd(); else onExit();
      return;
    }
    onExit();
  };
  const handleExit = () => { exitFullscreen(); onExit(); };

  // Theme override: Claude-extracted brand colors/font applied as CSS vars.
  const t = site.theme || null;
  const themeVars = t ? Object.fromEntries(
    [
      ["--canvas", t.canvas], ["--surface", t.surface], ["--border", t.border],
      ["--text", t.text], ["--muted", t.muted], ["--accent", t.accent],
      ["--font", t.font],
    ].filter(([, v]) => v)
  ) : undefined;

  // Brand the browser tab itself: title + favicon from the logo. Small, but
  // it's half of what makes a page read as "theirs" instead of a tool.
  useEffect(() => {
    if (!site.brand) return;
    const prevTitle = document.title;
    document.title = `${site.brand} — Live demo`;
    let link = null;
    if (site.logoUrl) {
      link = document.createElement("link");
      link.rel = "icon";
      link.href = site.logoUrl;
      document.head.appendChild(link);
    }
    return () => { document.title = prevTitle; if (link) link.remove(); };
  }, [site.brand, site.logoUrl]);

  return (
    <div className={`demo-root demo-${format}${format === "kiosk" && kioskLive ? " demo-kiosk-live" : ""}${t ? " demo-themed" : ""}`} style={themeVars}>
      {format === "kiosk" && kioskLive && (
        <button className="kiosk-exit" onClick={handleExit} title="Back to builder">×</button>
      )}
      <nav className="demo-nav">
        <div className="demo-brandwrap">
          {site.logoUrl ? (
            <img
              src={site.logoUrl}
              alt={site.brand || ""}
              className="demo-logo"
              // Wide image = a wordmark that already spells the brand name —
              // printing it again reads as "Sendoso Sendoso". Square-ish = a
              // glyph, so keep the name beside it.
              onLoad={(e) => setLogoIsWordmark(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight * 2.2)}
              onError={(e) => { e.currentTarget.style.display = "none"; setLogoIsWordmark(false); }}
            />
          ) : (
            <span className="demo-monogram">{(site.brand || "T")[0].toUpperCase()}</span>
          )}
          {!(site.logoUrl && logoIsWordmark) && <span className="demo-brand">{site.brand || "Your Brand"}</span>}
        </div>
        {!visitor && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pill-btn ghost" onClick={onExit}>← Builder</button>
          </div>
        )}
      </nav>

      <main className="demo-main">
        {format === "desktop" && (site.headline || !conversationUrl) && (
          <header className="demo-header">
            {site.brand && <span className="demo-eyebrow">{site.brand} · Live demo</span>}
            <h1>{site.headline || "Talk to our AI expert"}</h1>
            {site.tagline && <p>{site.tagline}</p>}
          </header>
        )}

        {format === "phone" ? (
          /* A screen of "their app": status bar, app header, hero with the CTA,
             and skeleton cards standing in for the host app's own content so
             the screen scrolls like a real app. In-call, the conversation
             takes the phone over full-bleed, FaceTime-style. */
          <div className="phone-frame">
            <div className="phone-island" />
            <div className="phone-screen">
              {conversationUrl || flowIdx >= 0 || (postEnabled && postCall) ? (
                <div className="demo-stage">{stage()}</div>
              ) : (
                <>
                  <div className="app-status">
                    <span>9:41</span>
                    <span className="app-status-icons">▂▄▆█ ⏻</span>
                  </div>
                  <div className="app-scroll">
                    <div className="app-header">
                      {site.logoUrl
                        ? <img src={site.logoUrl} alt="" className="app-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        : <span className="app-monogram">{(site.brand || "T")[0].toUpperCase()}</span>}
                      <span>{site.brand || "Your Brand"}</span>
                    </div>
                    <div className="app-hero">
                      <h2>{site.headline || "Talk to our AI expert"}</h2>
                      {site.tagline && <p>{site.tagline}</p>}
                      <button className="pill-btn primary" onClick={handleStart} disabled={busy}>
                        {busy ? "Connecting…" : site.cta || "Start the conversation"}
                      </button>
                      <span className="demo-cta-hint">Camera and microphone required</span>
                    </div>
                    <div className="app-skeleton" aria-hidden="true">
                      {[
                        ["42%", "78%"], ["58%", "86%"], ["36%", "70%"],
                        ["50%", "82%"], ["44%", "74%"], ["60%", "80%"],
                      ].map(([w1, w2], i) => (
                        <div key={i} className="app-card">
                          <div className="app-line" style={{ width: w1 }} />
                          <div className="app-line dim" style={{ width: w2 }} />
                          {i % 2 === 0 && <div className="app-line dim" style={{ width: "64%" }} />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="app-tabbar" aria-hidden="true">
                    <span className="on">⬤</span><span>⬤</span><span>⬤</span><span>⬤</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : format === "kiosk" && !kioskLive ? (
          /* Framed totem preview — visualize the demo on the hardware it'll
             run on. "Go live" strips the frame for the real thing. */
          <div className="kiosk-scene">
            <div className="kiosk-totem">
              <div className="kiosk-screen">
                {conversationUrl || flowIdx >= 0 || (postEnabled && postCall) ? (
                  <div className="demo-stage">{stage()}</div>
                ) : (
                  <div className="kiosk-attract">
                    {site.logoUrl
                      ? <img src={site.logoUrl} alt="" className="kiosk-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      : <span className="demo-monogram">{(site.brand || "T")[0].toUpperCase()}</span>}
                    <h2>{site.headline || "Talk to our AI expert"}</h2>
                    {site.tagline && <p>{site.tagline}</p>}
                    <button className="kiosk-cta" onClick={handleStart} disabled={busy}>
                      {busy ? "Connecting…" : site.cta || "Touch to start"}
                    </button>
                    <span className="demo-cta-hint">Camera and microphone required</span>
                  </div>
                )}
              </div>
              <div className="kiosk-neck" />
              <div className="kiosk-base" />
            </div>
            <button className="pill-btn" onClick={goLive} title="Chrome-less fullscreen for real kiosk or tablet hardware — Esc comes back to this preview">
              ⛶ Go live — fullscreen kiosk
            </button>
          </div>
        ) : format === "hologram" ? (
          /* Proto-style holobox: white enclosure, speaker grilles, glowing
             portrait screen. The call underneath is the same custom CVI
             stage as every other format — the box is pure chrome. */
          <div className="holo-scene">
            {(site.headline || site.tagline) && (
              <div className="holo-head">
                <h2>{site.headline || "Talk to our AI expert"}</h2>
                {site.tagline && <p>{site.tagline}</p>}
              </div>
            )}
            <div className="holo-box">
              <div className="holo-topbar">
                <span className="holo-brand">{site.brand || "Holobox"}</span>
                <span className="holo-tag">Beam in — live</span>
              </div>
              <div className="holo-screen">
                <div className="demo-stage holo-stage">{stage()}</div>
              </div>
              <div className="holo-foot">powered by tavus</div>
            </div>
          </div>
        ) : (
          <div className="demo-stage">{stage()}</div>
        )}

        <span className="demo-powered">powered by tavus</span>
      </main>
    </div>
  );
}

/* ── Main app ──────────────────────────────────────────────── */

export default function TavusExperienceBuilder() {
  // Duet joiner frames (?duet=join&…) bypass everything — they're the
  // per-room pages the DuetStage iframes load.
  const [duetJoin] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("duet") === "join" && p.get("url")
      ? { url: p.get("url"), id: p.get("id") || "", side: p.get("side") === "b" ? "b" : "a" }
      : null;
  });

  // Visitor mode: shared demo links (/d/{slug} or ?demo=slug) bypass the
  // builder and its login entirely — the link itself is the access.
  const [demoSlug] = useState(() => {
    const m = window.location.pathname.match(/^\/d\/([A-Za-z0-9_-]{6,24})/);
    return m ? m[1] : new URLSearchParams(window.location.search).get("demo");
  });

  const [step, setStep] = useState("start");

  // Login gate. Accounts mode (email+password, invite-code signup) when the
  // server has BUILDER_PASSWORD + Redis; shared-code mode without Redis;
  // fully open when BUILDER_PASSWORD is unset (local dev).
  const [auth, setAuth] = useState({ checked: false, required: false, accounts: false, authed: false, email: null });
  const [authView, setAuthView] = useState("signin"); // signin | signup
  const [passcode, setPasscode] = useState("");       // legacy shared code
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authInvite, setAuthInvite] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    fetch("/api/login")
      .then((r) => (r.ok ? r.json() : { authRequired: false, authed: true }))
      .then((d) => setAuth({ checked: true, required: !!d.authRequired, accounts: !!d.accounts, authed: !!d.authed, email: d.email || null }))
      .catch(() => setAuth({ checked: true, required: false, accounts: false, authed: true, email: null })); // no backend (bare vite) → open
  }, []);

  const submitLogin = async (e) => {
    e.preventDefault();
    setAuthErr("");
    setAuthBusy(true);
    try {
      const body = auth.accounts
        ? { mode: authView, email: authEmail, password: authPassword, invite: authInvite }
        : { password: passcode };
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Sign-in failed.");
      setAuth((a) => ({ ...a, authed: true, email: d.email || null }));
      setPasscode(""); setAuthPassword(""); setAuthInvite("");
    } catch (err) {
      setAuthErr(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "signout" }) }).catch(() => {});
    setAuth((a) => ({ ...a, authed: false, email: null }));
  };

  // Setup
  const [apiKey, setApiKey] = useState("");
  const [faceId, setFaceId] = useState("");
  const [palId, setPalId] = useState("");
  const [language, setLanguage] = useState("english");
  const [conversationName, setConversationName] = useState("");
  // Webhook is account plumbing, not demo content — remembered per browser
  // (like the API key and S3 fields) so scenario loads/reloads can't wipe it.
  const [callbackUrl, setCallbackUrl] = useState(() => store.get(WEBHOOK_KEY, ""));
  useEffect(() => { store.set(WEBHOOK_KEY, callbackUrl); }, [callbackUrl]);
  const [greeting, setGreeting] = useState("");

  // Persona (Claude-drafted system prompt)
  const [personaBrief, setPersonaBrief] = useState({
    product: "", audience: "", goal: "", tone: "", emotions: "", mustCover: "", avoid: "",
  });
  const setBriefField = (k, v) => setPersonaBrief((b) => ({ ...b, [k]: v }));
  const [personaDraft, setPersonaDraft] = useState("");
  const [personaFeedback, setPersonaFeedback] = useState("");

  // Version control for the prompt: every generate / revise / inject / attach
  // snapshots automatically (per PAL, in this browser), restorable one click.
  const [promptHistory, setPromptHistory] = useState(() => store.get(PROMPT_HISTORY_KEY, {}));

  // Test drive: text-only conversation against the PAL (chat mode — same PAL
  // config, no video pipeline). Validates behavior before booting a real call.
  const [chatConvId, setChatConvId] = useState("");
  const [chatLog, setChatLog] = useState([]); // {role: "user"|"pal"|"sys", text}
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState(""); // shown inline — the launch log isn't visible on this step
  const [generating, setGenerating] = useState(false);
  const [personaAttached, setPersonaAttached] = useState(false);

  // Vision (perception layer)
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [visionVibe, setVisionVibe] = useState("");
  const [visualQueriesText, setVisualQueriesText] = useState("");
  const [audioQueriesText, setAudioQueriesText] = useState("");
  const [visionGenerating, setVisionGenerating] = useState(false);

  // Pronunciation dictionary + expressive delivery
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [pronunciationText, setPronunciationText] = useState("");
  const [emotionControl, setEmotionControl] = useState(true);

  // Voice & accent (Cartesia catalog via /api/voices)
  const [externalVoiceId, setExternalVoiceId] = useState("");
  const [externalVoiceName, setExternalVoiceName] = useState("");
  const [voiceQuery, setVoiceQuery] = useState("");
  const [voiceResults, setVoiceResults] = useState(null);
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Tavus-authored skills (PUT /pals/{id}/skills/{skill_id}; persist on the PAL)
  const [internetSearchEnabled, setInternetSearchEnabled] = useState(false);
  const [browserUseEnabled, setBrowserUseEnabled] = useState(false);
  const [browserUseConfig, setBrowserUseConfig] = useState(""); // optional JSON — the skill is new, config schema may grow
  const [browsePlan, setBrowsePlan] = useState(""); // the "talk track" for browsing: when -> which page, one per line

  // Integrations (custom LLM tools → any webhook)
  const [toolsEnabled, setToolsEnabled] = useState(false);
  const [toolRows, setToolRows] = useState([{ name: "", desc: "", fields: "" }]);
  const [toolWebhook, setToolWebhook] = useState("");
  const [toolEcho, setToolEcho] = useState("");

  // Team invites (per-person, single-use sign-up codes)
  const [invites, setInvites] = useState(null);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Demo dashboard (per-slug stats from Redis)
  const [demoStats, setDemoStats] = useState(null);
  const [demoStatsLoading, setDemoStatsLoading] = useState(false);
  const [demoDetail, setDemoDetail] = useState(null);

  // Calls & data (pulled straight from Tavus)
  const [callsList, setCallsList] = useState(null);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callDetail, setCallDetail] = useState(null);
  const [callDetailLoading, setCallDetailLoading] = useState(false);
  const [callsError, setCallsError] = useState(""); // inline — launch log isn't visible on the Results step
  const [callsFilter, setCallsFilter] = useState(""); // the API key is account-wide; scope the view here
  const [onlyMyPal, setOnlyMyPal] = useState(false);
  const [callsPage, setCallsPage] = useState(0); // client-side pagination, 25 per page
  const [recMap, setRecMap] = useState({}); // conversation_id → recording location
  const [expMap, setExpMap] = useState({}); // conversation_id → attendee/feedback record

  // Timing & controls
  const [maxMinutes, setMaxMinutes] = useState("");          // blank = Tavus default (60 min)
  const [timeWarning, setTimeWarning] = useState("");        // spoken with 2 minutes left
  const [inactivitySeconds, setInactivitySeconds] = useState(""); // blank = off
  const [inactivityUtterance, setInactivityUtterance] = useState("");
  const [wakePhrase, setWakePhrase] = useState("");
  const [interruptButton, setInterruptButton] = useState(false);
  const [guardrailEcho, setGuardrailEcho] = useState("");

  // Recording → your S3 bucket (Tavus uploads server-side; no AWS keys here,
  // just non-secret identifiers — access comes from a one-time IAM role trust).
  // ON by default, and the bucket details are remembered on this browser
  // (REC_KEY) so they're entered once, not per demo.
  const [recordingEnabled, setRecordingEnabled] = useState(() => store.get(REC_KEY, {}).enabled ?? true);
  const [recS3Bucket, setRecS3Bucket] = useState(() => store.get(REC_KEY, {}).bucket ?? "");
  const [recS3Region, setRecS3Region] = useState(() => store.get(REC_KEY, {}).region ?? "");
  const [recS3RoleArn, setRecS3RoleArn] = useState(() => store.get(REC_KEY, {}).roleArn ?? "");
  const [recS3ExternalId, setRecS3ExternalId] = useState(() => store.get(REC_KEY, {}).externalId ?? "");
  const [recLayout, setRecLayout] = useState(() => store.get(REC_KEY, {}).layout ?? "everyone"); // everyone | speaker | pal
  useEffect(() => {
    store.set(REC_KEY, { enabled: recordingEnabled, bucket: recS3Bucket, region: recS3Region, roleArn: recS3RoleArn, externalId: recS3ExternalId, layout: recLayout });
  }, [recordingEnabled, recS3Bucket, recS3Region, recS3RoleArn, recS3ExternalId, recLayout]);

  // New-PAL creation (Persona step)
  const [newPalName, setNewPalName] = useState("");
  const [creatingPal, setCreatingPal] = useState(false);
  const [palLlm, setPalLlm] = useState("tavus-glm-4.7");

  // Knowledge Base
  const [kbDocs, setKbDocs] = useState(null); // null = not loaded yet
  const [kbLoading, setKbLoading] = useState(false);
  const [kbUrl, setKbUrl] = useState("");
  const [kbName, setKbName] = useState("");
  const [kbCrawl, setKbCrawl] = useState(false);
  const [kbAdding, setKbAdding] = useState(false);
  const [knowledgeIdsRaw, setKnowledgeIdsRaw] = useState(""); // docs the PAL can reference in-call

  // Presentation
  const [presentationEnabled, setPresentationEnabled] = useState(false);
  const [docIdsRaw, setDocIdsRaw] = useState("");
  const [slidesTrigger, setSlidesTrigger] = useState("walk_the_deck");
  const [presentPrompt, setPresentPrompt] = useState("");
  const [talkTrack, setTalkTrack] = useState([]); // per-slide speaker notes
  const [talkTrackDrafting, setTalkTrackDrafting] = useState(false);

  // Objectives & Guardrails
  const [objectivesEnabled, setObjectivesEnabled] = useState(false);
  const [objectivesText, setObjectivesText] = useState("");
  const [confirmationMode, setConfirmationMode] = useState("auto");
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(false);
  const [guardrailsText, setGuardrailsText] = useState("");

  // Canvas
  const [canvasEnabled, setCanvasEnabled] = useState(false);
  const [components, setComponents] = useState(
    Object.fromEntries(CANVAS_COMPONENTS.map((c) => [c.key, true]))
  );
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [placement, setPlacement] = useState("auto");
  const [canvasStyle, setCanvasStyle] = useState("balanced");
  const [componentRules, setComponentRules] = useState(
    Object.fromEntries(CANVAS_COMPONENTS.map((c) => [c.key, ""]))
  );
  const [canvasPlaybook, setCanvasPlaybook] = useState("");
  // Scripted cards — deterministic canvas content (editor shape; compiled
  // into controlsConfig.scriptedCards so it rides shared links).
  const [scCards, setScCards] = useState([]);

  // Studio — scripted takes recorded as MP4 feature demos.
  const [studioLines, setStudioLines] = useState([{ text: "" }]);
  const [studioActive, setStudioActive] = useState(false);
  const [studioStatus, setStudioStatus] = useState("");
  const [ttsAvail, setTtsAvail] = useState(null); // null=unknown, {available, voice}, or false (probe failed)
  // Duet — two AI humans in conversation. The partner is either an
  // auto-created interviewer PAL (created once, reused, saved with the demo)
  // or any custom PAL — because two customer-facing personas just run their
  // agendas at each other and the opening makes no sense.
  const [duetMode, setDuetMode] = useState("auto"); // "auto" interviewer | "custom" PAL
  const [duetPartnerId, setDuetPartnerId] = useState(""); // cached auto-created interviewer PAL
  const [duetPalB, setDuetPalB] = useState("");
  const [duetFaceB, setDuetFaceB] = useState("");
  const [duetOpener, setDuetOpener] = useState("");
  const [duetTopic, setDuetTopic] = useState("");
  const [duetTurns, setDuetTurns] = useState("6");
  const [duetRun, setDuetRun] = useState(null); // {a, b, stream} while a duet is live
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptFocus, setScriptFocus] = useState("");
  const [cardsBusy, setCardsBusy] = useState(false);
  const [cardsPrompt, setCardsPrompt] = useState("");

  // Demo page
  const [site, setSite] = useState({
    brand: "", logoUrl: "", headline: "", tagline: "", cta: "Start the conversation", format: "desktop",
  });
  const setSiteField = (k, v) => setSite((s) => ({ ...s, [k]: v }));

  // Experience arc — guided pre-call journey + email gate (table stakes:
  // default ON) + attendance alert + post-call feedback.
  // Journey steps the builder composes per demo — the editor shape (question
  // options as one-per-line text) lives here; experienceConfig compiles it.
  const [expJourney, setExpJourney] = useState([]);
  const [expEmailGate, setExpEmailGate] = useState(true);
  const [expEmailRequired, setExpEmailRequired] = useState(true);
  const [expEmailPrompt, setExpEmailPrompt] = useState("");
  const [expNotifyWebhook, setExpNotifyWebhook] = useState("");
  const [expRating, setExpRating] = useState(false);
  const [expBooking, setExpBooking] = useState(false);
  const [expTalkAgain, setExpTalkAgain] = useState(false);
  const [expThanks, setExpThanks] = useState("");

  // Launch
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [toast, setToast] = useState(null); // latest log line, shown on every step
  const toastTimer = useRef(null);
  const [conversation, setConversation] = useState(null);
  const [siteMode, setSiteMode] = useState(false);
  const [copied, setCopied] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);

  // "Start from an idea" — Claude drafts the entire template
  const [ideaText, setIdeaText] = useState("");
  const [ideating, setIdeating] = useState(false);

  // Scenarios (named snapshots of the full builder config).
  // localStorage is the instant/offline cache; the durable copy lives
  // server-side per account (/api/scenarios) so scenarios survive cleared
  // browser storage and follow the user across devices.
  const [scenarios, setScenarios] = useState(() => store.get(SCENARIOS_KEY, {}));
  const [cloudNames, setCloudNames] = useState([]); // scenario names synced to the account
  const [cloudSync, setCloudSync] = useState("unknown"); // "unknown" | "on" | "off"
  const [scenMeta, setScenMeta] = useState(() => store.get(SCENMETA_KEY, {})); // name → {updatedAt, savedBy}
  const [scenarioName, setScenarioName] = useState("");
  // Demo library panel (replaces the old flat dropdown) + post-launch save prompt.
  const [libOpen, setLibOpen] = useState(false);
  const [libQuery, setLibQuery] = useState("");
  const [savePrompt, setSavePrompt] = useState(false);
  const [savePromptName, setSavePromptName] = useState("");
  const promptOnReturn = useRef(false); // set by a successful launch; checked when leaving the demo page
  const [savedFlash, setSavedFlash] = useState(false); // "Saved ✓" blink on the footer Save
  const [activeScenario, setActiveScenario] = useState("");
  const [rememberKey, setRememberKey] = useState(() => !!store.get(APIKEY_KEY, ""));
  const importRef = useRef(null);
  const logoFileRef = useRef(null);
  const kbFileRef = useRef(null);
  const deckFileRef = useRef(null);
  const [brandUrl, setBrandUrl] = useState("");
  const [theming, setTheming] = useState(false);
  const [showApi, setShowApi] = useState(() => store.get(SHOWAPI_KEY, true));

  // Load remembered API key once on mount.
  useEffect(() => {
    const saved = store.get(APIKEY_KEY, "");
    if (saved) setApiKey(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Probe TTS availability when Studio is opened, so the step can show setup
  // guidance instead of failing mid-take.
  useEffect(() => {
    if (step !== "studio" || ttsAvail !== null) return;
    fetch("/api/tts")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setTtsAvail(d))
      .catch(() => setTtsAvail(false));
  }, [step, ttsAvail]);

  // Pull the account's cloud-saved scenario names once signed in. A failure
  // (no Redis attached, bare vite dev) just means localStorage-only mode.
  useEffect(() => {
    if (demoSlug || !auth.checked || (auth.required && !auth.authed)) return;
    let alive = true;
    fetch("/api/scenarios")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!alive) return;
        setCloudNames(Array.isArray(d.names) ? d.names : []);
        if (d.meta && typeof d.meta === "object") setScenMeta((m) => ({ ...m, ...d.meta })); // cloud timestamps win
        setCloudSync("on");
      })
      .catch(() => { if (alive) setCloudSync("off"); });
    return () => { alive = false; };
  }, [demoSlug, auth.checked, auth.required, auth.authed]);

  const toggleRememberKey = (on) => {
    setRememberKey(on);
    store.set(APIKEY_KEY, on ? apiKey : "");
  };
  useEffect(() => { if (rememberKey) store.set(APIKEY_KEY, apiKey); }, [apiKey, rememberKey]);

  const collectConfig = () => ({
    v: 1,
    faceId, palId, language, conversationName, callbackUrl, greeting,
    personaBrief, personaDraft,
    visionEnabled, visionVibe, visualQueriesText, audioQueriesText,
    speechEnabled, pronunciationText, emotionControl, externalVoiceId, externalVoiceName,
    maxMinutes, timeWarning, inactivitySeconds, inactivityUtterance, wakePhrase, interruptButton, guardrailEcho,
    recordingEnabled, recS3Bucket, recS3Region, recS3RoleArn, recS3ExternalId, recLayout,
    toolsEnabled, toolRows, toolWebhook, toolEcho,
    internetSearchEnabled, browserUseEnabled, browserUseConfig, browsePlan,
    presentationEnabled, docIdsRaw, slidesTrigger, presentPrompt, talkTrack,
    objectivesEnabled, objectivesText, confirmationMode, guardrailsEnabled, guardrailsText,
    canvasEnabled, components, schedulingUrl, placement, canvasStyle, componentRules, canvasPlaybook,
    scCards, studioLines, duetMode, duetPartnerId, duetPalB, duetFaceB, duetOpener, duetTopic, duetTurns,
    palLlm, knowledgeIdsRaw,
    site,
    expJourney,
    expEmailGate, expEmailRequired, expEmailPrompt, expNotifyWebhook,
    expRating, expBooking, expTalkAgain, expThanks,
  });

  const applyConfig = (c) => {
    if (!c || typeof c !== "object") return;
    setFaceId(c.faceId ?? ""); setPalId(c.palId ?? ""); setLanguage(c.language ?? "english");
    setConversationName(c.conversationName ?? "");
    // Older scenarios without a webhook must not wipe the remembered one.
    setCallbackUrl(c.callbackUrl || store.get(WEBHOOK_KEY, ""));
    setGreeting(c.greeting ?? "");
    setPersonaBrief({ product: "", audience: "", goal: "", tone: "", emotions: "", mustCover: "", avoid: "", ...(c.personaBrief || {}) });
    setPersonaDraft(c.personaDraft ?? "");
    setPersonaAttached(false);
    setVisionEnabled(!!c.visionEnabled); setVisionVibe(c.visionVibe ?? "");
    setVisualQueriesText(c.visualQueriesText ?? ""); setAudioQueriesText(c.audioQueriesText ?? "");
    setSpeechEnabled(!!c.speechEnabled); setPronunciationText(c.pronunciationText ?? "");
    setEmotionControl(c.emotionControl !== false);
    setExternalVoiceId(c.externalVoiceId ?? ""); setExternalVoiceName(c.externalVoiceName ?? "");
    setMaxMinutes(c.maxMinutes ?? ""); setTimeWarning(c.timeWarning ?? "");
    setInactivitySeconds(c.inactivitySeconds ?? ""); setInactivityUtterance(c.inactivityUtterance ?? "");
    setWakePhrase(c.wakePhrase ?? ""); setInterruptButton(!!c.interruptButton); setGuardrailEcho(c.guardrailEcho ?? "");
    // Recording: scenarios saved before this feature (or without it) fall back
    // to this browser's remembered defaults instead of wiping them.
    const savedRec = store.get(REC_KEY, {});
    setRecordingEnabled(c.recordingEnabled ?? savedRec.enabled ?? true);
    setRecS3Bucket(c.recS3Bucket ?? savedRec.bucket ?? "");
    setRecS3Region(c.recS3Region ?? savedRec.region ?? "");
    setRecS3RoleArn(c.recS3RoleArn ?? savedRec.roleArn ?? "");
    setRecS3ExternalId(c.recS3ExternalId ?? savedRec.externalId ?? "");
    setRecLayout(c.recLayout ?? savedRec.layout ?? "everyone");
    setToolsEnabled(!!c.toolsEnabled);
    setInternetSearchEnabled(!!c.internetSearchEnabled);
    setBrowserUseEnabled(!!c.browserUseEnabled); setBrowserUseConfig(c.browserUseConfig ?? "");
    setBrowsePlan(c.browsePlan ?? "");
    setToolRows(Array.isArray(c.toolRows) && c.toolRows.length ? c.toolRows : [{ name: "", desc: "", fields: "" }]);
    setToolWebhook(c.toolWebhook ?? ""); setToolEcho(c.toolEcho ?? "");
    setPresentationEnabled(!!c.presentationEnabled); setDocIdsRaw(c.docIdsRaw ?? "");
    setSlidesTrigger(c.slidesTrigger ?? "walk_the_deck"); setPresentPrompt(c.presentPrompt ?? "");
    setTalkTrack(Array.isArray(c.talkTrack) ? c.talkTrack : []);
    setObjectivesEnabled(!!c.objectivesEnabled); setObjectivesText(c.objectivesText ?? "");
    setConfirmationMode(c.confirmationMode ?? "auto");
    setGuardrailsEnabled(!!c.guardrailsEnabled); setGuardrailsText(c.guardrailsText ?? "");
    setCanvasEnabled(!!c.canvasEnabled);
    setComponents({ ...Object.fromEntries(CANVAS_COMPONENTS.map((x) => [x.key, true])), ...(c.components || {}) });
    setSchedulingUrl(c.schedulingUrl ?? ""); setPlacement(c.placement ?? "auto");
    setCanvasStyle(c.canvasStyle ?? "balanced");
    setComponentRules({ ...Object.fromEntries(CANVAS_COMPONENTS.map((x) => [x.key, ""])), ...(c.componentRules || {}) });
    setCanvasPlaybook(c.canvasPlaybook ?? "");
    setPalLlm(c.palLlm ?? "tavus-glm-4.7");
    setKnowledgeIdsRaw(c.knowledgeIdsRaw ?? "");
    setSite({ brand: "", logoUrl: "", headline: "", tagline: "", cta: "Start the conversation", format: "desktop", theme: null, ...(c.site || {}) });
    setScCards(Array.isArray(c.scCards) ? c.scCards : []);
    setStudioLines(Array.isArray(c.studioLines) && c.studioLines.length ? c.studioLines : [{ text: "" }]);
    setDuetMode(c.duetMode === "custom" ? "custom" : "auto"); setDuetPartnerId(c.duetPartnerId ?? "");
    setDuetPalB(c.duetPalB ?? ""); setDuetFaceB(c.duetFaceB ?? ""); setDuetOpener(c.duetOpener ?? "");
    setDuetTopic(c.duetTopic ?? ""); setDuetTurns(c.duetTurns ?? "6");
    setExpJourney(Array.isArray(c.expJourney) ? c.expJourney : []);
    // Email capture is table stakes — scenarios saved before the field
    // existed default ON; only an explicit false keeps it off.
    setExpEmailGate(c.expEmailGate === undefined ? true : !!c.expEmailGate);
    setExpEmailRequired(c.expEmailRequired !== false);
    setExpEmailPrompt(c.expEmailPrompt ?? "");
    setExpNotifyWebhook(c.expNotifyWebhook ?? "");
    setExpRating(!!c.expRating);
    setExpBooking(!!c.expBooking);
    setExpTalkAgain(!!c.expTalkAgain);
    setExpThanks(c.expThanks ?? "");
  };

  /* Push one scenario to the account's cloud store. Throws on failure so
     callers can report "saved locally only" instead of pretending. */
  const syncScenarioToCloud = async (name, config) => {
    const r = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `sync failed (${r.status})`);
    setCloudSync("on");
    setCloudNames((ns) => (ns.includes(name) ? ns : [...ns, name].sort()));
  };

  const saveScenario = async (nameArg) => {
    // Falls back to a sensible name so the footer Save works on any step
    // without first typing a name in the top bar. nameArg is a string when
    // called from the library panel / save prompt (onClick passes an event).
    const override = typeof nameArg === "string" ? nameArg : "";
    const name = (override || scenarioName || activeScenario || site.brand || conversationName || "My demo").trim();
    if (!name) return;
    const config = collectConfig();
    const next = { ...scenarios, [name]: config };
    setScenarios(next);
    const localOk = store.set(SCENARIOS_KEY, next);
    const metaNext = { ...scenMeta, [name]: { ...(scenMeta[name] || {}), updatedAt: new Date().toISOString() } };
    setScenMeta(metaNext);
    store.set(SCENMETA_KEY, metaNext);
    setActiveScenario(name);
    setScenarioName("");
    setSavePrompt(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
    if (cloudSync !== "off") {
      try {
        await syncScenarioToCloud(name, config);
        addLog("ok", `Scenario "${name}" saved & synced to your account ☁.`);
        return;
      } catch (e) {
        if (cloudSync === "unknown") setCloudSync("off");
        addLog(localOk ? "info" : "err", `Scenario "${name}" saved in this browser only — cloud sync unavailable (${e.message}).`);
        return;
      }
    }
    addLog(localOk ? "ok" : "info", localOk ? `Scenario "${name}" saved in this browser.` : `Scenario "${name}" saved for this session only — storage is blocked in this environment. Use Export for a file.`);
  };

  const loadScenario = async (name) => {
    if (!name) { setActiveScenario(""); return; }
    const local = scenarios[name] || null;
    // Local copy applies instantly (and covers offline); the cloud copy is
    // the durable source of truth, so it wins when the two differ.
    if (local) {
      applyConfig(local);
      setActiveScenario(name);
    }
    if (cloudSync === "on" && cloudNames.includes(name)) {
      try {
        const r = await fetch(`/api/scenarios?name=${encodeURIComponent(name)}`);
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (d?.config) {
          if (JSON.stringify(d.config) !== JSON.stringify(local)) applyConfig(d.config);
          setActiveScenario(name);
          const next = { ...scenarios, [name]: d.config };
          setScenarios(next);
          store.set(SCENARIOS_KEY, next);
          addLog("info", `Scenario "${name}" loaded from your account ☁.`);
          return;
        }
      } catch {
        if (local) { addLog("info", `Scenario "${name}" loaded from this browser (cloud copy unreachable).`); return; }
        addLog("err", `Couldn't load "${name}" — the cloud copy is unreachable and there's no local copy in this browser.`);
        setActiveScenario("");
        return;
      }
    }
    if (local) { addLog("info", `Scenario "${name}" loaded.`); return; }
    setActiveScenario("");
  };

  const deleteScenario = (nameArg) => {
    const name = typeof nameArg === "string" && nameArg ? nameArg : activeScenario;
    if (!name) return;
    const next = { ...scenarios };
    delete next[name];
    setScenarios(next);
    store.set(SCENARIOS_KEY, next);
    const metaNext = { ...scenMeta };
    delete metaNext[name];
    setScenMeta(metaNext);
    store.set(SCENMETA_KEY, metaNext);
    if (cloudSync === "on" && cloudNames.includes(name)) {
      fetch(`/api/scenarios?name=${encodeURIComponent(name)}`, { method: "DELETE" })
        .then((r) => { if (!r.ok) throw new Error(); setCloudNames((ns) => ns.filter((n) => n !== name)); })
        .catch(() => addLog("err", `"${name}" was removed from this browser but its cloud copy may remain — load it and delete again to retry.`));
    }
    addLog("info", `Demo "${name}" deleted.`);
    if (name === activeScenario) setActiveScenario("");
  };

  /* Unsaved-work detection: the current config differs from the loaded
     demo's saved copy (or nothing is loaded at all). Drives the post-launch
     save prompt. */
  const isConfigDirty = () => {
    const saved = activeScenario ? scenarios[activeScenario] : null;
    if (!saved) return true;
    try { return JSON.stringify(saved) !== JSON.stringify(collectConfig()); } catch { return true; }
  };
  const promptSaveIfDirty = () => {
    if (!isConfigDirty()) return;
    setSavePromptName(activeScenario || conversationName || site.brand || "");
    setSavePrompt(true);
  };

  const exportScenario = () => {
    const name = activeScenario || scenarioName.trim() || "scenario";
    const blob = new Blob([JSON.stringify({ name, config: collectConfig() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tavus-scenario-${name.replace(/[^a-z0-9-_]+/gi, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const importScenario = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const name = (parsed.name || file.name.replace(/\.json$/i, "")).trim();
        const config = parsed.config || parsed;
        applyConfig(config);
        const next = { ...scenarios, [name]: config };
        setScenarios(next);
        store.set(SCENARIOS_KEY, next);
        setActiveScenario(name);
        addLog("ok", `Scenario "${name}" imported and loaded.`);
        // Imported files should become durable too, not stay browser-local.
        if (cloudSync !== "off") {
          syncScenarioToCloud(name, config)
            .then(() => addLog("ok", `Scenario "${name}" synced to your account ☁.`))
            .catch(() => {});
        }
      } catch {
        addLog("err", "Import failed — that file isn't a valid scenario JSON.");
      }
    };
    reader.readAsText(file);
  };

  const docIds = useMemo(
    () => docIdsRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
    [docIdsRaw]
  );
  const knowledgeIds = useMemo(
    () => knowledgeIdsRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
    [knowledgeIdsRaw]
  );
  // Toggle an id inside a whitespace/comma-separated raw string (order-preserving).
  const toggleIdIn = (raw, id) => {
    const ids = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    return (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]).join("\n");
  };

  /* ── Payloads ── */

  const presentationPayload = useMemo(() => {
    const config = { document_ids: docIds };
    if (slidesTrigger) config.slides_trigger = slidesTrigger;
    const promptParts = [];
    if (presentPrompt.trim()) promptParts.push(presentPrompt.trim());
    const track = talkTrack.map((t, i) => ({ t: String(t || "").trim(), n: i + 1 })).filter((x) => x.t);
    if (track.length) {
      promptParts.push(
        "Slide-by-slide talk track — follow it as you present, in your own natural voice:\n" +
        track.map(({ t, n }) => `Slide ${n}: ${t}`).join("\n")
      );
    }
    if (promptParts.length) config.prompt = promptParts.join("\n\n");
    return { config };
  }, [docIds, slidesTrigger, presentPrompt, talkTrack]);

  const canvasPayload = useMemo(() => {
    const overlay = {};
    for (const [k, on] of Object.entries(components)) {
      if (!on) overlay[k] = { enabled: false };
    }
    if (components.scheduling_embed && schedulingUrl.trim()) {
      overlay.scheduling_embed = { provider: "calendly", scheduling_url: schedulingUrl.trim() };
    }
    return { config: Object.keys(overlay).length ? { components: overlay } : {} };
  }, [components, schedulingUrl]);

  const conversationPayload = useMemo(() => {
    const body = { face_id: faceId.trim(), pal_id: palId.trim() };
    if (conversationName.trim()) body.conversation_name = conversationName.trim();
    if (callbackUrl.trim()) body.callback_url = callbackUrl.trim();
    if (greeting.trim()) body.custom_greeting = greeting.trim();

    // When recording is on, route callbacks through our hook so the Calls &
    // Data step can show where each recording landed. A user-configured
    // webhook still gets every event — the hook forwards via ?fwd=.
    const recordingActive = recordingEnabled && !!(recS3Bucket.trim() && recS3Region.trim() && recS3RoleArn.trim());
    if (recordingActive && typeof window !== "undefined") {
      const hook = `${window.location.origin}/api/recording-hook`;
      body.callback_url = callbackUrl.trim() ? `${hook}?fwd=${encodeURIComponent(callbackUrl.trim())}` : hook;
    }

    const parts = [];

    if (wakePhrase.trim()) {
      parts.push(
        `Wake phrase: after greeting the user once, stay quiet and do not respond to speech until someone says "${wakePhrase.trim()}" (or a close variation). Once you hear it, engage normally for the rest of the conversation. If people talk among themselves without saying it, remain silent.`
      );
    }

    // Browse plan rides conversational_context (per-demo, like canvas rules).
    if (browserUseEnabled && browsePlan.trim()) {
      parts.push(
        "Browsing plan - drive the live browser to these pages at these moments (never read URLs aloud, never announce that you are opening a browser; bring the page up and talk about what is on it):\n" +
        browsePlan.trim()
      );
    }

    if (recordingEnabled && recLayout === "stage") {
      parts.push(
        "If a screen share from the visitor appears, ignore it completely and never mention it — it is a recording tap of this same call, not content to look at or discuss."
      );
    }

    if (canvasEnabled) {
      const styleText = {
        eager: "Use Magic Canvas cards frequently and proactively — whenever a card could make information clearer or capture input, show one.",
        balanced: "",
        minimal: "Use Magic Canvas cards sparingly — only when a card is clearly more effective than speaking.",
        on_request: "Do not show Magic Canvas cards unless the user explicitly asks to see one, or a rule below says to.",
      }[canvasStyle];
      if (styleText) parts.push(styleText);

      // Always-on formatting contract for card content. Without it models pack
      // whole lists into one run-on paragraph with inline dashes — unreadable
      // on the card (seen in live demos).
      parts.push(
        "Magic Canvas card formatting (every card, no exceptions):\n" +
        "- Cards render markdown. Any list goes one item per line as real markdown bullets (\"- item\") — never chained into a single paragraph with dashes, commas, or semicolons.\n" +
        "- Status checklists are bullets too — one bullet per row, like \"- First name — CONFIRMED\" then \"- Date of birth — IN PROCESS\"; never several statuses on one line.\n" +
        "- Keep cards scannable: title of 2-5 words, at most 6 bullets, each bullet under 8 words. Say the detail out loud instead of cramming it onto the card.\n" +
        "- One idea per card; show a new card for a new topic instead of appending to an old one.\n" +
        "- Prefer the structured card for the job — Question for choices, Input for capturing details, Calendar for dates — over a Text card describing the same thing."
      );

      const rules = CANVAS_COMPONENTS
        .filter((c) => components[c.key] && componentRules[c.key].trim())
        .map((c) => `- ${c.label} card: ${componentRules[c.key].trim()}`);
      if (rules.length) parts.push("Rules for when to show specific cards:\n" + rules.join("\n"));

      if (canvasPlaybook.trim()) parts.push("Canvas playbook:\n" + canvasPlaybook.trim());

      if (placement !== "auto")
        parts.push(`When you show Magic Canvas cards, always set layout.preferred_slot to "safe-area-${placement}" so cards appear on the ${placement} side of the video.`);
    }

    if (parts.length) body.conversational_context = parts.join("\n\n");

    if (knowledgeIds.length) body.document_ids = knowledgeIds;

    body.properties = { language };
    const mins = parseInt(maxMinutes, 10);
    if (mins > 0) body.properties.max_call_duration = mins * 60;

    // Recording to the customer's S3 bucket. Tavus does the upload server-side;
    // the browser only ever handles non-secret identifiers (bucket/role names).
    if (recordingEnabled && recS3Bucket.trim() && recS3Region.trim() && recS3RoleArn.trim()) {
      body.properties.enable_recording = true;
      body.properties.recording_storage = {
        provider: "s3",
        bucket_name: recS3Bucket.trim(),
        bucket_region: recS3Region.trim(),
        assume_role_arn: recS3RoleArn.trim(),
      };
      if (recS3ExternalId.trim()) body.properties.recording_storage.external_id = recS3ExternalId.trim();
    }
    return body;
  }, [faceId, palId, conversationName, callbackUrl, greeting, language, canvasEnabled, placement, canvasStyle, componentRules, canvasPlaybook, knowledgeIds, wakePhrase, maxMinutes, recordingEnabled, recS3Bucket, recS3Region, recS3RoleArn, recS3ExternalId, recLayout, browserUseEnabled, browsePlan]);

  const objectivesPayload = useMemo(
    () => ({ data: parseObjectives(objectivesText, confirmationMode) }),
    [objectivesText, confirmationMode]
  );
  const guardrailsParsed = useMemo(() => parseGuardrails(guardrailsText), [guardrailsText]);

  const visionPayload = useMemo(() => {
    const lines = (t) => t.split("\n").map((s) => s.trim().replace(/^[-*•]\s*/, "")).filter(Boolean);
    const value = { perception_model: "raven-1" };
    const visual = lines(visualQueriesText);
    const audio = lines(audioQueriesText);
    if (visual.length) value.visual_awareness_queries = visual;
    if (audio.length) value.audio_awareness_queries = audio;
    return value;
  }, [visualQueriesText, audioQueriesText]);

  /* Plain-English tool rows → OpenAI function-shape tools for the PAL's LLM. */
  const toolDefs = useMemo(() => toolRows
    .filter((r) => r.name.trim() && r.desc.trim())
    .map((r) => {
      const name = r.name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "tool";
      const fields = r.fields.split(",").map((f) => f.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")).filter(Boolean);
      return {
        type: "function",
        function: {
          name,
          description: r.desc.trim(),
          parameters: {
            type: "object",
            properties: Object.fromEntries(fields.map((f) => [f, { type: "string" }])),
            required: fields,
          },
        },
      };
    }), [toolRows]);

  /* Editor shape → the scripted cards that ship. Incomplete cards drop out
     silently (missing content or an unusable trigger). */
  const compiledScriptedCards = useMemo(() => scCards.map((c) => {
    const t = (v) => String(v ?? "").trim();
    const style = ["note", "chart", "stat", "image", "question"].includes(c.style) ? c.style : "note";
    const trigger = ["keyword", "time", "start"].includes(c.trigger) ? c.trigger : "keyword";
    const card = {
      style,
      trigger,
      title: t(c.title),
      body: t(c.body),
      url: t(c.url),
      keywords: t(c.keywords),
      atSeconds: Math.max(0, Math.round((parseFloat(c.atMinutes) || 0) * 60)),
      hideAfter: Math.max(0, parseInt(c.hideAfter, 10) || 0),
    };
    if (style === "image" ? !card.url : !card.body) return null;
    if (trigger === "keyword" && !card.keywords) return null;
    if (trigger === "time" && !card.atSeconds) return null;
    return card;
  }).filter(Boolean).slice(0, 12), [scCards]);

  const controlsConfig = useMemo(() => ({
    scriptedCards: compiledScriptedCards,
    maxSeconds: parseInt(maxMinutes, 10) > 0 ? parseInt(maxMinutes, 10) * 60 : 0,
    timeWarning: timeWarning.trim(),
    inactivitySeconds: parseInt(inactivitySeconds, 10) > 0 ? parseInt(inactivitySeconds, 10) : 0,
    inactivityUtterance: inactivityUtterance.trim(),
    interruptButton,
    guardrailEcho: guardrailEcho.trim(),
    toolWebhook: toolsEnabled ? toolWebhook.trim() : "",
    toolEcho: toolsEnabled ? toolEcho.trim() : "",
    // Recording doesn't start on its own — the call UI must call
    // daily.startRecording() once joined. CallExtras does that when this is set.
    recording: recordingEnabled && !!(recS3Bucket.trim() && recS3Region.trim() && recS3RoleArn.trim()),
    recordingLayout: recLayout,
  }), [compiledScriptedCards, maxMinutes, timeWarning, inactivitySeconds, inactivityUtterance, interruptButton, guardrailEcho, toolsEnabled, toolWebhook, toolEcho, recordingEnabled, recS3Bucket, recS3Region, recS3RoleArn, recLayout]);

  /* Journey editor helpers — steps the builder composes for the guided
     pre-call flow (waiver questions, persona pickers, videos, …). */
  const addJourneyStep = (type) => setExpJourney((j) => (j.length >= 8 ? j : [
    ...j,
    type === "personas"
      ? { type, prompt: "", options: [{ label: "", desc: "", context: "" }, { label: "", desc: "", context: "" }] }
      : { type },
  ]));
  const patchJourneyStep = (i, patch) => setExpJourney((j) => j.map((s, x) => (x === i ? { ...s, ...patch } : s)));
  const moveJourneyStep = (i, d) => setExpJourney((j) => {
    if (!j[i + d]) return j;
    const n = [...j];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    return n;
  });
  const removeJourneyStep = (i) => setExpJourney((j) => j.filter((_, x) => x !== i));
  const patchPersonaOption = (i, oi, patch) => setExpJourney((j) => j.map((s, x) =>
    (x === i ? { ...s, options: (s.options || []).map((o, y) => (y === oi ? { ...o, ...patch } : o)) } : s)
  ));

  /* Editor shape → the compiled journey that ships (incomplete steps drop out
     silently so a half-edited step never breaks a live link). */
  const compiledJourney = useMemo(() => expJourney.map((s) => {
    const t = (v) => String(v ?? "").trim();
    if (s.type === "info") return (t(s.title) || t(s.body)) ? { type: "info", title: t(s.title), body: t(s.body) } : null;
    if (s.type === "video") return t(s.url) ? { type: "video", title: t(s.title), url: t(s.url) } : null;
    if (s.type === "question") {
      const options = String(s.optionsText ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6);
      return t(s.prompt) && options.length >= 2 ? { type: "question", prompt: t(s.prompt), options } : null;
    }
    if (s.type === "input") return t(s.prompt) ? { type: "input", prompt: t(s.prompt), placeholder: t(s.placeholder) } : null;
    if (s.type === "personas") {
      const options = (s.options || [])
        .map((o) => ({ label: t(o.label), desc: t(o.desc), context: t(o.context), greeting: t(o.greeting), palId: t(o.palId) }))
        .filter((o) => o.label)
        .slice(0, 4);
      return options.length >= 2 ? { type: "personas", prompt: t(s.prompt) || "Choose your experience", options } : null;
    }
    return null;
  }).filter(Boolean), [expJourney]);

  /* Experience arc config — travels to DemoSite (preview) and into the stored
     demo snapshot (shared links). notifyWebhook is stripped from the public
     demo GET server-side; only /api/experience reads it, at alert time. */
  const experienceConfig = useMemo(() => ({
    journey: compiledJourney,
    emailGate: expEmailGate,
    emailRequired: expEmailRequired,
    emailPrompt: expEmailPrompt.trim(),
    notifyWebhook: expNotifyWebhook.trim(),
    rating: expRating,
    booking: expBooking,
    schedulingUrl: schedulingUrl.trim(),
    talkAgain: expTalkAgain,
    thanks: expThanks.trim(),
  }), [compiledJourney, expEmailGate, expEmailRequired, expEmailPrompt, expNotifyWebhook, expRating, expBooking, schedulingUrl, expTalkAgain, expThanks]);

  const pronunciationRules = useMemo(() => parsePronunciation(pronunciationText), [pronunciationText]);
  const pronunciationPayload = useMemo(
    () => ({ name: `${(site.brand || conversationName || "builder").slice(0, 240)} dictionary`, rules: pronunciationRules }),
    [site.brand, conversationName, pronunciationRules]
  );

  /* ── curl preview ── */

  const curlFor = (method, path, body) =>
    [
      `curl -X ${method} ${API_BASE}${path} \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "x-api-key: ${apiKey ? "••••••••" : "<your-api-key>"}" \\`,
      `  -d '${JSON.stringify(body, null, 2).replace(/'/g, "\\'")}'`,
    ].join("\n");

  const preview = useMemo(() => {
    const pal = palId.trim() || "{pal_id}";
    if (step === "persona")
      return {
        title: "PATCH /pals/… (system_prompt)",
        text: curlFor("PATCH", `/pals/${pal}`, [
          { op: "add", path: "/system_prompt", value: personaDraft.trim() || "<generated persona prompt>" },
        ]),
      };
    if (step === "guide") {
      if (guardrailsEnabled && guardrailsParsed.length && !(objectivesEnabled && objectivesPayload.data.length))
        return { title: "POST /guardrails (one per rule)", text: curlFor("POST", "/guardrails", guardrailsParsed[0]) };
      return { title: "POST /objectives", text: curlFor("POST", "/objectives", objectivesPayload) };
    }
    if (step === "vision")
      return { title: "PATCH /pals/… (perception)", text: curlFor("PATCH", `/pals/${pal}`, [{ op: "add", path: "/layers/perception", value: visionPayload }]) };
    if (step === "kb")
      return { title: "POST /documents", text: curlFor("POST", "/documents", { document_url: kbUrl.trim() || "https://…/deck.pdf", ...(kbName.trim() ? { document_name: kbName.trim() } : {}), ...(kbCrawl ? { crawl: { depth: 2, max_pages: 25 } } : {}) }) };
    if (step === "speech")
      return { title: "POST /pronunciation-dictionaries", text: curlFor("POST", "/pronunciation-dictionaries", pronunciationPayload) };
    if (step === "tools")
      return { title: "PATCH /pals/… (llm tools)", text: curlFor("PATCH", `/pals/${pal}`, [{ op: "add", path: "/layers/llm/tools", value: toolDefs }]) };
    if (step === "calls")
      return {
        title: "GET /conversations/{id}?verbose=true",
        text: [
          `curl ${API_BASE}/conversations/{conversation_id}?verbose=true \\`,
          `  -H "x-api-key: ${apiKey ? "••••••••" : "<your-api-key>"}"`,
        ].join("\n"),
      };
    if (step === "presentation")
      return { title: "PUT /pals/…/skills/presentation", text: curlFor("PUT", `/pals/${pal}/skills/presentation`, presentationPayload) };
    if (step === "canvas")
      return { title: "PUT /pals/…/skills/magic_canvas", text: curlFor("PUT", `/pals/${pal}/skills/magic_canvas`, canvasPayload) };
    if (step === "experience")
      // Not a Tavus API — this one hits the builder's own backend.
      return {
        title: "POST /api/experience (builder backend)",
        text: [
          `curl -X POST ${window.location.origin}/api/experience \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '${JSON.stringify({ kind: "attend", slug: "<demo-slug>", conversation_id: "<c…>", email: "visitor@company.com" }, null, 2)}'`,
        ].join("\n"),
      };
    return { title: "POST /conversations", text: curlFor("POST", "/conversations", conversationPayload) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, palId, apiKey, personaDraft, visionPayload, pronunciationPayload, presentationPayload, canvasPayload, conversationPayload, objectivesPayload, guardrailsParsed, objectivesEnabled, guardrailsEnabled, kbUrl, kbName, kbCrawl, toolDefs]);

  /* ── API ── */

  /* Log entries also flash as a global toast — the full log only renders on
     the Launch step, and errors elsewhere used to vanish into it silently. */
  const addLog = (kind, msg) => {
    setLog((l) => [...l, { kind, msg, t: new Date().toLocaleTimeString() }]);
    setToast({ kind, msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), kind === "err" ? 15000 : 6000);
  };

  const tavusFetch = async (method, path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    // 304 = "already in that state" (e.g. a PATCH that changes nothing) — success.
    if (!res.ok && res.status !== 304) throw new Error(`${res.status}: ${data.message || data.error || text || "request failed"}`);
    return data;
  };

  /* ── Persona: Claude drafts the system prompt via the backend ── */

  /* Presentation setup as Claude context. Generate AND revise send this —
     the persona can only integrate the deck when Claude knows the trigger
     mode, the operator's directions, and the talk track (was a bare boolean,
     which is why revise feedback about presenting had nothing to work with). */
  const presentationContext = () => {
    if (!presentationEnabled || docIds.length === 0) return null;
    const track = talkTrack
      .map((t, i) => ({ n: i + 1, t: String(t || "").trim() }))
      .filter((x) => x.t);
    return {
      slidesTrigger,
      prompt: presentPrompt.trim(),
      slideCount: talkTrack.length,
      talkTrack: track.map(({ n, t }) => `Slide ${n}: ${t}`).join("\n").slice(0, 3000),
    };
  };

  const generatePersona = async () => {
    setGenerating(true);
    snapshotManualEdits(); // don't lose hand-edits to a regenerate
    setPersonaDraft("");
    setPersonaAttached(false);

    // "Must avoid" doubles as guardrails — merge those lines into the
    // Guardrails step (deduped) so rules live in one place.
    const avoidLines = personaBrief.avoid.split("\n").map((s) => s.trim()).filter(Boolean);
    if (avoidLines.length) {
      const existing = new Set(
        guardrailsText.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean)
      );
      const fresh = avoidLines.filter((l) => !existing.has(l.toLowerCase()));
      if (fresh.length) {
        setGuardrailsText((t) => (t.trim() ? `${t.replace(/\s+$/, "")}\n` : "") + fresh.join("\n"));
        setGuardrailsEnabled(true);
        addLog("info", `Moved ${fresh.length} "must avoid" item${fresh.length > 1 ? "s" : ""} into Guardrails — they'll attach as real guardrails on launch.`);
      }
    }

    try {
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: personaBrief,
          context: {
            brand: site.brand,
            objectives: objectivesEnabled ? objectivesText.trim() : "",
            guardrails: guardrailsEnabled ? guardrailsText.trim() : "",
            presentation: presentationContext(),
            canvas: canvasEnabled,
            canvasPlaybook: canvasEnabled ? canvasPlaybook.trim() : "",
            // The prompt should know every attached capability, not just flow:
            vision: visionEnabled ? [visualQueriesText, audioQueriesText].map((t) => t.trim()).filter(Boolean).join("\n") : "",
            knowledge: knowledgeIds.length > 0,
            tools: toolsEnabled ? toolRows.map((r) => r.name).filter((n) => n.trim()).join(", ") : "",
          },
        }),
      });
      if (!res.ok && !res.body) throw new Error(`${res.status}: generation failed`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setPersonaDraft(text);
      }
      if (text.startsWith("[error]") || !res.ok) {
        setPersonaDraft("");
        let msg = text.replace(/^\[error\]\s*/, "");
        try { msg = JSON.parse(text).error || msg; } catch { /* plain text */ }
        // 401 → login required (session expired, or the password was set after
        // this tab loaded). Force `required` too, so the lock screen appears
        // even when the initial /api/login check predates the password.
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(msg || `${res.status}: generation failed`);
      }
      pushPromptVersion("Generated from brief", text);
      addLog("ok", "Persona prompt drafted — review it, then attach to the PAL.");
    } catch (e) {
      addLog("err", `Persona generation: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  /* ── Prompt version control ── */

  const promptHistoryKey = () => palId.trim() || "unassigned";
  const promptVersions = promptHistory[promptHistoryKey()] || [];

  const pushPromptVersion = (source, text = personaDraft, extra = {}) => {
    const t = String(text || "").trim();
    if (!t) return;
    setPromptHistory((h) => {
      const key = palId.trim() || "unassigned";
      const list = h[key] || [];
      const next = { ...h };
      if (list[0]?.text === t) {
        // Same text — merge flags (e.g. mark the current version as attached).
        next[key] = [{ ...list[0], ...extra }, ...list.slice(1)];
      } else {
        next[key] = [{ text: t, at: new Date().toISOString(), source, ...extra }, ...list].slice(0, 25);
      }
      store.set(PROMPT_HISTORY_KEY, next);
      return next;
    });
  };

  // Uncommitted hand-edits get their own snapshot before anything overwrites them.
  const snapshotManualEdits = () => {
    const cur = personaDraft.trim();
    if (cur && cur !== (promptVersions[0]?.text || "")) pushPromptVersion("Manual edits");
  };

  const restorePromptVersion = (v) => {
    snapshotManualEdits();
    setPersonaDraft(v.text);
    setPersonaAttached(false);
    addLog("ok", `Restored the "${v.source}" version from ${String(v.at).slice(0, 16).replace("T", " ")} — re-attach to make it live.`);
  };

  /* Revise from plain-English feedback ("less salesy", "stop looping on the
     email ask", …) — an edit, not a regenerate. Prompt AND objectives are
     revised together: objectives drive the flow mechanically, so flow feedback
     has to land there, not just in prompt prose. */
  const revisePersona = async (feedbackOverride, sourceLabel) => {
    // Callable two ways: from the feedback field (uses personaFeedback state)
    // or programmatically with an instruction string (canvas/slides inject).
    const feedback = typeof feedbackOverride === "string" ? feedbackOverride : personaFeedback;
    if (!personaDraft.trim() || !feedback.trim()) return;
    setGenerating(true);
    const previous = personaDraft;
    snapshotManualEdits(); // hand-edits survive even if the revision lands
    setPersonaAttached(false);
    try {
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "revise",
          draft: previous,
          vibe: feedback,
          context: {
            objectives: objectivesEnabled ? objectivesText : "",
            guardrails: guardrailsEnabled ? guardrailsText : "",
            presentation: presentationContext(),
          },
        }),
      });
      if (!res.ok && !res.body) throw new Error(`${res.status}: revision failed`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      if (text.startsWith("[error]") || !res.ok) {
        let msg = text.replace(/^\[error\]\s*/, "");
        try { msg = JSON.parse(text).error || msg; } catch { /* plain text */ }
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(msg || `${res.status}: revision failed`);
      }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Claude's revision came back malformed — try again.");
      const rev = JSON.parse(jsonMatch[0]);
      if (!rev.prompt || !String(rev.prompt).trim()) throw new Error("Claude's revision came back empty — try again.");

      setPersonaDraft(String(rev.prompt));
      pushPromptVersion(sourceLabel || `Revised: "${feedback.slice(0, 48)}${feedback.length > 48 ? "…" : ""}"`, String(rev.prompt));
      const changed = ["prompt"];
      if (Array.isArray(rev.objectives)) {
        setObjectivesText(rev.objectives.join("\n"));
        setObjectivesEnabled(true);
        changed.push("objectives");
      }
      if (Array.isArray(rev.guardrails)) {
        setGuardrailsText(rev.guardrails.join("\n"));
        setGuardrailsEnabled(true);
        changed.push("guardrails");
      }
      setPersonaFeedback("");
      if (rev.note) addLog("info", `Revision: ${rev.note}`);
      addLog("ok", `Revised ${changed.join(" + ")}. Re-attach the prompt now; ${changed.includes("objectives") ? "the updated objectives re-attach on your next launch." : "objectives were untouched."}`);
    } catch (e) {
      setPersonaDraft(previous); // never lose the draft to a failed revision
      addLog("err", `Persona revision: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  /* Slides → prompt: the presentation skill shares the deck, but the persona
     only presents WELL when the prompt owns the beat — when the deck starts,
     the pacing, resuming after questions, closing it. Same revise machinery
     as the canvas inject. */
  const injectPresentationIntoPrompt = async () => {
    if (!personaDraft.trim()) {
      addLog("err", "Slides inject: draft a persona first (Persona step) — there's no prompt to weave the deck into.");
      return;
    }
    if (!presentationEnabled || docIds.length === 0) {
      addLog("err", "Slides inject: turn on Slides and attach a deck first.");
      return;
    }
    const parts = [
      slidesTrigger === "walk_the_deck"
        ? "Integrate the slide deck into the persona as the backbone of the call. Add or adjust a dedicated presenting section: open with a short personal beat to build rapport, then transition into the deck and WALK IT — one slide at a time, a couple of spoken sentences per slide in the persona's own voice, and a check-in question every slide or two so it stays a conversation, not a lecture. Mirror the deck walk in the objectives so the flow actually reaches the deck and finishes it."
        : "Integrate the slide deck into the persona as an on-demand asset. Add or adjust a dedicated presenting section: the persona offers or opens slides only when the visitor asks or the moment clearly calls for one, presents the relevant slide in its own voice, then returns to open conversation. Mirror any beat this needs in the objectives.",
      "Hard rules to include: while a slide is up, speak to THAT slide only — never read it verbatim, never describe slides that aren't visible. When the visitor interrupts with a question, answer it fully, then resume exactly where the deck left off. Close the deck cleanly before moving to next steps (booking, wrap-up). Never speak stage directions — no 'let me show slide three', no narrating that it is presenting; transitions happen naturally in speech.",
    ];
    if (presentPrompt.trim()) parts.push(`Operator's presenting directions — fold these in:\n${presentPrompt.trim()}`);
    const track = talkTrack
      .map((t, i) => ({ n: i + 1, t: String(t || "").trim() }))
      .filter((x) => x.t);
    if (track.length) {
      parts.push(
        `Slide-by-slide talk track (already attached to the presentation skill — make the persona's flow consistent with it, don't copy it verbatim):\n` +
        track.map(({ n, t }) => `Slide ${n}: ${t}`).join("\n").slice(0, 3000)
      );
    }
    await revisePersona(parts.join("\n\n"), "Slides woven into prompt");
  };

  /* Canvas → prompt: cards only appear when the conversation creates their
     moment; this asks Claude to weave those moments (and show-instructions)
     into the persona itself, via the same revise machinery. */
  const injectCanvasIntoPrompt = async () => {
    if (!personaDraft.trim()) {
      addLog("err", "Canvas inject: draft a persona first (Persona step) — there's no prompt to weave the cards into.");
      return;
    }
    const cards = CANVAS_COMPONENTS
      .filter((c) => components[c.key])
      .map((c) => `- ${c.label} card${componentRules[c.key].trim() ? `: ${componentRules[c.key].trim()}` : " (no rule written — pick a sensible moment or ignore it)"}`);
    const parts = [
      "Weave the Magic Canvas cards into the persona so the conversation actually CREATES the moment each card needs, then shows it. Add or adjust a section instructing the persona, for each card below, to (a) steer the conversation toward that moment naturally and (b) show the card the instant the moment happens. If a card's moment requires a beat the conversation doesn't have yet (e.g. 'added to cart' needs an add-to-cart beat), add that beat to the flow — and mirror it in the objectives.",
      "Three hard rules to include: the persona NEVER speaks stage directions — never says 'show card', reads card instructions aloud, or narrates that it is displaying something; cards happen silently alongside natural speech. Whenever the visitor offers a specific detail worth capturing (a size, an email, a preference), that is an input-card moment — capture it with the card while acknowledging it in speech. And card content is formatted for scanning: markdown bullets one item per line (never a run-on paragraph with inline dashes), title of 2-5 words, at most 6 bullets of under 8 words each.",
      `Enabled cards:\n${cards.join("\n")}`,
    ];
    if (canvasPlaybook.trim()) parts.push(`Canvas playbook:\n${canvasPlaybook.trim()}`);
    if (schedulingUrl.trim()) parts.push("A live Calendly booking card is available — treat booking time as a real closing move.");
    await revisePersona(parts.join("\n\n"), "Canvas woven into prompt");
  };

  /* Browsing → prompt: same pattern as canvas/slides. The browse plan rides
     each conversation; this weaves the MOMENTS into the persona + objectives
     so the flow actually reaches them. */
  const injectBrowsingIntoPrompt = async () => {
    if (!personaDraft.trim()) {
      addLog("err", "Browsing inject: draft a persona first (Persona step) — there's no prompt to weave the browsing into.");
      return;
    }
    const parts = [
      "The persona can drive a live web browser on the call (Browser Use skill). Weave browsing into the persona: add or adjust a section instructing it to (a) steer the conversation toward each browsing moment below, (b) bring the page up at that moment and speak to what's ON the page, and (c) mirror any new beats in the objectives so the flow reaches them.",
      "Hard rules to include: never read URLs aloud; never announce mechanics ('let me open a browser', 'I'm navigating to') — the page appears while it talks naturally; if the browser fails or a page won't load, continue the conversation from its own knowledge without comment.",
    ];
    if (browsePlan.trim()) parts.push(`Browsing plan (when → which page):\n${browsePlan.trim()}`);
    else parts.push("No specific pages are planned — add a short section saying it may pull up relevant public pages when showing beats telling.");
    await revisePersona(parts.join("\n\n"), "Browsing woven into prompt");
  };

  /* ── Test drive: text-only chat against the PAL (no video, no camera).
        POST /conversations {chat:true} → /respond per turn (poll until ready).
        Runs the PAL's ATTACHED config — attach the latest prompt first. ── */

  const startTestDrive = async () => {
    if (!apiKey.trim() || !palId.trim()) { setChatError("Needs the Tavus API key and PAL ID from the Account step first."); return; }
    setChatBusy(true);
    setChatError("");
    try {
      const body = { persona_id: palId.trim(), chat: true, conversation_name: "Builder test drive" };
      if (greeting.trim()) body.custom_greeting = greeting.trim();
      const d = await tavusFetch("POST", "/conversations", body);
      setChatConvId(d.conversation_id);
      setChatLog(greeting.trim() ? [{ role: "pal", text: greeting.trim() }] : []);
      addLog("ok", `Test drive started (${d.conversation_id}) — type at your PAL below. Text turns are billed like conversation time, but there's no video.`);
    } catch (e) {
      const msg = /<html|<!doctype/i.test(e.message) ? `${e.message.slice(0, 3)}: Tavus server error — try again in a moment` : e.message;
      setChatError(`Couldn't start: ${msg}`);
      addLog("err", `Test drive: ${msg}`);
    } finally {
      setChatBusy(false);
    }
  };

  const sendTestTurn = async () => {
    const text = chatInput.trim();
    if (!text || !chatConvId || chatBusy) return;
    setChatInput("");
    setChatLog((l) => [...l, { role: "user", text }]);
    setChatBusy(true);
    try {
      // The chat pipeline can 500 transiently right after start (still warming
      // up) — retry sends with backoff instead of surfacing the first blip.
      let sent = null;
      for (let attempt = 0; ; attempt++) {
        try {
          sent = await tavusFetch("POST", `/conversations/${chatConvId}/respond`, { text, timeout_s: 30 });
          break;
        } catch (e) {
          if (attempt >= 2 || !/^5\d\d/.test(e.message)) throw e;
          setChatLog((l) => (l[l.length - 1]?.role === "sys" ? l : [...l, { role: "sys", text: "warming up, retrying…" }]));
          await new Promise((r) => setTimeout(r, 1800 * (attempt + 1)));
        }
      }
      let reply = sent?.status === "ready" ? sent.text : null;
      if (reply == null) {
        const deadline = Date.now() + 45_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 800));
          try {
            const poll = await tavusFetch("GET", `/conversations/${chatConvId}/respond`);
            if (poll?.status === "ready") { reply = poll.text; break; }
          } catch { /* transient poll errors — keep polling until the deadline */ }
        }
      }
      if (reply == null) throw new Error("no reply within 45s");
      setChatLog((l) => [...l.filter((m) => m.role !== "sys"), { role: "pal", text: reply || "(empty reply)" }]);
    } catch (e) {
      // Raw HTML 500 pages help nobody — translate, and check whether the
      // conversation quietly ended (idle test conversations shut down).
      let msg = /<html|<!doctype/i.test(e.message) ? `${e.message.slice(0, 3)}: Tavus server error` : e.message;
      try {
        const c = await tavusFetch("GET", `/conversations/${chatConvId}`);
        if (c?.status === "ended") msg = "This test conversation has ended (idle test drives shut down after a few minutes). Hit End, then start a fresh one.";
      } catch { /* keep original message */ }
      setChatLog((l) => [...l, { role: "sys", text: `⚠ ${msg}` }]);
    } finally {
      setChatBusy(false);
    }
  };

  const endTestDrive = async () => {
    const id = chatConvId;
    setChatConvId("");
    setChatBusy(false);
    if (id) {
      try { await tavusFetch("POST", `/conversations/${id}/end`); addLog("info", "Test drive ended."); }
      catch { /* already ended is fine */ }
    }
  };

  /* ── Preflight: validate the full launch config without starting a call.
        Objectives → POST /objectives/validate (shape check, nothing saved);
        conversation → POST /conversations {test_mode:true} (Tavus validates
        and creates it pre-ended — no PAL joins, no cost, no concurrency). ── */

  const [preflighting, setPreflighting] = useState(false);
  const preflight = async () => {
    if (!canLaunch) { addLog("err", "API key, Face ID, and PAL ID are required — see Setup."); return; }
    setPreflighting(true);
    let ok = true;
    try {
      if (objectivesEnabled && objectivesPayload.data.length) {
        try {
          await tavusFetch("POST", "/objectives/validate", objectivesPayload);
          addLog("ok", `Preflight: goals check out (${objectivesPayload.data.length} steps, chain is valid).`);
        } catch (e) {
          ok = false;
          addLog("err", `Preflight: goals failed validation — ${e.message}`);
        }
      }
      try {
        await tavusFetch("POST", "/conversations", { ...conversationPayload, properties: { ...conversationPayload.properties }, test_mode: true });
        addLog("ok", "Preflight: Tavus accepted the full conversation config (test mode — nothing was started, no cost). Recording storage, IDs, and properties are all valid.");
      } catch (e) {
        ok = false;
        addLog("err", `Preflight: conversation config rejected — ${e.message}`);
      }
      if (ok) addLog("ok", "Preflight passed ✓ — this demo should launch cleanly.");
    } finally {
      setPreflighting(false);
    }
  };

  /* ── Vision: Claude drafts awareness queries from a plain-English vibe ── */

  const generateVision = async () => {
    setVisionGenerating(true);
    try {
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "vision",
          vibe: visionVibe,
          context: { product: personaBrief.product, brand: site.brand },
        }),
      });
      const text = await res.text();
      if (!res.ok || text.startsWith("[error]")) {
        let msg = text.replace(/^\[error\]\s*/, "");
        try { msg = JSON.parse(text).error || msg; } catch { /* plain text */ }
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(msg || "generation failed");
      }
      const { visual, audio } = parseVisionDraft(text);
      if (!visual.length && !audio.length) throw new Error("Couldn't parse the draft — try rephrasing the description.");
      setVisualQueriesText(visual.join("\n"));
      setAudioQueriesText(audio.join("\n"));
      addLog("ok", `Vision drafted: ${visual.length} visual, ${audio.length} audio checks — edit freely, attach on launch.`);
    } catch (e) {
      addLog("err", `Vision generation: ${e.message}`);
    } finally {
      setVisionGenerating(false);
    }
  };

  /* ── Create a brand-new PAL (Persona step) ── */

  const createPal = async () => {
    if (!apiKey.trim()) { addLog("err", "API key is required — see Setup."); return; }
    if (!faceId.trim()) { addLog("err", "Face ID is required (Setup) — a new PAL needs a default face."); return; }
    if (!newPalName.trim()) { addLog("err", "Give the new PAL a name."); return; }
    setCreatingPal(true);
    try {
      addLog("info", `Creating PAL "${newPalName.trim()}" (${palLlm})…`);
      const body = {
        pal_name: newPalName.trim(),
        default_face_id: faceId.trim(),
        system_prompt: personaDraft.trim() ||
          `You are a friendly, knowledgeable representative${site.brand ? ` for ${site.brand}` : ""}. Speak naturally and concisely, listen more than you talk, and help the person you're speaking with understand the product. Never invent pricing or commitments.`,
        layers: { llm: { model: palLlm } },
      };
      const data = await tavusFetch("POST", "/pals", body);
      const id = data.pal_id || data.uuid || data.id;
      if (!id) throw new Error("PAL created but no pal_id in the response.");
      setPalId(id);
      setPersonaAttached(!!personaDraft.trim()); // its prompt is already the draft
      setNewPalName("");
      addLog("ok", `PAL created: ${id} — set as your PAL ID${personaDraft.trim() ? " with your persona prompt" : ""}.`);
    } catch (e) {
      addLog("err", `Create PAL: ${e.message}`);
    } finally {
      setCreatingPal(false);
    }
  };

  /* ── Knowledge Base: add by URL, list, rename, delete ── */

  const fetchKbDocs = async (silent = false) => {
    if (!apiKey.trim()) { if (!silent) addLog("err", "Enter your Tavus API key in Setup first."); return; }
    setKbLoading(true);
    try {
      const d = await tavusFetch("GET", "/documents");
      setKbDocs(d.data || d.documents || []);
    } catch (e) {
      if (!silent) addLog("err", `Knowledge Base: ${e.message}`);
    } finally {
      setKbLoading(false);
    }
  };

  const addKbDoc = async () => {
    const url = kbUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { addLog("err", "That doesn't look like a URL — it needs to start with https://"); return; }
    setKbAdding(true);
    try {
      const body = { document_url: url };
      if (kbName.trim()) body.document_name = kbName.trim();
      if (kbCrawl) body.crawl = { depth: 2, max_pages: 25 };
      addLog("info", kbCrawl ? "Crawling the site into the Knowledge Base…" : "Adding to the Knowledge Base…");
      const doc = await tavusFetch("POST", "/documents", body);
      addLog("ok", `"${doc.document_name || url}" added (${doc.document_id}) — processing takes a few minutes; hit Refresh to check.`);
      setKbUrl(""); setKbName(""); setKbCrawl(false);
      fetchKbDocs(true);
    } catch (e) {
      addLog("err", `Add document: ${e.message}`);
    } finally {
      setKbAdding(false);
    }
  };

  /* Upload a local file → Vercel Blob (direct from the browser) → Tavus KB.
     From the Slides step, the new doc also joins the deck automatically. */
  const uploadKbFile = async (file, { addToDeck = false } = {}) => {
    if (!file) return;
    if (!apiKey.trim()) { addLog("err", "Enter your Tavus API key in Setup first."); return; }
    if (file.size > 50 * 1024 * 1024) { addLog("err", "That file is over Tavus's 50MB document limit."); return; }
    setKbAdding(true);
    try {
      addLog("info", `Uploading "${file.name}" (${(file.size / 1e6).toFixed(1)}MB)…`);
      const blob = await blobUpload(file.name, file, { access: "public", handleUploadUrl: "/api/blob-upload" });
      addLog("info", "Uploaded — adding to the Knowledge Base…");
      const doc = await tavusFetch("POST", "/documents", {
        document_url: blob.url,
        document_name: kbName.trim() || file.name.replace(/\.[^.]+$/, ""),
      });
      addLog("ok", `"${doc.document_name || file.name}" added (${doc.document_id}) — processing takes a few minutes; hit Refresh to check.`);
      if (addToDeck && doc.document_id) {
        setDocIdsRaw((raw) => (raw.trim() ? `${raw.trim()}\n${doc.document_id}` : doc.document_id));
        setPresentationEnabled(true);
        addLog("info", "Added to the deck — it can present once the document shows \"ready\".");
      }
      setKbName("");
      fetchKbDocs(true);
    } catch (e) {
      const msg = String(e.message || e);
      addLog("err", `Upload: ${msg.includes("BLOB_READ_WRITE_TOKEN") || msg.includes("No token") ? "File storage isn't set up — in Vercel: Storage → Create Database → Blob, attach it, redeploy." : msg}`);
    } finally {
      setKbAdding(false);
    }
  };

  /* ── Talk track: Claude drafts per-slide speaker notes ── */

  const draftTalkTrack = async () => {
    const slideCount = talkTrack.length || 8;
    const vibe = [
      ideaText.trim(),
      personaBrief.product && `Product: ${personaBrief.product}`,
      personaBrief.goal && `Goal: ${personaBrief.goal}`,
      personaBrief.audience && `Audience: ${personaBrief.audience}`,
      `The deck has ${slideCount} slides.`,
      talkTrack.some((t) => t?.trim()) && `Current notes to improve on:\n${talkTrack.map((t, i) => `${i + 1}: ${t || "(empty)"}`).join("\n")}`,
    ].filter(Boolean).join("\n");
    if (!ideaText.trim() && !personaBrief.product) {
      addLog("err", "Describe the demo first (New Demo or Persona step) so Claude knows what the deck is about.");
      return;
    }
    setTalkTrackDrafting(true);
    try {
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "talktrack", vibe }),
      });
      const text = await res.text();
      if (!res.ok || text.startsWith("[error]")) {
        let msg = text.replace(/^\[error\]\s*/, "");
        try { msg = JSON.parse(text).error || msg; } catch { /* plain */ }
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(msg || "drafting failed");
      }
      const rows = [];
      for (const line of text.split("\n")) {
        const m = line.trim().match(/^(?:slide\s*)?(\d+)\s*[:.)-]\s*(.+)/i);
        if (m) rows[parseInt(m[1], 10) - 1] = m[2].trim();
      }
      if (!rows.length) throw new Error("Couldn't parse the draft — try again.");
      setTalkTrack(rows.map((r) => r || ""));
      addLog("ok", `Talk track drafted for ${rows.length} slides — align it with your actual deck, Claude hasn't seen the slides.`);
    } catch (e) {
      addLog("err", `Talk track: ${e.message}`);
    } finally {
      setTalkTrackDrafting(false);
    }
  };

  /* ── Voice search: Cartesia catalog by accent/vibe ── */

  const searchVoices = async () => {
    setVoiceLoading(true);
    try {
      const res = await fetch(`/api/voices?q=${encodeURIComponent(voiceQuery.trim())}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(j.error || "voice search failed");
      }
      setVoiceResults(j.voices || []);
    } catch (e) {
      addLog("err", `Voices: ${e.message}`);
    } finally {
      setVoiceLoading(false);
    }
  };

  const renameKbDoc = async (id, name) => {
    try {
      await tavusFetch("PATCH", `/documents/${id}`, { document_name: name });
      setKbDocs((docs) => docs?.map((d) => (d.document_id === id ? { ...d, document_name: name } : d)) ?? docs);
      addLog("ok", `Renamed to "${name}".`);
    } catch (e) {
      addLog("err", `Rename: ${e.message}`);
    }
  };

  const deleteKbDoc = async (id, name) => {
    if (!window.confirm(`Delete "${name || id}" from the Knowledge Base? This removes it for every PAL that uses it.`)) return;
    try {
      await tavusFetch("DELETE", `/documents/${id}`);
      setKbDocs((docs) => docs?.filter((d) => d.document_id !== id) ?? docs);
      setKnowledgeIdsRaw((raw) => raw.split(/[\s,]+/).filter((x) => x && x !== id).join("\n"));
      setDocIdsRaw((raw) => raw.split(/[\s,]+/).filter((x) => x && x !== id).join("\n"));
      addLog("ok", "Document deleted.");
    } catch (e) {
      addLog("err", `Delete: ${e.message}`);
    }
  };

  /* ── Demo dashboard: per-link stats stored by /api/demo-launch ── */

  const fetchDemoStats = async (slug = "") => {
    setDemoStatsLoading(true);
    try {
      const res = await fetch(`/api/demo-stats${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(j.error || "couldn't load stats");
      }
      if (slug) {
        setDemoDetail(j);
        fetchRecordings((j.convos || []).map((c) => c.id).filter(Boolean));
      }
      else { setDemoStats(j.demos || []); setDemoDetail(null); }
    } catch (e) {
      addLog("err", `Dashboard: ${e.message}`);
    } finally {
      setDemoStatsLoading(false);
    }
  };

  /* ── Calls & data: pulled straight from Tavus (source of truth) ── */

  const fetchCalls = async () => {
    // Errors render inline — the launch log isn't visible on this step.
    if (!apiKey.trim()) { setCallsError("Needs the Tavus API key — set it on the Account step, or load a saved scenario from the top bar."); return; }
    setCallsLoading(true);
    setCallsError("");
    setCallDetail(null);
    try {
      // The list endpoint is paginated OLDEST-FIRST — walking from page 1
      // returns the account's ancient history and recent calls never appear.
      // Read the total, fetch the LAST pages, and sort newest-first (500 cap).
      const PER = 50, MAX_PAGES = 10;
      const first = await tavusFetch("GET", `/conversations?limit=${PER}&page=1`);
      const firstBatch = first.data || first.conversations || [];
      const total = first.total_count ?? first.total ?? null;
      let all = [...firstBatch];
      if (total != null && total > PER) {
        const lastPage = Math.ceil(total / PER);
        const startPage = Math.max(2, lastPage - MAX_PAGES + 1);
        const pages = [];
        for (let pg = startPage; pg <= lastPage; pg++) pages.push(pg);
        const chunks = await Promise.all(pages.map((pg) =>
          tavusFetch("GET", `/conversations?limit=${PER}&page=${pg}`).then((d) => d.data || d.conversations || []).catch(() => [])
        ));
        all = startPage > 2 ? chunks.flat() : [...firstBatch, ...chunks.flat()];
      } else if (total == null && firstBatch.length === PER) {
        // No total reported — fall back to a forward walk.
        for (let pg = 2; pg <= MAX_PAGES; pg++) {
          const d = await tavusFetch("GET", `/conversations?limit=${PER}&page=${pg}`);
          const batch = d.data || d.conversations || [];
          all.push(...batch);
          if (batch.length < PER) break;
        }
      }
      const seen = new Set();
      all = all
        .filter((c) => c.conversation_id && !seen.has(c.conversation_id) && seen.add(c.conversation_id))
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .slice(0, 500);
      setCallsList(all);
      if (total != null && total > all.length) addLog("info", `Results shows the ${all.length} most recent of ${total} lifetime calls.`);
      const ids = all.map((c) => c.conversation_id).filter(Boolean);
      for (let i = 0; i < ids.length; i += 100) fetchRecordings(ids.slice(i, i + 100));
    } catch (e) {
      setCallsError(`Couldn't load calls: ${e.message}`);
      addLog("err", `Calls: ${e.message}`);
    } finally {
      setCallsLoading(false);
    }
  };

  /* Recording locations captured by /api/recording-hook — best-effort. */
  const fetchRecordings = async (ids) => {
    if (!ids.length) return;
    try {
      const res = await fetch(`/api/recordings?ids=${ids.slice(0, 100).join(",")}`);
      if (!res.ok) return;
      const map = await res.json();
      if (map && typeof map === "object") setRecMap((m) => ({ ...m, ...map }));
    } catch { /* recordings panel is optional decoration */ }
    // Attendee/feedback records from /api/experience ride the same id batches.
    try {
      const res = await fetch(`/api/experience?ids=${ids.slice(0, 100).join(",")}`);
      if (!res.ok) return;
      const map = await res.json();
      if (map && typeof map === "object") setExpMap((m) => ({ ...m, ...map }));
    } catch { /* optional decoration */ }
  };

  const openCall = async (id) => {
    setCallDetailLoading(true);
    try {
      const d = await tavusFetch("GET", `/conversations/${id}?verbose=true`);
      setCallDetail(d);
      setCallsError("");
      if (!recMap[id]) fetchRecordings([id]);
    } catch (e) {
      setCallsError(`Couldn't open that call: ${e.message}`);
      addLog("err", `Call detail: ${e.message}`);
    } finally {
      setCallDetailLoading(false);
    }
  };

  const saveFile = (filename, text, type = "text/plain") => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  /* Each kind of call data as its own artifact — transcripts and analyses
     feed different systems than raw events, so don't force one blob. */
  const callTranscript = () =>
    (callDetail?.events || []).find((e) => /transcription/i.test(e.event_type || ""))?.properties?.transcript;
  const callPerception = () =>
    (callDetail?.events || []).filter((e) => /perception/i.test(e.event_type || ""))
      .map((e) => (typeof e.properties?.analysis === "string" ? e.properties.analysis : JSON.stringify(e.properties, null, 2)));

  const downloadCall = () => {
    if (!callDetail) return;
    saveFile(`tavus-call-${callDetail.conversation_id || "data"}.json`, JSON.stringify(callDetail, null, 2), "application/json");
  };
  const downloadTranscript = (fmt) => {
    const t = callTranscript();
    if (!Array.isArray(t) || !callDetail) return;
    const id = callDetail.conversation_id || "call";
    if (fmt === "json") { saveFile(`tavus-transcript-${id}.json`, JSON.stringify(t, null, 2), "application/json"); return; }
    const text = t.filter((m) => m.role !== "system")
      .map((m) => `${m.role === "assistant" ? (site.brand || "PAL") : "Visitor"}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
      .join("\n\n");
    saveFile(`tavus-transcript-${id}.txt`, text);
  };
  const downloadPerception = () => {
    const p = callPerception();
    if (!p.length || !callDetail) return;
    saveFile(`tavus-perception-${callDetail.conversation_id || "call"}.txt`, p.join("\n\n---\n\n"));
  };

  /* ── Studio: record a scripted take as an MP4 feature demo ── */

  const endStudioRuntime = (message) => {
    const rt = getStudioRuntime();
    try { rt?.displayStream?.getTracks().forEach((t) => t.stop()); } catch { /* gone */ }
    try { rt?.ctx?.close(); } catch { /* gone */ }
    setStudioRuntime(null);
    setStudioActive(false);
    if (message) setStudioStatus(message);
  };

  const startStudioTake = async () => {
    const lines = studioLines.map((l) => String(l.text || "").trim()).filter(Boolean);
    if (!lines.length) { addLog("err", "Studio: write at least one visitor line first."); return; }
    if (!canLaunch) { addLog("err", "Studio: needs your Tavus key + Face + PAL (Account step) before recording a take."); return; }
    if (!(recordingEnabled && recS3Bucket.trim() && recS3Region.trim() && recS3RoleArn.trim())) {
      addLog("err", "Studio: takes are captured via S3 recording — configure it on the Timing step first.");
      return;
    }
    // Tab capture must happen inside this click (browser gesture rule) —
    // it's what puts Magic Canvas cards and slides in the file.
    setStudioStatus("Pick this tab in the share dialog — that capture IS the video.");
    let displayStream = null;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      });
    } catch {
      setStudioStatus("Tab capture declined — a take needs it so Magic Canvas and slides are in the video.");
      return;
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
      setStudioStatus(`Rendering ${lines.length} visitor line${lines.length > 1 ? "s" : ""} with TTS…`);
      const buffers = [];
      for (const text of lines) {
        const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `TTS failed (${r.status})`); }
        buffers.push(await ctx.decodeAudioData(await r.arrayBuffer()));
      }
      const dest = ctx.createMediaStreamDestination();
      setStudioRuntime({ ctx, dest, buffers, displayStream });
      setStudioActive(true);
      setStudioStatus("Take running — the demo page drives the whole call and ends on its own. Don't switch tabs.");
      addLog("info", `Studio take: ${lines.length} scripted line${lines.length > 1 ? "s" : ""}, full-stage capture.`);
      await launch();
    } catch (e) {
      try { displayStream?.getTracks().forEach((t) => t.stop()); } catch { /* gone */ }
      endStudioRuntime(`Take failed: ${e.message}`);
      addLog("err", `Studio: ${e.message}`);
    }
  };

  /* Pre-take forecast: what will actually be on camera, computed from the
     config + the current script — so a take is never a surprise. Scripted
     cards and the deck are decidable; Magic Canvas is honestly a dice roll. */
  const takeForecast = useMemo(() => {
    const lines = studioLines.map((l) => String(l.text || "").toLowerCase());
    const rows = [];
    compiledScriptedCards.forEach((c) => {
      const icon = c.style === "chart" ? "📊" : c.style === "stat" ? "🔢" : c.style === "image" ? "🖼" : c.style === "question" ? "❓" : "📄";
      const label = `${icon} ${c.title || `${c.style} card`}`;
      if (c.trigger === "start") {
        rows.push({ k: "ok", label, detail: "appears at call start — guaranteed." });
      } else if (c.trigger === "time") {
        const m = Math.floor(c.atSeconds / 60), s = String(c.atSeconds % 60).padStart(2, "0");
        rows.push({ k: "ok", label, detail: `appears ${m}:${s} into the call — guaranteed if the take runs that long.` });
      } else {
        const kws = c.keywords.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
        const hit = lines.findIndex((t) => kws.some((k) => t.includes(k)));
        if (hit >= 0) {
          rows.push({ k: "ok", label, detail: `fires on line ${hit + 1} (“${kws.find((k) => lines[hit].includes(k))}”) — guaranteed.` });
        } else {
          rows.push({ k: "warn", label, detail: `will probably NOT appear — no script line says ${kws.map((k) => `“${k}”`).join(" / ")}. Add one, or ✨ regenerate the script.` });
        }
      }
    });
    if (presentationEnabled && docIds.length) {
      if (slidesTrigger === "walk_the_deck") {
        rows.push({ k: "ok", label: "🖥 Presentation deck", detail: "walk-the-deck mode — it presents on its own; slides will be on camera." });
      } else {
        const hit = lines.findIndex((t) => /deck|slide|present|walk me|show me/.test(t));
        rows.push(hit >= 0
          ? { k: "ok", label: "🖥 Presentation deck", detail: `on-demand — the script asks for it on line ${hit + 1}; slides will be on camera.` }
          : { k: "warn", label: "🖥 Presentation deck", detail: "on-demand, and no script line asks for it — the deck won't appear. Add “can you walk me through the deck?” or switch to walk-the-deck (Presentation step)." });
      }
    }
    if (canvasEnabled) {
      const on = Object.values(components).filter(Boolean).length;
      rows.push({ k: "maybe", label: "🪄 Magic Canvas", detail: `${on}/7 components enabled — the AI decides in the moment, so cards are possible but never guaranteed. Anything that MUST be in the video belongs in a scripted card above.` });
    }
    if (!rows.length) rows.push({ k: "warn", label: "Nothing visual configured", detail: "This take records the AI human only — no cards or deck are set up to appear." });
    return rows;
  }, [studioLines, compiledScriptedCards, presentationEnabled, docIds, slidesTrigger, canvasEnabled, components]);

  /* Claude drafts the scripted cards themselves from a plain-English ask
     ("a pricing chart and a which-package question") + the demo's config. */
  const generateScriptedCards = async () => {
    setCardsBusy(true);
    try {
      addLog("info", "Designing scripted cards for this demo…");
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "cards",
          vibe: cardsPrompt,
          context: {
            product: personaBrief.product,
            brand: site.brand,
            personaSummary: personaDraft.slice(0, 1500),
            objectives: objectivesEnabled ? objectivesText.trim() : "",
            canvasPlaybook: canvasEnabled ? canvasPlaybook.trim() : "",
            presentation: presentationContext(),
          },
        }),
      });
      const text = await res.text();
      if (!res.ok || text.startsWith("[error]")) {
        let msg = text.replace(/^\[error\]\s*/, "");
        try { msg = JSON.parse(text).error || msg; } catch { /* plain text */ }
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(msg || `${res.status}: generation failed`);
      }
      const jsonText = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
      const drafted = JSON.parse(jsonText);
      if (!Array.isArray(drafted) || !drafted.length) throw new Error("Claude returned no cards — try a more specific ask.");
      setScCards(drafted.slice(0, 5).map((c) => ({
        style: ["note", "chart", "stat", "image", "question"].includes(c.style) ? c.style : "note",
        trigger: ["keyword", "time", "start"].includes(c.trigger) ? c.trigger : "keyword",
        title: String(c.title ?? "").slice(0, 200),
        body: String(c.body ?? "").slice(0, 2000),
        url: String(c.url ?? "").slice(0, 500),
        keywords: String(c.keywords ?? "").slice(0, 200),
        atMinutes: c.atMinutes ? String(c.atMinutes) : "",
        hideAfter: c.hideAfter ? String(c.hideAfter) : "",
      })));
      addLog("ok", `${Math.min(drafted.length, 5)} scripted cards drafted — review them on the Magic Canvas step (live previews there); the forecast below already reflects them.`);
    } catch (e) {
      addLog("err", `Cards: ${e.message}`);
    } finally {
      setCardsBusy(false);
    }
  };

  /* Claude writes the visitor script from the demo's own config — lines
     engineered to make scripted cards, canvas, the deck, and the objectives
     flow fire on camera during a Studio take. */
  const generateStudioScript = async () => {
    setScriptBusy(true);
    try {
      addLog("info", "Writing the visitor script from this demo's configuration…");
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "script",
          vibe: scriptFocus,
          context: {
            product: personaBrief.product,
            brand: site.brand,
            personaSummary: personaDraft.slice(0, 2000),
            objectives: objectivesEnabled ? objectivesText.trim() : "",
            guardrails: guardrailsEnabled ? guardrailsText.trim() : "",
            presentation: presentationContext(),
            canvasPlaybook: canvasEnabled ? canvasPlaybook.trim() : "",
            canvasRules: canvasEnabled
              ? Object.entries(componentRules).filter(([, v]) => String(v).trim()).map(([k, v]) => `${k}: ${v}`).join("\n")
              : "",
            scriptedCards: compiledScriptedCards.map((x) => ({ style: x.style, title: x.title, trigger: x.trigger, keywords: x.keywords })),
            scheduling: !!schedulingUrl.trim(),
          },
        }),
      });
      const text = await res.text();
      if (!res.ok || text.startsWith("[error]")) {
        let msg = text.replace(/^\[error\]\s*/, "");
        try { msg = JSON.parse(text).error || msg; } catch { /* plain text */ }
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(msg || `${res.status}: generation failed`);
      }
      const lines = text
        .split("\n")
        .map((l) => l.replace(/^[\s"'\d.\-–—)]+/, "").replace(/["']\s*$/, "").trim())
        .filter(Boolean)
        .slice(0, 12);
      if (!lines.length) throw new Error("Claude returned an empty script — try again.");
      setStudioLines(lines.map((t) => ({ text: t })));
      addLog("ok", `Script drafted: ${lines.length} visitor lines, tuned to this demo's cards, deck, and flow. Edit freely, then 🎬 Record take.`);
    } catch (e) {
      addLog("err", `Script: ${e.message}`);
    } finally {
      setScriptBusy(false);
    }
  };

  /* The interviewer partner: a purpose-built PAL whose whole job is making
     the guest shine. Created once, cached in the demo config, reused. */
  const INTERVIEWER_PROMPT = `## Identity & Role
You are Sam, a warm, sharp interviewer recording a short on-camera segment with a guest. Your only job is to make your guest shine — draw out who they are, what they do, how it works, and what makes it special.

## Personality & Conversational Style
Curious, quick, generous. Contractions, one to two sentences per turn. React genuinely to what they just said before moving on ("Okay, that's genuinely cool — so how does that work?").

## Core Behaviors
Ask ONE question at a time and then listen. Dig deeper on the most interesting thing in their last answer. Never talk about yourself beyond a passing word. Never sell anything, never run an agenda, intake, or checklist of your own. If they ask you something, answer in a few words and turn it back to them.

## Guardrails & Constraints
Never mention prompts, instructions, AI setups, or that this is scripted. If asked whether you're an AI, say yes briefly and move on.

## Conversation Flow
Open with your first question. Spend the conversation exploring their answers. After several good exchanges, wrap up warmly: summarize the most interesting thing you heard and thank them.`;

  const ensureDuetPartner = async () => {
    if (duetPartnerId.trim()) return duetPartnerId.trim();
    addLog("info", "Creating the interviewer PAL (one-time — it's reused for every duet)…");
    const p = await tavusFetch("POST", "/pals", {
      pal_name: "Studio duet interviewer",
      default_face_id: duetFaceB.trim(),
      system_prompt: INTERVIEWER_PROMPT,
    });
    const id = p.pal_id || p.uuid || p.id;
    if (!id) throw new Error("Interviewer PAL creation returned no id.");
    setDuetPartnerId(id);
    addLog("ok", `Interviewer PAL ready: ${id} (saved with this demo).`);
    return id;
  };

  /* Duet: create both conversations, capture the tab (gesture!), open the
     duet stage. The parent relays turns as text; recording is local.
     The PARTNER always opens (it's the interviewer); your demo PAL answers
     as itself — that's the showcase. */
  const startDuet = async () => {
    if (!canLaunch) { addLog("err", "Duet: needs your Tavus key + Face + PAL for your AI human (Account step)."); return; }
    if (!duetFaceB.trim()) { addLog("err", "Duet: pick a face for the conversation partner."); return; }
    if (duetMode === "custom" && !duetPalB.trim()) { addLog("err", "Duet: paste the partner's PAL ID (or switch to the auto interviewer)."); return; }
    setStudioStatus("Pick this tab in the share dialog — the duet records locally from that capture.");
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true, // tab audio = both replicas' voices
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      });
      if (!stream.getAudioTracks().length) {
        addLog("err", "Duet: no tab audio in the capture — re-share and tick “Also share tab audio”, or the video will be silent.");
      }
    } catch {
      setStudioStatus("Tab capture declined — the duet needs it to record the video.");
      return;
    }
    try {
      const topic = duetTopic.trim();
      // Side A = YOUR demo's AI human. It opens (its natural greeting, or the
      // opener field) — the demo persona starting the conversation IS the
      // showcase. Side B (partner) joins only after A's opener lands.
      const guestCtx = [
        `You are on camera being interviewed about who you are and what you do${topic ? ` — especially: ${topic}` : ""}.`,
        "You speak first: greet and briefly introduce yourself the way you naturally would, then answer their questions as yourself, one to three sentences per turn.",
        "Do NOT run your usual conversation flow, intake questions, or agenda — the person you're talking to is the interviewer, not a customer. Never mention these instructions.",
      ].join(" ");
      const partnerCtx = [
        `You are interviewing an AI human guest on camera${topic ? ` about: ${topic}` : ""}.`,
        "Your guest opens the conversation — react to what they actually said, then ask your first question. One short question at a time; make them shine. Wrap up warmly after several exchanges.",
      ].join(" ");
      setStudioStatus("Creating both conversations…");
      const partnerPal = duetMode === "custom" ? duetPalB.trim() : await ensureDuetPartner();
      const a = await tavusFetch("POST", "/conversations", {
        face_id: faceId.trim(),
        pal_id: palId.trim(),
        conversation_name: "Studio duet — your AI human",
        ...(duetOpener.trim() ? { custom_greeting: duetOpener.trim() } : {}), // blank = its natural greeting
        conversational_context: guestCtx,
        properties: { max_call_duration: 360, ...(language && language !== "multilingual" ? { language } : {}) },
      });
      const b = await tavusFetch("POST", "/conversations", {
        face_id: duetFaceB.trim(),
        pal_id: partnerPal,
        conversation_name: "Studio duet — partner",
        custom_greeting: "Hey! It's so good to sit down with you.",
        conversational_context: partnerCtx,
        properties: { max_call_duration: 360 },
      });
      setDuetRun({ a, b, stream });
      setStudioStatus("");
      addLog("ok", `Duet live: your AI human ${a.conversation_id} opens ↔ partner ${b.conversation_id}. It ends and saves the video on its own.`);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      // A stale cached interviewer PAL (deleted account-side) fails conversation
      // creation — clear it so the next click recreates.
      if (duetMode === "auto" && /pal/i.test(String(e.message))) setDuetPartnerId("");
      setStudioStatus(`Duet failed: ${e.message}`);
      addLog("err", `Duet: ${e.message}`);
    }
  };

  /* ── Shareable demo link: store the snapshot server-side, mint /d/{slug} ── */

  const shareDemo = async () => {
    if (!palId.trim() || !faceId.trim()) { addLog("err", "The demo needs a Face ID and PAL ID before it can be shared — see Setup."); return; }
    setSharing(true);
    try {
      const res = await fetch("/api/demos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: conversationName || site.brand || "demo",
          site,
          controls: controlsConfig,
          payload: conversationPayload,
          experience: experienceConfig,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(j.error || `${res.status}: sharing failed`);
      }
      const url = `${window.location.origin}/d/${j.slug}`;
      setShareUrl(url);
      addLog("ok", `Shareable link ready: ${url}`);
      promptSaveIfDirty(); // a shared demo should exist as a saved demo too
    } catch (e) {
      addLog("err", `Share: ${e.message}`);
    } finally {
      setSharing(false);
    }
  };

  /* ── "Start from an idea": Claude drafts the whole template, all editable ── */

  const draftDemo = async (knownBrand = "") => {
    if (!ideaText.trim()) return;
    setIdeating(true);
    try {
      addLog("info", "Drafting the whole demo from your idea…");
      // Anchor the draft to the REAL company when we know it (from the URL /
      // theming) — otherwise Claude invents a plausible fictional brand.
      const parts = [ideaText];
      const company = String(knownBrand || "").trim() || site.brand.trim();
      if (company) parts.push(`The prospect/company is ${company} — the REAL company. Use its real name and public positioning everywhere (page copy, greeting, persona, goals). Never invent a substitute brand name. Don't invent specific claims or product facts you're not sure of — stay accurate-but-general where unsure.`);
      else if (brandUrl.trim()) parts.push(`The prospect's website is ${brandUrl.trim()} — the REAL company behind that domain. Use its real name; never invent a substitute brand name.`);
      // Hard timeout: a hung serverless call must not freeze the wizard.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90_000);
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "demo", vibe: parts.join("\n\n") }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      const text = await res.text();
      if (!res.ok || text.startsWith("[error]")) {
        let msg = text.replace(/^\[error\]\s*/, "");
        try { msg = JSON.parse(text).error || msg; } catch { /* plain */ }
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(msg || "drafting failed");
      }
      const t = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());

      if (t.conversationName) setConversationName(t.conversationName);
      if (t.greeting) setGreeting(t.greeting);
      setSite((s) => ({
        ...s,
        brand: t.brand || s.brand,
        headline: t.headline || s.headline,
        tagline: t.tagline || s.tagline,
        cta: t.cta || s.cta,
      }));
      if (t.personaBrief) setPersonaBrief((b) => ({ ...b, ...t.personaBrief }));
      if (Array.isArray(t.objectives) && t.objectives.length) {
        setObjectivesText(t.objectives.join("\n"));
        setObjectivesEnabled(true);
      }
      if (Array.isArray(t.guardrails) && t.guardrails.length) {
        setGuardrailsText(t.guardrails.join("\n"));
        setGuardrailsEnabled(true);
      }
      if (t.visionVibe) { setVisionVibe(t.visionVibe); setVisionEnabled(true); }
      if (t.canvasPlaybook) { setCanvasPlaybook(t.canvasPlaybook); setCanvasEnabled(true); }
      setPersonaDraft(""); setPersonaAttached(false); // brief changed → draft is stale
      addLog("ok", "Demo drafted — every step is filled in. Walk the rail to review and edit, then generate the persona.");
    } catch (e) {
      addLog("err", `Draft demo: ${e.name === "AbortError" ? "took too long (90s) and was cancelled — try again; if it keeps happening, shorten the idea text" : e.message}`);
    } finally {
      setIdeating(false);
    }
  };

  /* ── Brand theme: Claude restyles the demo page from a company URL ── */

  const themeFromUrl = async () => {
    const url = brandUrl.trim();
    if (!url) return;
    setTheming(true);
    try {
      addLog("info", "Reading the site and drafting a matching theme + copy…");
      // Give Claude the use case so page copy speaks the brand's diction FOR
      // this demo (HR copy for HR, sales diction for sales, etc.).
      const useCase = [
        ideaText.trim(),
        personaBrief.goal && `Goal: ${personaBrief.goal}`,
        personaBrief.audience && `Audience: ${personaBrief.audience}`,
        personaBrief.product && `Product focus: ${personaBrief.product}`,
      ].filter(Boolean).join("\n");
      // Hard timeout: a hung serverless call must not freeze the wizard.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 75_000);
      const res = await fetch("/api/brand-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: /^https?:\/\//i.test(url) ? url : `https://${url}`, useCase }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(j.error || `${res.status}: theming failed`);
      }
      setSite((s) => ({
        ...s,
        brand: j.brand || s.brand,
        headline: j.headline || s.headline,
        tagline: j.tagline || s.tagline,
        cta: j.cta || s.cta,
        logoUrl: s.logoUrl || j.logoUrl || "",
        theme: { ...(j.colors || {}), font: j.font || "" },
      }));
      if (j.greeting && !greeting.trim()) setGreeting(j.greeting);
      addLog("ok", `Demo page themed to ${j.brand || url} — colors, copy${j.greeting && !greeting.trim() ? ", greeting" : ""} drafted for this use case. Tweak anything below.`);
      return j; // so callers (Draft my demo) can hand the real brand to draftDemo
    } catch (e) {
      addLog("err", `Brand theme: ${e.name === "AbortError" ? "took too long (75s) and was skipped — draft continues; theme the page later from Page & Brand" : e.message}`);
      return null;
    } finally {
      setTheming(false);
    }
  };

  /* ── Canvas ideation: Claude plans which cards earn their place ── */

  const [canvasPlanning, setCanvasPlanning] = useState(false);
  const generateCanvasPlan = async () => {
    const vibe = [ideaText.trim(), personaBrief.product && `Product: ${personaBrief.product}`,
      personaBrief.goal && `Goal: ${personaBrief.goal}`, personaBrief.audience && `Audience: ${personaBrief.audience}`]
      .filter(Boolean).join("\n");
    if (!vibe) { addLog("err", "Describe the demo first (New Demo step) so Claude knows the use case."); return; }
    setCanvasPlanning(true);
    try {
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "canvas", vibe }),
      });
      const text = await res.text();
      if (!res.ok || text.startsWith("[error]")) {
        let msg = text.replace(/^\[error\]\s*/, "");
        try { msg = JSON.parse(text).error || msg; } catch { /* plain */ }
        if (res.status === 401) setAuth({ checked: true, required: true, authed: false });
        throw new Error(msg || "planning failed");
      }
      const plan = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
      if (plan.style) setCanvasStyle(plan.style);
      if (plan.playbook) setCanvasPlaybook(plan.playbook);
      const validKeys = new Set(CANVAS_COMPONENTS.map((c) => c.key));
      if (plan.rules) {
        setComponentRules((prev) => ({
          ...prev,
          ...Object.fromEntries(Object.entries(plan.rules).filter(([k]) => validKeys.has(k)).map(([k, v]) => [k, String(v)])),
        }));
      }
      if (Array.isArray(plan.disable)) {
        setComponents((prev) => ({
          ...prev,
          ...Object.fromEntries(plan.disable.filter((k) => validKeys.has(k)).map((k) => [k, false])),
        }));
      }
      setCanvasEnabled(true);
      const ruleCount = plan.rules ? Object.keys(plan.rules).length : 0;
      addLog("ok", `Canvas plan drafted: ${plan.style || "balanced"} style, ${ruleCount} card rule${ruleCount === 1 ? "" : "s"}${plan.disable?.length ? `, ${plan.disable.length} cards off` : ""}. Edit anything below.`);
    } catch (e) {
      addLog("err", `Canvas plan: ${e.message}`);
    } finally {
      setCanvasPlanning(false);
    }
  };

  /* ── Logo upload: file → downscaled data URL (works offline, no hosting) ── */

  const onLogoFile = (file) => {
    if (!file || !file.type.startsWith("image/")) { addLog("err", "That file isn't an image."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 512;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setSiteField("logoUrl", canvas.toDataURL("image/png"));
      };
      img.onerror = () => addLog("err", "Couldn't read that image.");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const attachPersona = async () => {
    if (!apiKey.trim() || !palId.trim()) { addLog("err", "API key and PAL ID are required — see Setup."); return; }
    if (!personaDraft.trim()) { addLog("err", "Nothing to attach — generate or write a persona prompt first."); return; }
    setGenerating(true);
    try {
      addLog("info", "Attaching persona prompt to the PAL…");
      await tavusFetch("PATCH", `/pals/${palId.trim()}`, [
        { op: "add", path: "/system_prompt", value: personaDraft.trim() },
      ]);
      setPersonaAttached(true);
      pushPromptVersion("Attached to PAL", personaDraft, { attached: true });
      addLog("ok", "Persona prompt attached (persists on the PAL until you change it).");
    } catch (e) {
      addLog("err", e.message + " — if this is a network/CORS block, copy the curl from the preview panel and run it from a terminal.");
    } finally {
      setGenerating(false);
    }
  };

  /* Skills persist on the PAL — give the toggle an explicit off-ramp. */
  const detachSkill = async (skillId) => {
    if (!apiKey.trim() || !palId.trim()) { addLog("err", "API key and PAL ID are required — see Account."); return; }
    try {
      await tavusFetch("DELETE", `/pals/${palId.trim()}/skills/${skillId}`);
      addLog("ok", `${skillId.replace("_", " ")} detached from the PAL.`);
    } catch (e) {
      addLog("err", `Detach ${skillId}: ${e.message}`);
    }
  };

  const canLaunch = apiKey.trim() && faceId.trim() && palId.trim();

  const launch = async (maybePrefs) => {
    // Guided-journey answers from DemoSite — the Launch button passes a click
    // event here instead, which this filters out.
    const journeyPrefs = maybePrefs && Array.isArray(maybePrefs.answers) ? maybePrefs : null;
    if (!canLaunch) { addLog("err", "API key, Face ID, and PAL ID are required — see Setup."); return; }
    setBusy(true);
    try {
      const pal = palId.trim();

      // Objectives: create the set, attach to the PAL (replaces any existing set).
      if (objectivesEnabled && objectivesPayload.data.length) {
        addLog("info", `Creating objectives (${objectivesPayload.data.length} step${objectivesPayload.data.length > 1 ? "s" : ""})…`);
        const obj = await tavusFetch("POST", "/objectives", objectivesPayload);
        const objectivesId = obj.objectives_id || obj.uuid || obj.id;
        addLog("ok", `Objectives created: ${objectivesId}`);
        addLog("info", "Attaching objectives to the PAL…");
        await tavusFetch("PATCH", `/pals/${pal}`, [
          { op: "add", path: "/objectives_id", value: objectivesId },
        ]);
        addLog("ok", "Objectives attached (persists on the PAL until you remove it).");
      }

      // Guardrails: create each, then REPLACE the PAL's set with exactly these.
      // (Merging accumulated near-duplicates across relaunches until the PAL
      // hit Tavus's 50-guardrail cap and launches 400'd.)
      if (guardrailsEnabled && guardrailsParsed.length) {
        addLog("info", `Creating ${guardrailsParsed.length} guardrail${guardrailsParsed.length > 1 ? "s" : ""}…`);
        const newIds = [];
        for (const g of guardrailsParsed) {
          const created = await tavusFetch("POST", "/guardrails", g);
          const id = created.uuid || created.guardrail_uuid || created.id;
          newIds.push(id);
          addLog("ok", `Guardrail ${g.guardrail_name}: ${id}`);
        }
        addLog("info", "Attaching guardrails to the PAL (overwrites its previous set)…");
        try {
          // "replace" has unambiguous overwrite semantics; "add" on an array
          // can be treated as append by some servers (how the pile-up began).
          await tavusFetch("PATCH", `/pals/${pal}`, [
            { op: "replace", path: "/guardrail_ids", value: newIds },
          ]);
        } catch (err) {
          // A PAL created without guardrails may not have the member yet —
          // "replace" requires it to exist, so fall back to "add".
          if (/does not exist|not found|invalid path/i.test(err.message)) {
            await tavusFetch("PATCH", `/pals/${pal}`, [
              { op: "add", path: "/guardrail_ids", value: newIds },
            ]);
          } else {
            throw err;
          }
        }
        addLog("ok", `Guardrails set — the PAL now has exactly these ${newIds.length} rule${newIds.length > 1 ? "s" : ""}.`);
      }

      // Vision: attach the perception layer to the PAL (persists like objectives).
      if (visionEnabled && (visionPayload.visual_awareness_queries || visionPayload.audio_awareness_queries)) {
        const v = visionPayload.visual_awareness_queries?.length || 0;
        const a = visionPayload.audio_awareness_queries?.length || 0;
        addLog("info", `Attaching vision (${v} visual, ${a} audio checks)…`);
        await tavusFetch("PATCH", `/pals/${pal}`, [
          { op: "add", path: "/layers/perception", value: visionPayload },
        ]);
        addLog("ok", "Vision attached (persists on the PAL until you change it).");
      }

      // Voice + expressive delivery: nice-to-haves — a failure here must never
      // stop the conversation from launching (some PALs reject TTS-layer ops).
      if (externalVoiceId.trim()) {
        try {
          addLog("info", `Setting the voice to ${externalVoiceName || externalVoiceId}…`);
          await tavusFetch("PATCH", `/pals/${pal}`, [
            { op: "add", path: "/layers/tts/external_voice_id", value: externalVoiceId.trim() },
          ]);
          addLog("ok", "Voice applied (persists on the PAL until you change it).");
        } catch (e) {
          addLog("err", `Voice couldn't be applied (continuing launch): ${e.message}`);
        }
      }
      if (!emotionControl) {
        // Only patch when turned OFF — Tavus defaults it to on.
        try {
          addLog("info", "Disabling expressive delivery…");
          await tavusFetch("PATCH", `/pals/${pal}`, [
            { op: "add", path: "/layers/tts/tts_emotion_control", value: false },
          ]);
          addLog("ok", "Expressive delivery off — flat, even delivery.");
        } catch (e) {
          addLog("err", `Expressive-delivery setting failed (continuing launch): ${e.message}`);
        }
      }

      // Pronunciation: create a dictionary, attach it to the PAL's voice.
      if (speechEnabled && pronunciationRules.length) {
        addLog("info", `Creating pronunciation dictionary (${pronunciationRules.length} rule${pronunciationRules.length > 1 ? "s" : ""})…`);
        const dict = await tavusFetch("POST", "/pronunciation-dictionaries", pronunciationPayload);
        const dictId = dict.pronunciation_dictionary_id || dict.uuid || dict.id;
        addLog("ok", `Dictionary created: ${dictId}`);
        addLog("info", "Attaching dictionary to the PAL's voice…");
        await tavusFetch("PATCH", `/pals/${pal}`, [
          { op: "add", path: "/layers/tts/pronunciation_dictionary_id", value: dictId },
        ]);
        addLog("ok", "Pronunciation attached (persists on the PAL until you change it).");
      }

      // Integrations: attach custom tools to the PAL's LLM (persists on the PAL).
      if (toolsEnabled && toolDefs.length) {
        addLog("info", `Attaching ${toolDefs.length} custom tool${toolDefs.length > 1 ? "s" : ""} to the PAL…`);
        await tavusFetch("PATCH", `/pals/${pal}`, [
          { op: "add", path: "/layers/llm/tools", value: toolDefs },
        ]);
        addLog("ok", `Tools attached: ${toolDefs.map((t) => t.function.name).join(", ")}.`);
      }

      // Tavus-authored skills (internet_search / browser_use) — same PUT
      // pattern as presentation/canvas; they persist on the PAL.
      for (const [on, skillId, cfgText] of [
        [internetSearchEnabled, "internet_search", ""],
        [browserUseEnabled, "browser_use", browserUseConfig],
      ]) {
        if (!on) continue;
        let cfg = {};
        if (String(cfgText).trim()) {
          try { cfg = JSON.parse(cfgText); }
          catch { throw new Error(`The ${skillId} advanced config isn't valid JSON — fix or clear it on the Integrations step.`); }
        }
        addLog("info", `Attaching the ${skillId.replace("_", " ")} skill…`);
        await tavusFetch("PUT", `/pals/${pal}/skills/${skillId}`, { config: cfg });
        addLog("ok", `${skillId.replace("_", " ")} attached (persists on the PAL until detached).`);
      }

      if (presentationEnabled) {
        if (!docIds.length) { addLog("err", "Presentation is on but has no document IDs."); setBusy(false); return; }
        addLog("info", `Attaching presentation skill (${slidesTrigger}, ${docIds.length} doc${docIds.length > 1 ? "s" : ""})…`);
        await tavusFetch("PUT", `/pals/${palId.trim()}/skills/presentation`, presentationPayload);
        addLog("ok", "Presentation skill attached.");
      }
      if (canvasEnabled) {
        const on = Object.values(components).filter(Boolean).length;
        addLog("info", `Attaching Magic Canvas (${on}/7 components on${placement !== "auto" ? `, prefer ${placement} rail` : ""})…`);
        await tavusFetch("PUT", `/pals/${palId.trim()}/skills/magic_canvas`, canvasPayload);
        addLog("ok", "Magic Canvas skill attached.");
      }
      if (recordingEnabled) {
        if (conversationPayload.properties?.recording_storage) {
          addLog("info", `Recording is on — the call will record to s3://${conversationPayload.properties.recording_storage.bucket_name} once Tavus finishes it.`);
        } else {
          addLog("err", "Recording is toggled on but bucket / region / role ARN aren't all filled in (Timing step) — launching WITHOUT recording.");
        }
      }
      addLog("info", "Creating conversation…");
      const payload = journeyPrefs
        ? applyJourneyPrefs(conversationPayload, experienceConfig.journey, journeyPrefs)
        : conversationPayload;
      if (journeyPrefs?.answers?.length) addLog("info", `Weaving in the visitor's ${journeyPrefs.answers.length} pre-call answer${journeyPrefs.answers.length > 1 ? "s" : ""}…`);
      const data = await tavusFetch("POST", "/conversations", payload);
      setConversation(data);
      addLog("ok", `Live: ${data.conversation_id || ""}`);
      setSiteMode(true);
      // A launched demo is worth keeping — prompt to save when they come
      // back from the demo page (the page covers the builder right now).
      promptOnReturn.current = true;
    } catch (e) {
      addLog("err", e.message + " — if this is a network/CORS block, copy the curl from the preview panel and run it from a terminal or backend.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text.replace("••••••••", apiKey || "<your-api-key>"));
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch { /* clipboard blocked */ }
  };

  /* ── Team invites: per-person, single-use sign-up codes ── */

  const loadInvites = async () => {
    setInvitesLoading(true);
    setInviteError("");
    try {
      const r = await fetch("/api/invites");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "couldn't load invites");
      setInvites(j.invites || []);
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInvitesLoading(false);
    }
  };

  const createInvite = async () => {
    setInviteCreating(true);
    setInviteError("");
    try {
      const r = await fetch("/api/invites", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "couldn't create invite");
      setInvites((l) => [{ code: j.code, usedBy: null, expired: false, createdAt: new Date().toISOString() }, ...(l || [])]);
      copy(j.code, `inv-${j.code}`); // fresh code straight onto the clipboard
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInviteCreating(false);
    }
  };

  /* ── UI ── */

  if (duetJoin) return <DuetJoiner url={duetJoin.url} id={duetJoin.id} side={duetJoin.side} />;
  if (demoSlug) return <VisitorDemo slug={demoSlug} />;

  // Access-code gate renders before anything else. Self-contained styling so
  // the main <style> block (below) doesn't need to load for the lock screen.
  if (!auth.checked || (auth.required && !auth.authed)) {
    const s = {
      root: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F4F1", color: "#17181A", fontFamily: "'Instrument Sans', system-ui, sans-serif" },
      card: { background: "#fff", border: "1px solid #E6E4DF", borderRadius: 16, padding: "36px 40px", width: "min(380px, 90vw)", boxShadow: "0 1px 3px rgba(20,20,20,.04)", textAlign: "center" },
      input: { width: "100%", border: "1px solid #E6E4DF", borderRadius: 12, padding: "11px 14px", font: "inherit", fontSize: 14, outline: "none", textAlign: "center", letterSpacing: 2, marginTop: 18 },
      btn: { width: "100%", marginTop: 12, background: "#17181A", color: "#fff", border: "none", borderRadius: 999, padding: "11px 18px", font: "inherit", fontWeight: 600, cursor: "pointer", opacity: authBusy ? 0.6 : 1 },
      err: { color: "#D64545", fontSize: 13, marginTop: 12, minHeight: 18 },
    };
    const canSubmit = auth.accounts
      ? authEmail && authPassword && (authView === "signin" || authInvite)
      : passcode;
    return (
      <div style={s.root}>
        {auth.checked && (
          <form style={s.card} onSubmit={submitLogin}>
            <svg width="30" height="30" viewBox="0 0 26 26" fill="none" style={{ marginBottom: 10 }}>
              <rect x="1" y="1" width="24" height="24" rx="8" stroke="#17181A" strokeWidth="2" />
              <circle cx="13" cy="13" r="4.5" fill="#FF6B5E" />
            </svg>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.3 }}>tavus experience builder</div>
            {auth.accounts ? (
              <>
                <div style={{ color: "#7A7B74", fontSize: 13, marginTop: 6 }}>
                  {authView === "signin" ? "Sign in to continue." : "Create your account — you'll need the team invite code."}
                </div>
                <input style={{ ...s.input, letterSpacing: 0, textAlign: "left" }} type="email" autoFocus value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
                <input style={{ ...s.input, marginTop: 8, letterSpacing: 0, textAlign: "left" }} type="password" value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)} placeholder={authView === "signup" ? "choose a password (8+ characters)" : "password"}
                  autoComplete={authView === "signup" ? "new-password" : "current-password"} />
                {authView === "signup" && (
                  <input style={{ ...s.input, marginTop: 8 }} type="password" value={authInvite}
                    onChange={(e) => setAuthInvite(e.target.value)} placeholder="invite code" autoComplete="off" />
                )}
                <button style={s.btn} type="submit" disabled={authBusy || !canSubmit}>
                  {authBusy ? "One sec…" : authView === "signin" ? "Sign in" : "Create account"}
                </button>
                <button type="button" style={{ background: "none", border: "none", color: "#7A7B74", fontSize: 12.5, marginTop: 12, cursor: "pointer", font: "inherit" }}
                  onClick={() => { setAuthView((v) => (v === "signin" ? "signup" : "signin")); setAuthErr(""); }}>
                  {authView === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
                </button>
              </>
            ) : (
              <>
                <div style={{ color: "#7A7B74", fontSize: 13, marginTop: 6 }}>Enter the access code to continue.</div>
                <input style={s.input} type="password" autoFocus value={passcode}
                  onChange={(e) => setPasscode(e.target.value)} placeholder="access code" />
                <button style={s.btn} type="submit" disabled={authBusy || !canSubmit}>
                  {authBusy ? "Checking…" : "Enter"}
                </button>
              </>
            )}
            <div style={s.err}>{authErr}</div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="root">
      <style>{BUILDER_CSS}</style>

      {duetRun && (
        <DuetStage
          run={duetRun}
          brand={site.brand}
          maxTurns={Math.max(2, parseInt(duetTurns, 10) || 6)}
          cards={compiledScriptedCards}
          onExit={() => { setDuetRun(null); setStudioStatus("Duet saved — the .webm downloaded to this machine."); }}
        />
      )}

      {siteMode && (
        <DemoSite
          site={site}
          conversationUrl={conversation?.conversation_url || null}
          conversationId={conversation?.conversation_id || null}
          controls={studioActive ? { ...controlsConfig, recordingLayout: "stage", studio: true } : controlsConfig}
          experience={studioActive ? {} : experienceConfig}
          onStart={launch}
          onExit={() => {
            setSiteMode(false);
            if (studioActive) endStudioRuntime("Take finished — the MP4 lands in Results (⏺ badge) a minute or two after processing.");
            if (promptOnReturn.current) { promptOnReturn.current = false; promptSaveIfDirty(); }
          }}
          onCallEnd={() => setConversation(null)}
          busy={busy}
        />
      )}

      <header className="topbar">
        <div className="logo-wrap">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <rect x="1" y="1" width="24" height="24" rx="8" stroke="var(--text)" strokeWidth="2" />
            <circle cx="13" cy="13" r="4.5" fill="var(--accent)" />
          </svg>
          <span className="logo-word">tavus</span>
          <span className="logo-sub">experience builder</span>
        </div>
        <div className="scenario-bar">
          <button
            className="pill-btn"
            style={{ padding: "8px 16px", fontSize: 13, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            onClick={() => { setLibQuery(""); setLibOpen(true); }}
            title="Open the demo library — search, load, and manage every saved demo. Name demos “Client / Use case” to group them."
          >
            📁 {activeScenario || "Demos"}{" "}
            <span style={{ color: "var(--muted)" }}>({Array.from(new Set([...Object.keys(scenarios), ...cloudNames])).length})</span>
          </button>
          <input
            style={{ width: 170 }}
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder={activeScenario ? `save as… (${activeScenario})` : "Client / demo name"}
            onKeyDown={(e) => e.key === "Enter" && saveScenario()}
          />
          <button className="pill-btn" style={{ padding: "8px 14px", fontSize: 13 }} onClick={saveScenario} disabled={!scenarioName.trim() && !activeScenario}>
            {savedFlash ? "Saved ✓" : "Save"}
          </button>
          <input ref={importRef} type="file" accept=".json,application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importScenario(f); e.target.value = ""; }} />
        </div>
        <div className="status-pill">
          {apiKey ? <>key <b>set</b></> : "key not set"} · {palId ? <>pal <b>{palId.slice(0, 10)}</b></> : "no pal"} · {faceId ? <>face <b>{faceId.slice(0, 10)}</b></> : "no face"}
          {auth.required && auth.authed && (
            <> · {auth.email ? auth.email.split("@")[0] : "team"}{" "}
              <button onClick={signOut} title="Sign out"
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", font: "inherit", fontSize: 11, textDecoration: "underline", padding: 0 }}>
                sign out
              </button>
            </>
          )}
        </div>
      </header>

      <div className="layout">
        <nav className="rail">
          {STEPS.map((s, i) => (
            <div key={s.id}>
              {(i === 0 || STEPS[i - 1].group !== s.group) && <div className="rail-group">{s.group}</div>}
            <button className={"rail-btn" + (step === s.id ? " active" : "")} onClick={() => setStep(s.id)}>
              <span className="rail-label">{s.label}</span>
              {s.id === "start" && (personaBrief.product || site.theme) && <span className="rail-check">●</span>}
              {s.id === "setup" && canLaunch && <span className="rail-check">●</span>}
              {s.id === "persona" && personaDraft.trim() && <span className="rail-check">●</span>}
              {s.id === "guide" && (objectivesEnabled || guardrailsEnabled) && <span className="rail-check">●</span>}
              {s.id === "vision" && visionEnabled && <span className="rail-check">●</span>}
              {s.id === "kb" && knowledgeIds.length > 0 && <span className="rail-check">●</span>}
              {s.id === "speech" && speechEnabled && <span className="rail-check">●</span>}
              {s.id === "tools" && toolsEnabled && toolDefs.length > 0 && <span className="rail-check">●</span>}
              {s.id === "controls" && (maxMinutes || inactivitySeconds || wakePhrase.trim() || interruptButton || guardrailEcho.trim() || recordingEnabled) && <span className="rail-check">●</span>}
              {s.id === "presentation" && presentationEnabled && <span className="rail-check">●</span>}
              {s.id === "canvas" && canvasEnabled && <span className="rail-check">●</span>}
              {s.id === "site" && site.brand && <span className="rail-check">●</span>}
            </button>
            </div>
          ))}
        </nav>

        <main className="main">
          {step === "start" && (
            <>
              <h1>New Demo</h1>
              <p className="lede">
                Tell it who the demo is for and what it should do — Claude drafts everything (the AI human's persona, goals, rules, page design in their brand) and you refine from there. Or skip this and build by hand.
              </p>

              <div className="idea-box">
                <Field label="Who's it for?" hint="The prospect's website. Used to match their brand — colors, logo, and the way they talk.">
                  <input className="mono" value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)} placeholder="https://prospect.com" />
                </Field>
                <Field label="What should the demo do?" hint="Plain English. The use case shapes everything — an HR demo speaks HR, a sales demo sells.">
                  <textarea
                    style={{ minHeight: 84 }}
                    value={ideaText}
                    onChange={(e) => setIdeaText(e.target.value)}
                    placeholder={"An HR onboarding assistant for their new employees — walks through week-one setup, benefits enrollment, and who to meet. Friendly, unhurried."}
                  />
                </Field>
                <button className="pill-btn primary big" onClick={async () => {
                  // Theme FIRST: it reads the real site and returns the real
                  // company name, which the demo draft then builds around —
                  // otherwise the draft invents a fictional brand ("StrideLab"
                  // for a sneaker idea) that soaks into greeting/goals/persona.
                  const theme = brandUrl.trim() ? await themeFromUrl() : null;
                  if (ideaText.trim()) await draftDemo(theme?.brand || "");
                  setStep("persona");
                }} disabled={ideating || theming || (!ideaText.trim() && !brandUrl.trim())}>
                  {theming ? "Matching their brand…" : ideating ? "Drafting the demo…" : "✨ Draft my demo"}
                </button>
                <p className="field-hint" style={{ marginTop: 10 }}>
                  Takes ~30 seconds. You land on the Persona step to review — every word stays editable.
                </p>
              </div>

              <p className="field-hint" style={{ maxWidth: 560 }}>
                Returning to a demo you saved? Open <b>📁 Demos</b> in the top bar and load it from your library instead.
              </p>
            </>
          )}

          {step === "setup" && (
            <>
              <h1>Account</h1>
              <p className="lede">One-time plumbing: your Tavus account and which AI human to use. Everything else layers on top.</p>
              <Field label="Tavus API key" hint="For production, calls belong on your backend.">
                <input className="mono" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="tvs-…" />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
                  <input type="checkbox" style={{ width: "auto" }} checked={rememberKey} onChange={(e) => toggleRememberKey(e.target.checked)} />
                  Remember key on this device (never included in scenario exports)
                </label>
              </Field>
              <Field label="Face" hint="The face that appears on the call — pick a go-to, or paste any r… face ID.">
                <div className="face-row">
                  {FACE_PRESETS.map((f) => (
                    <button key={f.id} type="button" className={"face-chip" + (faceId.trim() === f.id ? " on" : "")} onClick={() => setFaceId(f.id)} title={f.id}>
                      <span className="face-chip-name">{f.name}</span>
                      <span className="face-chip-vibe">{f.vibe}</span>
                    </button>
                  ))}
                </div>
                <input className="mono" value={faceId} onChange={(e) => setFaceId(e.target.value)} placeholder="r…" />
              </Field>
              <Field label="PAL ID" hint="Filled automatically when you create a persona in the Persona step — or paste an existing p… ID here.">
                <input className="mono" value={palId} onChange={(e) => setPalId(e.target.value)} placeholder="p… (or create one in the Persona step)" />
              </Field>
              <Field label="Language" hint="Full language name. Multilingual auto-detects the speaker's language and responds in kind.">
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Conversation name" hint="Optional label for your dashboard.">
                <input value={conversationName} onChange={(e) => setConversationName(e.target.value)} placeholder="e.g. Acme demo — presentation" />
              </Field>
              <Field label="Callback URL" hint="Optional webhook. Required if you want Canvas interactions and transcripts delivered server-side.">
                <input className="mono" value={callbackUrl} onChange={(e) => setCallbackUrl(e.target.value)} placeholder="https://yourapp.example.com/webhooks/tavus" />
              </Field>
              <Field label="Custom greeting" hint="Optional. The PAL speaks this first, uninterrupted.">
                <textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Hi — I'm ready to walk you through the deck whenever you are." />
              </Field>

              {auth.required && auth.authed && (
                <>
                  <div className="skill-head" style={{ marginTop: 26 }}>
                    <div className="subhead" style={{ margin: 0 }}>Team access</div>
                    <button className="pill-btn primary" style={{ padding: "6px 14px", fontSize: 13 }} onClick={createInvite} disabled={inviteCreating}>
                      {inviteCreating ? "Creating…" : "+ New invite code"}
                    </button>
                  </div>
                  <p className="field-hint" style={{ maxWidth: 560, marginBottom: 10 }}>
                    Each code admits <b>one</b> teammate: send it to them, they hit "Create account" on the lock screen with their own
                    email + password + the code. Codes burn on use and expire after 30 days unused — the list shows who used what.
                  </p>
                  {inviteError && <p className="field-hint" style={{ color: "var(--danger)" }}>{inviteError}</p>}
                  {invites === null ? (
                    <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={loadInvites} disabled={invitesLoading}>
                      {invitesLoading ? "Loading…" : "Show invites"}
                    </button>
                  ) : invites.length === 0 ? (
                    <p className="field-hint">No invites yet — mint one with the button above.</p>
                  ) : (
                    <div className="kb-list" style={{ maxWidth: 640 }}>
                      {invites.map((inv) => (
                        <div key={inv.code} className="kb-row">
                          <span className="mono" style={{ flex: 1, fontSize: 12.5 }}>{inv.code}</span>
                          {inv.expired ? (
                            <span className="kb-status">expired</span>
                          ) : inv.usedBy ? (
                            <span style={{ color: "var(--muted)", fontSize: 11.5 }} title={inv.usedAt}>used by {inv.usedBy}</span>
                          ) : (
                            <>
                              <span className="kb-status kb-ready">unused</span>
                              <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }}
                                onClick={() => copy(inv.code, `inv-${inv.code}`)}>
                                {copied === `inv-${inv.code}` ? "Copied" : "Copy"}
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {step === "persona" && (
            <>
              <h1>Persona</h1>
              <p className="lede">
                Describe the demo in plain English and Claude drafts the PAL's system prompt — voice-first, demo-ready, aware of your objectives, guardrails, and Canvas setup. Review and edit the draft, then attach it. Like objectives, the prompt lives on the PAL itself and persists across conversations.
              </p>
              <Field label="Product / company" hint="What is being demoed, in a sentence or two.">
                <input value={personaBrief.product} onChange={(e) => setBriefField("product", e.target.value)} placeholder="Acme Health — AI-powered patient intake for clinics" />
              </Field>
              <Field label="Audience" hint="Who the persona will be talking to.">
                <input value={personaBrief.audience} onChange={(e) => setBriefField("audience", e.target.value)} placeholder="Clinic operations leads evaluating intake tools" />
              </Field>
              <Field label="Goal of the conversation">
                <input value={personaBrief.goal} onChange={(e) => setBriefField("goal", e.target.value)} placeholder="Qualify their needs and book a follow-up with sales" />
              </Field>
              <Field label="Tone / personality" hint="Optional.">
                <input value={personaBrief.tone} onChange={(e) => setBriefField("tone", e.target.value)} placeholder="Warm, expert, gets to the point" />
              </Field>
              <Field label="Emotional vibe" hint="Optional — how it should feel and react. Tavus performs this through the voice and face automatically; Claude turns your vibe into real emotional direction in the prompt.">
                <textarea style={{ minHeight: 64 }} value={personaBrief.emotions} onChange={(e) => setBriefField("emotions", e.target.value)}
                  placeholder={"Warm and upbeat by default. Gets genuinely excited showing the product. If the visitor sounds frustrated or confused, slows down, softens, and reassures."} />
              </Field>
              <Field label="Must cover" hint="Optional — key points the persona should work in.">
                <textarea value={personaBrief.mustCover} onChange={(e) => setBriefField("mustCover", e.target.value)} placeholder={"HIPAA compliance\n5-minute setup\nEHR integrations"} />
              </Field>
              <Field label="Must avoid" hint="Optional — one per line. These shape the prompt AND are added to the Guardrails step automatically when you generate, so rules live in one place.">
                <textarea value={personaBrief.avoid} onChange={(e) => setBriefField("avoid", e.target.value)} placeholder={"Custom pricing\nCompetitor comparisons"} />
              </Field>

              <button className="pill-btn primary" style={{ marginBottom: 18 }} onClick={generatePersona} disabled={generating}>
                {generating && !personaDraft ? "Drafting…" : personaDraft ? "Regenerate" : "Generate with Claude"}
              </button>

              <Field label="System prompt draft" hint={personaDraft
                ? "Edit freely — this exact text becomes the persona."
                : "Generated here; you can also paste or write your own."}>
                <textarea
                  style={{ minHeight: 260, fontSize: 13, lineHeight: 1.6 }}
                  value={personaDraft}
                  onChange={(e) => { setPersonaDraft(e.target.value); setPersonaAttached(false); }}
                  placeholder="You are…"
                />
              </Field>

              {personaDraft.trim() && (
                <Field label="Revise with feedback" hint='Watched a call and want it different? Say what to change — "less salesy", "stop looping on the email ask", "book the demo earlier" — and Claude edits the draft above AND the Objectives & Guardrails step together (objectives drive the conversation flow, so flow fixes land there, not just in the prompt). Re-attach the prompt afterwards; updated objectives re-attach on your next launch.'>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={personaFeedback} onChange={(e) => setPersonaFeedback(e.target.value)}
                      placeholder="e.g. Too formal — make it warmer, and stop asking two questions in a row"
                      onKeyDown={(e) => e.key === "Enter" && !generating && revisePersona()} />
                    <button className="pill-btn primary" style={{ flexShrink: 0 }} onClick={revisePersona} disabled={generating || !personaFeedback.trim()}>
                      {generating ? "Revising…" : "Revise"}
                    </button>
                  </div>
                </Field>
              )}

              {promptVersions.length > 0 && (
                <details style={{ marginBottom: 22 }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                    🕘 Prompt history ({promptVersions.length}) — every generate, revision, and attach is saved
                  </summary>
                  <div className="kb-list" style={{ maxWidth: 640, marginTop: 10 }}>
                    {promptVersions.map((v, i) => (
                      <div key={`${v.at}-${i}`} className="kb-row" style={{ alignItems: "flex-start" }}>
                        <span style={{ flex: 1, fontSize: 12.5, minWidth: 0 }}>
                          <b>{v.source}</b>{v.attached ? <span style={{ color: "var(--ok)" }}> · attached ✓</span> : ""}
                          <span style={{ color: "var(--muted)" }}> · {String(v.at).slice(5, 16).replace("T", " ")} · {v.text.split(/\s+/).length} words</span>
                          <div style={{ color: "var(--muted)", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.text.slice(0, 120)}</div>
                        </span>
                        <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12, flexShrink: 0 }}
                          disabled={personaDraft.trim() === v.text}
                          onClick={() => restorePromptVersion(v)}>
                          {personaDraft.trim() === v.text ? "Current" : "Restore"}
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="subhead">Create the persona</div>
              <Field label="" hint="Creates a brand-new PAL with this prompt as its brain and sets it as your PAL ID. Needs the API key and Face ID from Setup.">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input style={{ flex: "1 1 180px" }} value={newPalName} onChange={(e) => setNewPalName(e.target.value)} placeholder="Name it — e.g. Acme Sales Expert"
                    onKeyDown={(e) => e.key === "Enter" && !creatingPal && createPal()} />
                  <select style={{ width: "auto", flex: "0 1 auto" }} value={palLlm} onChange={(e) => setPalLlm(e.target.value)} title="The LLM that powers this PAL">
                    {PAL_LLMS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
                  </select>
                  <button className="pill-btn primary" style={{ flexShrink: 0 }} onClick={createPal} disabled={creatingPal || !newPalName.trim()}>
                    {creatingPal ? "Creating…" : "Create PAL"}
                  </button>
                </div>
                <span className="field-hint">{PAL_LLMS.find((m) => m.v === palLlm)?.desc}</span>
              </Field>

              <div className="subhead" style={{ marginTop: 8 }}>…or update an existing PAL</div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 10 }}>
                {palId.trim() ? <>Attaches this prompt to <span className="mono">{palId.trim()}</span> (replaces its current one).</> : "Paste a PAL ID in Setup first."}
              </p>
              <button className="pill-btn" onClick={attachPersona} disabled={generating || personaAttached || !personaDraft.trim() || !palId.trim()}>
                {personaAttached ? "Attached ✓" : "Attach to existing PAL"}
              </button>

              <div className="subhead" style={{ marginTop: 26 }}>Test drive — no video</div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 10 }}>
                Type at your PAL before booting a real call. Runs the exact config on the PAL — persona, goals, rules, knowledge —
                just without the video pipeline, so turns come back in seconds. <b>Tests what's attached</b>: hit Attach above after
                drafting or revising, or you'll be talking to the old prompt. Covers persona, goals, rules, and knowledge —
                video-only skills (slides, canvas) don't run in text mode. Billed like conversation time (a text turn is tiny).
              </p>
              {!chatConvId ? (
                <>
                  <button className="pill-btn primary" onClick={startTestDrive} disabled={chatBusy || !palId.trim() || !apiKey.trim()}>
                    {chatBusy ? "Starting…" : "▶ Start test drive"}
                  </button>
                  {(!apiKey.trim() || !palId.trim()) && (
                    <p className="field-hint" style={{ marginTop: 8 }}>
                      Grayed out because {[!apiKey.trim() && "the Tavus API key", !palId.trim() && "the PAL ID"].filter(Boolean).join(" and ")}{" "}
                      {!apiKey.trim() && !palId.trim() ? "are" : "is"} missing — set it on the <b>Account</b> step (or load a saved scenario from the top bar).
                    </p>
                  )}
                  {chatError && <p className="field-hint" style={{ color: "var(--danger)", marginTop: 8, maxWidth: 560 }}>{chatError}</p>}
                </>
              ) : (
                <div style={{ maxWidth: 640 }}>
                  <div className="transcript" style={{ maxHeight: 300, overflowY: "auto", marginBottom: 10 }}>
                    {chatLog.length === 0 && <p className="field-hint" style={{ padding: 10 }}>Say something — "hi" is a fine start.</p>}
                    {chatLog.map((m, i) => (
                      <div key={i} className={`t-row t-${m.role === "pal" ? "assistant" : m.role}`}>
                        <span className="t-role">{m.role === "pal" ? (site.brand || "PAL") : m.role === "user" ? "You" : "!"}</span>
                        <span>{m.text}</span>
                      </div>
                    ))}
                    {chatBusy && <div className="t-row t-assistant"><span className="t-role">{site.brand || "PAL"}</span><span style={{ opacity: 0.5 }}>thinking…</span></div>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Try the openers a real visitor would use…"
                      onKeyDown={(e) => e.key === "Enter" && sendTestTurn()} disabled={chatBusy} />
                    <button className="pill-btn primary" style={{ flexShrink: 0 }} onClick={sendTestTurn} disabled={chatBusy || !chatInput.trim()}>Send</button>
                    <button className="pill-btn" style={{ flexShrink: 0 }} onClick={endTestDrive}>End</button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === "guide" && (
            <>
              <h1>Objectives &amp; Guardrails</h1>
              <p className="lede">
                Tavus's flow engine: <b>Objectives</b> drive the conversation through your steps mechanically (with if/then branching),
                and <b>Guardrails</b> keep it safe and on-brand. Both attach to the PAL and persist for every future conversation until you change them.
              </p>

              <div className="skill-head">
                <div className="subhead" style={{ margin: 0 }}>Objectives</div>
                <Toggle on={objectivesEnabled} onChange={setObjectivesEnabled} />
              </div>
              <p className="field-hint" style={{ maxWidth: 600, marginBottom: 8 }}>
                One objective per line — top to bottom is the flow, and the PAL won't advance until a step completes.
                <b> Branch with if/then</b>: indent a line as <span className="mono">if &lt;condition&gt; -&gt; &lt;detour objective&gt;</span> under
                a step; the detour runs when the condition matches, then rejoins the main flow (a catch-all is added for you).
                To collect data, just say so ("Ask for their name and email").
              </p>
              <Field label="" hint={objectivesEnabled && objectivesPayload.data.length
                ? (() => { let n = 0; return `Your flow: ${objectivesPayload.data.map((o) => `${/_if\d+_/.test(o.objective_name) ? "↳" : `${++n})`} ${shortLabel(o.objective_prompt)}`).join("   ")}`; })()
                : "Best for templated flows (intake, interview, qualification). Free-flowing conversations usually don't need objectives."}>
                <textarea
                  style={{ minHeight: 130 }}
                  disabled={!objectivesEnabled}
                  value={objectivesText}
                  onChange={(e) => setObjectivesText(e.target.value)}
                  placeholder={"Ask which product they're evaluating\nUnderstand their budget and timeline\n  if budget is under $10k -> Suggest the starter tier and check it fits\n  if they have no timeline -> Explore what would make this urgent\nAsk who else is involved in the decision\nBook a follow-up meeting"}
                />
              </Field>
              {objectivesEnabled && (
                <Field label="Completion check">
                  <div className="seg">
                    <button className={confirmationMode === "auto" ? "on" : ""} onClick={() => setConfirmationMode("auto")}>Auto</button>
                    <button className={confirmationMode === "manual" ? "on" : ""} onClick={() => setConfirmationMode("manual")}>Manual</button>
                  </div>
                  <span className="field-hint">Auto: the evaluator LLM decides when each step is complete. Manual: the participant is asked to confirm.</span>
                </Field>
              )}

              <div className="skill-head" style={{ marginTop: 18 }}>
                <div className="subhead" style={{ margin: 0 }}>Guardrails</div>
                <Toggle on={guardrailsEnabled} onChange={setGuardrailsEnabled} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 8 }}>
                One guardrail per line — what the PAL must never do, or what should be flagged. Add [visual] to a line for camera-enforced rules (e.g. "More than one person is visible [visual]"). Violations fire real-time events and hit your callback URL.
              </p>
              <Field label="" hint={guardrailsEnabled && guardrailsParsed.length
                ? `Will create ${guardrailsParsed.length} guardrail${guardrailsParsed.length > 1 ? "s" : ""} and merge with any already on the PAL.`
                : "Guardrails steer behavior and flag violations — they are guidance, not a hard guarantee."}>
                <textarea
                  style={{ minHeight: 110 }}
                  disabled={!guardrailsEnabled}
                  value={guardrailsText}
                  onChange={(e) => setGuardrailsText(e.target.value)}
                  placeholder={"Never discuss competitors or their products\nNever quote custom pricing — direct pricing questions to the sales team\nUser is sharing credit card numbers or passwords\nMore than one person is visible in camera view [visual]"}
                />
              </Field>
              <Field label="When a rule is hit, say… (optional)" hint="Spoken word-for-word the moment any rule above triggers. Leave blank for no spoken reaction.">
                <textarea disabled={!guardrailsEnabled} value={guardrailEcho} onChange={(e) => setGuardrailEcho(e.target.value)}
                  placeholder="That's outside what I can help with here — but I'm happy to get you to the right person." />
              </Field>
            </>
          )}

          {step === "vision" && (
            <>
              <div className="skill-head">
                <h1>Vision</h1>
                <Toggle on={visionEnabled} onChange={setVisionEnabled} />
              </div>
              <p className="lede">
                Give the PAL eyes and ears. Describe in plain English what it should notice — on camera, on a shared screen, or in the user's tone — and Claude turns that into the checks Tavus's perception model (raven-1) runs continuously during the call. Like objectives, this attaches to the PAL on launch and persists.
              </p>
              <Field label="What should it notice?" hint="Plain English — Claude converts this into precise visual and audio checks below.">
                <textarea
                  style={{ minHeight: 90 }}
                  disabled={!visionEnabled}
                  value={visionVibe}
                  onChange={(e) => setVisionVibe(e.target.value)}
                  placeholder={"Notice when they hold up their ID or a document, when someone else walks into frame, and when they sound confused or frustrated so it can slow down and help."}
                />
              </Field>
              <button className="pill-btn primary" style={{ marginBottom: 22 }} onClick={generateVision} disabled={!visionEnabled || visionGenerating || !visionVibe.trim()}>
                {visionGenerating ? "Drafting…" : (visualQueriesText || audioQueriesText) ? "Regenerate checks" : "Generate checks with Claude"}
              </button>

              <Field label="Visual checks" hint="One per line — what raven-1 continuously watches for in the camera/screen. Edit freely.">
                <textarea
                  style={{ minHeight: 110 }}
                  disabled={!visionEnabled}
                  value={visualQueriesText}
                  onChange={(e) => setVisualQueriesText(e.target.value)}
                  placeholder={"Is the user holding a document or ID up to the camera?\nIs more than one person visible in the frame?"}
                />
              </Field>
              <Field label="Audio checks" hint="One per line — tone and emotion cues from the user's voice (raven-1 only). Optional.">
                <textarea
                  style={{ minHeight: 80 }}
                  disabled={!visionEnabled}
                  value={audioQueriesText}
                  onChange={(e) => setAudioQueriesText(e.target.value)}
                  placeholder={"Does the user sound confused or frustrated?\nHas the user asked to speak to a human?"}
                />
              </Field>
            </>
          )}

          {step === "speech" && (
            <>
              <div className="skill-head">
                <h1>Voice</h1>
                <Toggle on={speechEnabled} onChange={setSpeechEnabled} />
              </div>
              <p className="lede">
                Teach the PAL how to say your product names, acronyms, and people. One rule per line: the word, then how to say it. On launch these become a pronunciation dictionary attached to the PAL's voice — it works with every Tavus voice engine.
              </p>

              <div className="subhead">Voice &amp; accent</div>
              <Field label="" hint='Search Cartesia&apos;s voice library by accent, language, or vibe — try "british", "australian male", "warm spanish". The pick applies to the PAL on launch.'>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={voiceQuery} onChange={(e) => setVoiceQuery(e.target.value)} placeholder='e.g. "british female warm"'
                    onKeyDown={(e) => e.key === "Enter" && !voiceLoading && searchVoices()} />
                  <button className="pill-btn" style={{ flexShrink: 0 }} onClick={searchVoices} disabled={voiceLoading}>
                    {voiceLoading ? "Searching…" : "Search voices"}
                  </button>
                </div>
                {externalVoiceId && (
                  <span className="field-hint" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    Current pick: <b>{externalVoiceName || externalVoiceId}</b>
                    <button className="pill-btn" style={{ padding: "2px 10px", fontSize: 11 }} onClick={() => { setExternalVoiceId(""); setExternalVoiceName(""); }}>Clear</button>
                  </span>
                )}
              </Field>
              {voiceResults && (
                <div className="kb-list" style={{ marginBottom: 20 }}>
                  {voiceResults.length === 0 && <p className="field-hint">No matches — try broader words ("british", "german", "young").</p>}
                  {voiceResults.map((v) => (
                    <div key={v.id} className="kb-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{v.name} {v.language && <span className="kb-status" style={{ marginLeft: 6 }}>{v.language}</span>}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.description}</div>
                      </div>
                      <button className={"pill-btn" + (externalVoiceId === v.id ? " primary" : "")} style={{ padding: "4px 12px", fontSize: 12, flexShrink: 0 }}
                        onClick={() => { setExternalVoiceId(v.id); setExternalVoiceName(v.name); }}>
                        {externalVoiceId === v.id ? "Selected ✓" : "Use this voice"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="skill-head" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Expressive delivery</span>
                <Toggle on={emotionControl} onChange={setEmotionControl} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 20 }}>
                On: the voice and face carry real emotion, guided by the "Emotional vibe" you set in the Persona step. Off: flat, even delivery (rarely what you want for demos). Applied on launch.
              </p>
              <Field label="Rules" hint={speechEnabled && pronunciationRules.length
                ? `${pronunciationRules.length} rule${pronunciationRules.length > 1 ? "s" : ""} ready: ${pronunciationRules.slice(0, 4).map((r) => r.text).join(", ")}${pronunciationRules.length > 4 ? "…" : ""}`
                : 'Write it how it sounds: "Tavus = TAH-vuss". For phonetic IPA notation add [ipa]; for exact-case matching add [case].'}>
                <textarea
                  className="mono"
                  style={{ minHeight: 140 }}
                  disabled={!speechEnabled}
                  value={pronunciationText}
                  onChange={(e) => setPronunciationText(e.target.value)}
                  placeholder={"Tavus = TAH-vuss\nCVI = C V I\nNguyen = win\nlive demo = lyve demo"}
                />
              </Field>
            </>
          )}

          {step === "kb" && (
            <>
              <h1>Knowledge</h1>
              <p className="lede">
                Give the PAL material to know and present. Add any public link — a PDF, deck, doc, image, spreadsheet, or a whole website — and Tavus processes it in the background (a few minutes). Tick "PAL can use" to let the PAL reference a document when answering in this demo.
              </p>

              <Field label="Add by link" hint="Supports .pdf .docx .pptx .txt .csv .xlsx .png .jpg — or any website URL. Files on your computer need a shareable link first (Drive, Dropbox, Slack…).">
                <input className="mono" value={kbUrl} onChange={(e) => setKbUrl(e.target.value)} placeholder="https://…/deck.pdf or https://yourcompany.com"
                  onKeyDown={(e) => e.key === "Enter" && !kbAdding && addKbDoc()} />
              </Field>
              <Field label="Name (optional)">
                <input value={kbName} onChange={(e) => setKbName(e.target.value)} placeholder="Q3 sales deck" />
              </Field>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, maxWidth: 560 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" style={{ width: "auto" }} checked={kbCrawl} onChange={(e) => setKbCrawl(e.target.checked)} />
                  It's a website — crawl linked pages too
                </label>
                <button className="pill-btn primary" style={{ marginLeft: "auto" }} onClick={addKbDoc} disabled={kbAdding || !kbUrl.trim()}>
                  {kbAdding ? "Adding…" : "Add to Knowledge Base"}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, maxWidth: 560 }}>
                <span className="field-hint" style={{ margin: 0 }}>…or straight from your computer:</span>
                <button className="pill-btn" onClick={() => kbFileRef.current?.click()} disabled={kbAdding}>
                  {kbAdding ? "Working…" : "Upload a file"}
                </button>
                <input ref={kbFileRef} type="file" style={{ display: "none" }}
                  accept=".pdf,.pptx,.docx,.doc,.txt,.csv,.xlsx,.png,.jpg,.jpeg"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadKbFile(f); e.target.value = ""; }} />
              </div>

              <div className="skill-head" style={{ marginTop: 10 }}>
                <div className="subhead" style={{ margin: 0 }}>Your documents</div>
                <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => fetchKbDocs()} disabled={kbLoading}>
                  {kbLoading ? "Loading…" : kbDocs ? "Refresh" : "Load documents"}
                </button>
              </div>
              {kbDocs === null && <p className="field-hint" style={{ maxWidth: 560 }}>Click "Load documents" to list everything in this account's Knowledge Base.</p>}
              {kbDocs?.length === 0 && <p className="field-hint">No documents yet — add one above.</p>}
              {!!kbDocs?.length && (
                <div className="kb-list">
                  {kbDocs.map((d) => (
                    <div key={d.document_id} className="kb-row">
                      <input
                        className="kb-name"
                        defaultValue={d.document_name || d.document_id}
                        title="Click to rename — saves when you click away"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== (d.document_name || d.document_id)) renameKbDoc(d.document_id, v);
                        }}
                      />
                      <span className={`kb-status kb-${d.status}`}>{d.status}{d.status === "processing" && d.progress != null ? ` ${d.progress}%` : ""}</span>
                      <label className="kb-use" title="Let the PAL reference this document when answering in this demo">
                        <input type="checkbox" style={{ width: "auto" }}
                          checked={knowledgeIds.includes(d.document_id)}
                          onChange={() => setKnowledgeIdsRaw((raw) => toggleIdIn(raw, d.document_id))} />
                        PAL can use
                      </label>
                      <button className="kb-del" title="Delete from Knowledge Base" onClick={() => deleteKbDoc(d.document_id, d.document_name)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="field-hint" style={{ marginTop: 12, maxWidth: 560 }}>
                {knowledgeIds.length
                  ? `${knowledgeIds.length} document${knowledgeIds.length > 1 ? "s" : ""} will be available to the PAL in this demo's conversations.`
                  : "Nothing selected yet — the PAL won't reference the Knowledge Base in this demo."} To have the PAL present a deck as slides, pick it in the Presentation step.
              </p>
            </>
          )}

          {step === "presentation" && (
            <>
              <div className="skill-head">
                <h1>Slides</h1>
                <Toggle on={presentationEnabled} onChange={setPresentationEnabled} />
              </div>
              <p className="lede">The PAL presents PDF decks and images from your Knowledge Base as a live screen share. PDFs must be 50 pages or fewer and fully processed ("ready") before launching. Slides appear inside the conversation automatically.</p>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                <button className="pill-btn primary" onClick={() => deckFileRef.current?.click()} disabled={kbAdding || !presentationEnabled}>
                  {kbAdding ? "Uploading…" : "⬆ Upload a deck"}
                </button>
                <span className="field-hint" style={{ margin: 0 }}>PDF or PPTX from your computer — lands in the Knowledge Base and joins this deck.</span>
                <input ref={deckFileRef} type="file" style={{ display: "none" }} accept=".pdf,.pptx,.png,.jpg,.jpeg"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadKbFile(f, { addToDeck: true }); e.target.value = ""; }} />
              </div>

              <div className="skill-head" style={{ marginTop: 4 }}>
                <div className="subhead" style={{ margin: 0 }}>…or pick from your Knowledge Base</div>
                <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => fetchKbDocs()} disabled={kbLoading}>
                  {kbLoading ? "Loading…" : kbDocs ? "Refresh" : "Load documents"}
                </button>
              </div>
              {kbDocs === null && <p className="field-hint" style={{ maxWidth: 560 }}>Load your Knowledge Base to pick decks — or upload one above.</p>}
              {kbDocs?.length === 0 && <p className="field-hint" style={{ maxWidth: 560 }}>Your Knowledge Base is empty — upload a deck above or add material in the Knowledge step.</p>}
              {!!kbDocs?.length && (
                <div className="kb-list" style={{ marginBottom: 6 }}>
                  {kbDocs.map((d) => (
                    <div key={d.document_id} className="kb-row">
                      <label className="kb-use" style={{ flex: 1, justifyContent: "flex-start" }}>
                        <input type="checkbox" style={{ width: "auto" }} disabled={!presentationEnabled}
                          checked={docIds.includes(d.document_id)}
                          onChange={() => setDocIdsRaw((raw) => toggleIdIn(raw, d.document_id))} />
                        {d.document_name || d.document_id}
                      </label>
                      {!PRESENTABLE.test(d.document_url || "") && (
                        <span className="kb-status" title="Couldn't verify the format from the link — slides need a PDF, PPTX, or image. If it is one, it'll present fine.">format?</span>
                      )}
                      <span className={`kb-status kb-${d.status}`}>{d.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {docIds.length > 1 && (
                <>
                  <div className="subhead" style={{ marginTop: 14 }}>Deck order</div>
                  <div className="kb-list" style={{ maxWidth: 560 }}>
                    {docIds.map((id, i) => {
                      const doc = kbDocs?.find((d) => d.document_id === id);
                      return (
                        <div key={id} className="kb-row">
                          <span style={{ color: "var(--muted)", fontSize: 12, width: 18 }}>{i + 1}.</span>
                          <span style={{ flex: 1, fontSize: 13 }}>{doc?.document_name || id}</span>
                          <button className="kb-move" disabled={i === 0} onClick={() => {
                            const ids = [...docIds]; [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; setDocIdsRaw(ids.join("\n"));
                          }}>↑</button>
                          <button className="kb-move" disabled={i === docIds.length - 1} onClick={() => {
                            const ids = [...docIds]; [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; setDocIdsRaw(ids.join("\n"));
                          }}>↓</button>
                          <button className="kb-del" title="Remove from the deck" onClick={() => setDocIdsRaw(docIds.filter((x) => x !== id).join("\n"))}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <Field label="Document IDs (advanced)" hint="The picker fills this for you — but you can paste IDs directly too. Order here is the deck order.">
                <textarea className="mono" value={docIdsRaw} onChange={(e) => setDocIdsRaw(e.target.value)} placeholder={"d1234567890\nd2468101214"} />
              </Field>
              <Field label="Slides trigger">
                <div className="seg">
                  <button className={slidesTrigger === "walk_the_deck" ? "on" : ""} onClick={() => setSlidesTrigger("walk_the_deck")}>Walk the deck</button>
                  <button className={slidesTrigger === "on_demand" ? "on" : ""} onClick={() => setSlidesTrigger("on_demand")}>On demand</button>
                </div>
                <span className="field-hint">Walk the deck: the deck drives the conversation end to end. On demand: the PAL pulls the relevant slide when the conversation calls for it.</span>
              </Field>
              <Field label="Presenter style" hint="Optional — how it should present overall.">
                <textarea value={presentPrompt} onChange={(e) => setPresentPrompt(e.target.value)} placeholder="Walk the participant through the deck one slide at a time. Pause for questions after each section." />
              </Field>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <button className="pill-btn" onClick={injectPresentationIntoPrompt} disabled={!presentationEnabled || docIds.length === 0 || generating || !personaDraft.trim()}
                  title={personaDraft.trim() ? "Claude rewrites the persona (and goals if needed) so the call actually reaches the deck and presents it well" : "Draft a persona first — there's no prompt to inject into yet"}>
                  {generating ? "Weaving…" : "🪡 Inject into prompt"}
                </button>
              </div>
              <p className="field-hint" style={{ maxWidth: 620, marginBottom: 18 }}>
                The skill shares the slides, but the persona decides when the deck starts, the pacing, and how to resume after questions.
                <b> Inject into prompt</b> weaves the deck — trigger, presenter style, talk track — into the persona (and goals) so presenting actually happens.
                Re-attach the prompt on the Persona step afterwards, then relaunch.
              </p>

              <div className="skill-head" style={{ marginTop: 10 }}>
                <div className="subhead" style={{ margin: 0 }}>Talk track — what to say on each slide</div>
                <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={draftTalkTrack} disabled={!presentationEnabled || talkTrackDrafting}>
                  {talkTrackDrafting ? "Drafting…" : "✨ Draft talk track"}
                </button>
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 10 }}>
                Speaker notes per slide — the AI follows them in its own voice as it presents. Claude can draft them from your use case (it can't see the slides, so give the draft a read).
              </p>
              {talkTrack.length === 0 && (
                <button className="pill-btn" style={{ marginBottom: 8 }} disabled={!presentationEnabled}
                  onClick={() => setTalkTrack(["", "", "", ""])}>+ Start a talk track</button>
              )}
              {talkTrack.length > 0 && (
                <div className="kb-list" style={{ maxWidth: 640, marginBottom: 8 }}>
                  {talkTrack.map((note, i) => (
                    <div key={i} className="kb-row" style={{ alignItems: "flex-start" }}>
                      <span style={{ color: "var(--muted)", fontSize: 12, width: 52, paddingTop: 8, flexShrink: 0 }}>Slide {i + 1}</span>
                      <textarea
                        style={{ minHeight: 44, fontSize: 12.5, flex: 1 }}
                        disabled={!presentationEnabled}
                        value={note}
                        onChange={(e) => setTalkTrack((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
                        placeholder="What should it say here? End with a question to keep it two-way."
                      />
                      <button className="kb-del" title="Remove this slide's note" onClick={() => setTalkTrack((t) => t.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {talkTrack.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12 }} disabled={!presentationEnabled}
                    onClick={() => setTalkTrack((t) => [...t, ""])}>+ Add slide</button>
                  <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12, color: "var(--danger)" }}
                    onClick={() => setTalkTrack([])}>Clear track</button>
                </div>
              )}
            </>
          )}

          {step === "canvas" && (
            <>
              <div className="skill-head">
                <h1>Magic Canvas</h1>
                <Toggle on={canvasEnabled} onChange={setCanvasEnabled} />
              </div>
              <p className="lede">Interactive cards next to the video — polls, charts, live booking — that make the conversation tactile. The trick is restraint: a few well-timed cards beat a slideshow. Let Claude plan it, then adjust.</p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <button className="pill-btn primary" onClick={generateCanvasPlan} disabled={!canvasEnabled || canvasPlanning}>
                  {canvasPlanning ? "Planning…" : "✨ Suggest a canvas plan"}
                </button>
                <button className="pill-btn" onClick={injectCanvasIntoPrompt} disabled={!canvasEnabled || generating || !personaDraft.trim()}
                  title={personaDraft.trim() ? "Claude rewrites the persona (and goals if needed) so the conversation creates each card's moment" : "Draft a persona first — there's no prompt to inject into yet"}>
                  {generating ? "Weaving…" : "🪡 Inject into prompt"}
                </button>
              </div>
              <p className="field-hint" style={{ maxWidth: 620, marginBottom: 18 }}>
                Cards only appear when the conversation reaches their moment — a rule alone can't fire if the moment never happens.
                <b> Inject into prompt</b> weaves each card's moment into the persona (and goals) so the conversation steers there.
                Re-attach the prompt on the Persona step afterwards, then relaunch.
              </p>

              <div className="comp-grid">
                {CANVAS_COMPONENTS.map((c) => (
                  <div key={c.key} className={"comp-card" + (components[c.key] ? "" : " off")}>
                    <div className="comp-top">
                      <span className="comp-name">{c.label}</span>
                      <Toggle on={components[c.key]} onChange={(v) => setComponents((p) => ({ ...p, [c.key]: v }))} />
                    </div>
                    <span className="comp-desc">{c.desc}</span>
                    {components[c.key] && (
                      <input
                        className="rule-input"
                        value={componentRules[c.key]}
                        onChange={(e) => setComponentRules((p) => ({ ...p, [c.key]: e.target.value }))}
                        placeholder="When should the PAL show this?"
                      />
                    )}
                  </div>
                ))}
              </div>

              {components.scheduling_embed && (
                <Field label="Calendly URL (activates Scheduling)" hint="Public https link. The Scheduling card stays inactive until this is set.">
                  <input className="mono" style={{ marginTop: 14 }} value={schedulingUrl} onChange={(e) => setSchedulingUrl(e.target.value)} placeholder="https://calendly.com/you/30min" />
                </Field>
              )}

              <div className="subhead">How eagerly cards appear</div>
              <div className="seg" style={{ marginBottom: 6 }}>
                {[
                  { v: "eager", label: "Eager" },
                  { v: "balanced", label: "Balanced" },
                  { v: "minimal", label: "Minimal" },
                  { v: "on_request", label: "Only when asked" },
                ].map((o) => (
                  <button key={o.v} className={canvasStyle === o.v ? "on" : ""} onClick={() => setCanvasStyle(o.v)}>{o.label}</button>
                ))}
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 20 }}>
                Eager: cards at every opportunity. Balanced: the PAL's default judgment. Minimal: only when clearly better than speaking. Only when asked: nothing appears unless the user requests it or a rule triggers it.
              </p>

              <div className="subhead">Canvas playbook</div>
              <Field label="" hint="Plain-English direction the PAL follows for this conversation — sequencing, triggers, exclusions. Sent as conversation context on launch, so different demos can run different playbooks without touching the PAL.">
                <textarea
                  style={{ minHeight: 110 }}
                  value={canvasPlaybook}
                  onChange={(e) => setCanvasPlaybook(e.target.value)}
                  placeholder={"e.g. Open with a question card asking which product line they're evaluating. Show the pricing chart only after they mention budget. If they agree to a follow-up, show the scheduling card immediately. Never show alerts."}
                />
              </Field>

              <div className="subhead">Card placement</div>
              <p className="lede" style={{ marginBottom: 10 }}>
                Cards render in a side rail beside the PAL video — right or left are the only placements the platform offers. This steers the PAL's choice via conversation context.
              </p>
              <div className="placement-row">
                {[
                  { v: "auto", label: "PAL decides", right: true, left: true },
                  { v: "right", label: "Prefer right rail", right: true, left: false },
                  { v: "left", label: "Prefer left rail", right: false, left: true },
                ].map((o) => (
                  <div key={o.v} className={"placement-card" + (placement === o.v ? " on" : "")} onClick={() => setPlacement(o.v)}>
                    <div className="placement-viz">
                      <div className={"pv-rail" + (o.left ? "" : " ghost")} />
                      <div className="pv-video" />
                      <div className={"pv-rail" + (o.right ? "" : " ghost")} />
                    </div>
                    {o.label}
                  </div>
                ))}
              </div>
              <p className="field-hint" style={{ marginTop: 14, maxWidth: 560 }}>
                Canvas only fires on video conversations. One card on screen at a time; a new card replaces the current one. Interactions land at your callback URL as canvas.interaction events.
              </p>

              <div className="subhead" style={{ marginTop: 30 }}>Scripted cards — 100% deterministic</div>
              <p className="lede" style={{ marginBottom: 10 }}>
                Magic Canvas cards above are chosen by the AI. Scripted cards are <b>yours</b>: you author the exact
                content, and it appears when your rule fires — when a word is spoken (by either side, so it tracks
                your talk track), at a set time, or at call start. The AI is never consulted. Shows on desktop and
                live-kiosk pages; an interactive Magic Canvas card takes the panel over while it needs input.
              </p>
              {scCards.length > 0 && (
                <div className="jr-list">
                  {scCards.map((c, i) => (
                    <div key={i} className="jr-card">
                      <div className="jr-head">
                        <span className="jr-num">{i + 1}</span>
                        <select style={{ width: "auto", padding: "4px 10px", fontSize: 12 }} value={c.style || "note"}
                          onChange={(e) => setScCards((cs) => cs.map((x, j) => (j === i ? { ...x, style: e.target.value } : x)))}>
                          <option value="note">📄 Note</option>
                          <option value="chart">📊 Chart</option>
                          <option value="stat">🔢 Big stat</option>
                          <option value="image">🖼 Image</option>
                          <option value="question">❓ Multiple choice</option>
                        </select>
                        <select style={{ width: "auto", padding: "4px 10px", fontSize: 12 }} value={c.trigger || "keyword"}
                          onChange={(e) => setScCards((cs) => cs.map((x, j) => (j === i ? { ...x, trigger: e.target.value } : x)))}>
                          <option value="keyword">when a word is said</option>
                          <option value="time">at a set time</option>
                          <option value="start">at call start</option>
                        </select>
                        <span className="jr-btns">
                          <button className="kb-move" onClick={() => setScCards((cs) => { if (!cs[i - 1]) return cs; const n = [...cs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} disabled={i === 0} title="Move up">↑</button>
                          <button className="kb-move" onClick={() => setScCards((cs) => { if (!cs[i + 1]) return cs; const n = [...cs]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} disabled={i === scCards.length - 1} title="Move down">↓</button>
                          <button className="kb-del" onClick={() => setScCards((cs) => cs.filter((_, j) => j !== i))} title="Remove card">✕</button>
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
                          {(c.trigger || "keyword") === "keyword" && (
                            <input value={c.keywords || ""} onChange={(e) => setScCards((cs) => cs.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)))}
                              placeholder='Trigger words, comma-separated — e.g. pricing, cost, tiers' />
                          )}
                          {c.trigger === "time" && (
                            <input type="number" min="0.5" step="0.5" value={c.atMinutes ?? ""} onChange={(e) => setScCards((cs) => cs.map((x, j) => (j === i ? { ...x, atMinutes: e.target.value } : x)))}
                              placeholder="Minutes into the call — e.g. 2" />
                          )}
                          <input value={c.title || ""} onChange={(e) => setScCards((cs) => cs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                            placeholder={c.style === "question" ? "The question — e.g. Which package fits you best?" : "Card title (optional)"} />
                          {c.style === "image" ? (
                            <input className="mono" value={c.url || ""} onChange={(e) => setScCards((cs) => cs.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="Image URL" />
                          ) : (
                            <textarea value={c.body || ""} onChange={(e) => setScCards((cs) => cs.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                              placeholder={c.style === "chart" ? "One bar per line — Label: number (e.g. Tier 1: 4900)" : c.style === "stat" ? "Big value on the first line, label on the second — e.g.\n87%\nless manual work" : c.style === "question" ? "One choice per line (2–4):\nClassic Santa\nBetter Santa" : "The exact text to show, one paragraph per line."}
                              style={{ minHeight: 68 }} />
                          )}
                          <input type="number" min="0" value={c.hideAfter ?? ""} onChange={(e) => setScCards((cs) => cs.map((x, j) => (j === i ? { ...x, hideAfter: e.target.value } : x)))}
                            placeholder="Auto-hide after N seconds (blank = stays until the next card)" />
                        </div>
                        {(() => {
                          const preview = compiledScriptedCards.find((_, k) => {
                            // map editor index → compiled index (incomplete cards drop out)
                            let n = -1;
                            for (let j = 0; j <= i; j++) {
                              const cj = scCards[j];
                              const style = ["note", "chart", "stat", "image"].includes(cj.style) ? cj.style : "note";
                              const hasContent = style === "image" ? (cj.url || "").trim() : (cj.body || "").trim();
                              const trig = cj.trigger || "keyword";
                              const trigOk = trig === "start" || (trig === "keyword" ? (cj.keywords || "").trim() : parseFloat(cj.atMinutes) > 0);
                              if (hasContent && trigOk) n++;
                            }
                            return k === n && n >= 0;
                          });
                          return preview ? (
                            <div className="sc-preview" title="Live preview — exactly what the visitor sees">
                              <ScriptedCard card={preview} />
                            </div>
                          ) : (
                            <div className="sc-preview sc-preview-empty">fill in the content + trigger<br />to see the live preview</div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="pill-btn" onClick={() => setScCards((cs) => (cs.length >= 12 ? cs : [...cs, { style: "note", trigger: "keyword" }]))}>+ Scripted card</button>
            </>
          )}

          {step === "tools" && (
            <>
              <div className="skill-head">
                <h1>Integrations</h1>
                <Toggle on={toolsEnabled} onChange={setToolsEnabled} />
              </div>
              <p className="lede">
                Give the PAL abilities in plain English — "book a meeting", "create a CRM lead", "file a ticket". When the PAL decides to use one mid-conversation, the call fires into any webhook you point at (Zapier, Make, n8n, your own endpoint) with the details it collected. This is the "Tavus plugs into anything" demo: no code on the Tavus side.
              </p>

              {toolRows.map((row, i) => (
                <div key={i} className="kb-row" style={{ maxWidth: 640, marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <input style={{ flex: "1 1 140px" }} disabled={!toolsEnabled} value={row.name} placeholder="Ability — e.g. Book a meeting"
                    onChange={(e) => setToolRows((rs) => rs.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} />
                  <input style={{ flex: "2 1 220px" }} disabled={!toolsEnabled} value={row.desc} placeholder="When to use it — e.g. When they agree to a follow-up call"
                    onChange={(e) => setToolRows((rs) => rs.map((r, j) => j === i ? { ...r, desc: e.target.value } : r))} />
                  <input style={{ flex: "1 1 150px" }} disabled={!toolsEnabled} value={row.fields} placeholder="Details to collect — name, email"
                    onChange={(e) => setToolRows((rs) => rs.map((r, j) => j === i ? { ...r, fields: e.target.value } : r))} />
                  {toolRows.length > 1 && (
                    <button className="kb-del" onClick={() => setToolRows((rs) => rs.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
              ))}
              <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13, marginBottom: 20 }} disabled={!toolsEnabled}
                onClick={() => setToolRows((rs) => [...rs, { name: "", desc: "", fields: "" }])}>+ Add ability</button>

              <Field label="Send tool calls to (webhook URL)" hint="Any HTTPS endpoint — a Zapier 'Catch Hook', Make, n8n, or your own API. Each call posts JSON: { tool, arguments, conversation_id }. Fires live from the demo page.">
                <input className="mono" disabled={!toolsEnabled} value={toolWebhook} onChange={(e) => setToolWebhook(e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/…" />
              </Field>
              <Field label="Spoken confirmation (optional)" hint="Said by the PAL right after it uses an ability.">
                <input disabled={!toolsEnabled} value={toolEcho} onChange={(e) => setToolEcho(e.target.value)} placeholder="Done — I've sent that over to the team." />
              </Field>
              <p className="field-hint" style={{ maxWidth: 560 }}>
                On launch the abilities attach to the PAL ({toolDefs.length ? toolDefs.map((t) => t.function.name).join(", ") : "none defined yet"}) and persist on it. The webhook forwarding works on the demo page's custom call UI — including shared /d/ links.
              </p>

              <div className="subhead" style={{ marginTop: 26 }}>Tavus skills</div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 12 }}>
                Pre-built abilities Tavus maintains — toggle on and they attach to the PAL at launch, then persist until you detach them.
              </p>

              <div className="skill-head" style={{ maxWidth: 560, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>🔎 Internet Search</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => detachSkill("internet_search")}>Detach</button>
                  <Toggle on={internetSearchEnabled} onChange={setInternetSearchEnabled} />
                </span>
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 16 }}>
                Live web answers mid-call — no configuration.
              </p>

              <div className="skill-head" style={{ maxWidth: 560, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>🌐 Browser Use</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => detachSkill("browser_use")}>Detach</button>
                  <Toggle on={browserUseEnabled} onChange={setBrowserUseEnabled} />
                </span>
              </div>
              <p className="field-hint" style={{ maxWidth: 560 }}>
                The AI human drives a live web browser on the call — the browser view appears in the stage automatically
                (same screen track as slides). Steer <i>when</i> it browses through the persona ("when they ask about pricing,
                pull up the pricing page"). This skill is brand-new: if Tavus rejects the attach at launch, the log shows the
                exact reason (it may need enabling on your account).
              </p>
              {browserUseEnabled && (
                <>
                  <Field label="Browse plan" hint='The "talk track" for browsing — one moment per line, when → which page. Travels with each launch (like canvas rules), so different demos can browse differently on the same PAL.'>
                    <textarea style={{ minHeight: 90, fontSize: 13 }} value={browsePlan}
                      onChange={(e) => setBrowsePlan(e.target.value)}
                      placeholder={"When they ask about pricing → pull up tavus.io/pricing\nWhen comparing plans → the plans comparison page\nIf they mention the API → the developer docs homepage"} />
                  </Field>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <button className="pill-btn" onClick={injectBrowsingIntoPrompt} disabled={generating || !personaDraft.trim()}
                      title={personaDraft.trim() ? "Claude weaves the browsing moments into the persona (and goals) so the conversation actually steers there" : "Draft a persona first"}>
                      {generating ? "Weaving…" : "🪡 Inject into prompt"}
                    </button>
                  </div>
                  <p className="field-hint" style={{ maxWidth: 560, marginBottom: 14 }}>
                    Like cards, browsing only happens when the conversation reaches its moment — the plan rides each launch, and
                    <b> Inject into prompt</b> makes the persona steer toward those moments. Re-attach the prompt afterwards, then relaunch.
                  </p>
                  <Field label="Advanced config (optional JSON)" hint='Passed verbatim as the skill’s config. Leave empty for defaults; add fields from the Browser Use docs as they ship (e.g. a starting URL or allowed sites).'>
                    <textarea className="mono" style={{ minHeight: 70, fontSize: 12 }} value={browserUseConfig}
                      onChange={(e) => setBrowserUseConfig(e.target.value)} placeholder='{ }' />
                  </Field>
                </>
              )}
            </>
          )}

          {step === "calls" && (
            <>
              <div className="skill-head">
                <h1>Results</h1>
                <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={fetchCalls} disabled={callsLoading}>
                  {callsLoading ? "Loading…" : callsList ? "Refresh" : "Load calls"}
                </button>
              </div>
              <p className="lede">
                Every conversation on this account — including ones visitors started from shared links. Open a call for its full transcript, what the PAL saw (perception analysis), and the raw event data. Pulled live from Tavus, so it's always complete.
              </p>
              {callsError && <p className="field-hint" style={{ color: "var(--danger)", maxWidth: 560, marginTop: -6, marginBottom: 14 }}>{callsError}</p>}

              <div className="skill-head">
                <div className="subhead" style={{ margin: 0 }}>Shared-demo dashboard</div>
                <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => fetchDemoStats()} disabled={demoStatsLoading}>
                  {demoStatsLoading ? "Loading…" : demoStats ? "Refresh" : "Load dashboard"}
                </button>
              </div>
              {demoStats === null && !demoDetail && (
                <p className="field-hint" style={{ maxWidth: 560 }}>Stats per shared link: total starts, activity by day, and each visitor conversation (click through to its transcript).</p>
              )}
              {demoDetail ? (
                <div style={{ maxWidth: 640, marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => setDemoDetail(null)}>← All demos</button>
                    <span className="mono" style={{ fontSize: 12.5 }}>/d/{demoDetail.slug}</span>
                    <span className="field-hint" style={{ margin: 0 }}>{demoDetail.launches} start{demoDetail.launches === 1 ? "" : "s"} total</span>
                  </div>
                  <div className="stat-bars" title="Starts per day, last 14 days">
                    {demoDetail.days.map((d) => {
                      const max = Math.max(...demoDetail.days.map((x) => x.count), 1);
                      return (
                        <div key={d.date} className="stat-col" title={`${d.date}: ${d.count}`}>
                          <div className="stat-bar" style={{ height: `${Math.max(3, (d.count / max) * 44)}px`, opacity: d.count ? 1 : 0.25 }} />
                          <span className="stat-day">{d.date.slice(8)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="subhead" style={{ marginTop: 14 }}>Visitor conversations ({demoDetail.convos.length})</div>
                  {demoDetail.convos.length === 0 && <p className="field-hint">None yet — share the link!</p>}
                  <div className="kb-list">
                    {demoDetail.convos.map((c) => (
                      <div key={c.id} className="kb-row">
                        <span className="mono" style={{ flex: 1, fontSize: 12 }}>{c.id}</span>
                        {expMap[c.id]?.email && <span title={`Visitor: ${expMap[c.id].email}`} style={{ flexShrink: 0 }}>👤</span>}
                        {expMap[c.id]?.rating > 0 && <span title={`Rated ${expMap[c.id].rating}/5`} style={{ flexShrink: 0, color: "#F3B93F" }}>★{expMap[c.id].rating}</span>}
                        {recMap[c.id]?.uri && <span title={`Recorded: ${recMap[c.id].uri}`} style={{ flexShrink: 0 }}>⏺</span>}
                        <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{(c.at || "").slice(0, 16).replace("T", " ")}</span>
                        <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => openCall(c.id)} disabled={callDetailLoading}>
                          Transcript
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : demoStats && (
                demoStats.length === 0
                  ? <p className="field-hint" style={{ marginBottom: 20 }}>No shared links yet — create one on the Launch step.</p>
                  : (
                    <div className="kb-list" style={{ marginBottom: 24 }}>
                      {demoStats.map((d) => (
                        <div key={d.slug} className="kb-row">
                          <span style={{ flex: 1, fontSize: 13 }}>{d.name || d.slug}</span>
                          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>/d/{d.slug}</span>
                          <span className="kb-status" title="Total starts">{d.launches} ▶</span>
                          <span style={{ color: "var(--muted)", fontSize: 11.5, flexShrink: 0 }} title="Last activity">
                            {d.last ? d.last.slice(0, 16).replace("T", " ") : "—"}
                          </span>
                          <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => fetchDemoStats(d.slug)} disabled={demoStatsLoading}>
                            Stats
                          </button>
                        </div>
                      ))}
                    </div>
                  )
              )}

              {!callDetail && !!callsList?.length && (() => {
                // Recordings as their own category — every call that produced a
                // file in the bucket, no per-call digging.
                const recorded = callsList.filter((c) => recMap[c.conversation_id]?.uri);
                return (
                  <>
                    <div className="subhead">⏺ Recordings ({recorded.length})</div>
                    {recorded.length === 0 ? (
                      <p className="field-hint" style={{ maxWidth: 560, marginBottom: 20 }}>
                        None captured yet. Calls record when S3 recording (Timing step) is on at launch; the file's location lands here a minute or so after each call ends.
                      </p>
                    ) : (
                      <div className="kb-list" style={{ marginBottom: 24 }}>
                        {recorded.map((c) => {
                          const rec = recMap[c.conversation_id];
                          return (
                            <div key={c.conversation_id} className="kb-row">
                              <span style={{ flex: 1, fontSize: 13 }}>
                                {c.conversation_name || <span className="mono" style={{ fontSize: 12 }}>{c.conversation_id}</span>}
                              </span>
                              {rec.duration > 0 && <span style={{ color: "var(--muted)", fontSize: 11.5, flexShrink: 0 }}>{Math.floor(rec.duration / 60)}m {Math.round(rec.duration % 60)}s</span>}
                              <span style={{ color: "var(--muted)", fontSize: 11.5, flexShrink: 0 }}>{(c.created_at || "").slice(0, 16).replace("T", " ")}</span>
                              <a className="pill-btn" style={{ padding: "4px 12px", fontSize: 12, textDecoration: "none" }}
                                href={`/api/recording-url?id=${c.conversation_id}`} target="_blank" rel="noreferrer"
                                title="Downloads the MP4 (15-min signed link — needs the read-only AWS key on the server)">
                                ⭳ Download
                              </a>
                              <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => navigator.clipboard?.writeText(rec.uri).catch(() => {})} title={rec.uri}>
                                Copy path
                              </button>
                              {rec.bucket && (
                                <a className="pill-btn" style={{ padding: "4px 12px", fontSize: 12, textDecoration: "none" }}
                                  href={`https://s3.console.aws.amazon.com/s3/buckets/${encodeURIComponent(rec.bucket)}?prefix=${encodeURIComponent((rec.key || "").replace(/[^/]*$/, ""))}`}
                                  target="_blank" rel="noreferrer">S3 ↗</a>
                              )}
                              <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => openCall(c.conversation_id)} disabled={callDetailLoading}>
                                Transcript
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}

              {!callDetail && !!callsList?.length && (() => {
                // Attendance + feedback from the Experience arc, as its own
                // category — who showed up and what they thought, at a glance.
                const attended = callsList.filter((c) => {
                  const e = expMap[c.conversation_id];
                  return e && (e.email || e.rating || e.comment);
                });
                if (!attended.length) return null;
                return (
                  <>
                    <div className="subhead">👤 Visitors &amp; feedback ({attended.length})</div>
                    <div className="kb-list" style={{ marginBottom: 24 }}>
                      {attended.map((c) => {
                        const e = expMap[c.conversation_id];
                        return (
                          <div key={c.conversation_id} className="kb-row">
                            <span style={{ flex: 1, fontSize: 13 }}>
                              {e.email || <span className="mono" style={{ fontSize: 12 }}>{c.conversation_id}</span>}
                            </span>
                            {e.rating > 0 && <span style={{ color: "#F3B93F", flexShrink: 0 }} title={`Rated ${e.rating}/5`}>{"★".repeat(e.rating)}</span>}
                            {e.comment && (
                              <span style={{ color: "var(--muted)", fontSize: 12, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.comment}>
                                “{e.comment}”
                              </span>
                            )}
                            <span style={{ color: "var(--muted)", fontSize: 11.5, flexShrink: 0 }}>{(c.created_at || "").slice(0, 16).replace("T", " ")}</span>
                            <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => openCall(c.conversation_id)} disabled={callDetailLoading}>
                              Transcript
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              <div className="subhead">All calls on this account{callsList?.length ? ` (${callsList.length})` : ""}</div>

              {callDetail ? (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                    <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setCallDetail(null)}>← All calls</button>
                    <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => downloadTranscript("txt")}
                      disabled={!Array.isArray(callTranscript())} title="Readable speaker-labeled transcript">Transcript .txt</button>
                    <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => downloadTranscript("json")}
                      disabled={!Array.isArray(callTranscript())} title="Structured transcript with roles + timestamps">Transcript .json</button>
                    <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={downloadPerception}
                      disabled={!callPerception().length} title="What the PAL saw & heard (Vision analyses)">Perception .txt</button>
                    <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={downloadCall} title="Everything — every event Tavus recorded">Full data .json</button>
                  </div>
                  <p className="field-hint">
                    <span className="mono">{callDetail.conversation_id}</span> · {callDetail.conversation_name || "unnamed"} · {callDetail.status}
                  </p>
                  {(() => {
                    const events = callDetail.events || [];
                    const tEvent = events.find((e) => /transcription/i.test(e.event_type || ""));
                    const transcript = tEvent?.properties?.transcript;
                    const pEvents = events.filter((e) => /perception/i.test(e.event_type || ""));
                    const rec = recMap[callDetail.conversation_id];
                    const ex = expMap[callDetail.conversation_id];
                    return (
                      <>
                        {ex && (ex.email || ex.rating || ex.comment) && (
                          <>
                            <div className="subhead">Visitor</div>
                            <div className="kb-row" style={{ maxWidth: 640, marginBottom: 14, flexWrap: "wrap" }}>
                              {ex.email && <span className="mono" style={{ fontSize: 12.5 }}>👤 {ex.email}</span>}
                              {ex.rating > 0 && <span style={{ color: "#F3B93F" }} title={`Rated ${ex.rating}/5`}>{"★".repeat(ex.rating)}{"☆".repeat(5 - ex.rating)}</span>}
                              {ex.attendAt && <span style={{ color: "var(--muted)", fontSize: 11.5 }}>joined {ex.attendAt.slice(0, 16).replace("T", " ")}</span>}
                              {Array.isArray(ex.answers) && ex.answers.length > 0 && (
                                <span style={{ flexBasis: "100%", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
                                  {ex.answers.map((qa, qi) => <span key={qi} style={{ display: "block" }}>{qa.q} → <b style={{ color: "var(--text)", fontWeight: 600 }}>{qa.a}</b></span>)}
                                </span>
                              )}
                              {ex.comment && <span style={{ flexBasis: "100%", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>“{ex.comment}”</span>}
                            </div>
                          </>
                        )}
                        <div className="subhead">Recording</div>
                        {rec?.uri && !rec.error ? (
                          <div className="kb-row" style={{ maxWidth: 640, marginBottom: 14 }}>
                            <span className="mono" style={{ flex: 1, fontSize: 12, overflowWrap: "anywhere" }}>{rec.uri}</span>
                            {rec.duration > 0 && <span style={{ color: "var(--muted)", fontSize: 11.5, flexShrink: 0 }}>{Math.round(rec.duration / 60)}m {Math.round(rec.duration % 60)}s</span>}
                            <a className="pill-btn" style={{ padding: "4px 12px", fontSize: 12, flexShrink: 0, textDecoration: "none" }}
                              href={`/api/recording-url?id=${callDetail.conversation_id}`} target="_blank" rel="noreferrer">
                              ⭳ Download
                            </a>
                            <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12, flexShrink: 0 }}
                              onClick={() => navigator.clipboard?.writeText(rec.uri).catch(() => {})}>
                              Copy path
                            </button>
                            {rec.bucket && (
                              <a className="pill-btn" style={{ padding: "4px 12px", fontSize: 12, flexShrink: 0, textDecoration: "none" }}
                                href={`https://s3.console.aws.amazon.com/s3/buckets/${encodeURIComponent(rec.bucket)}?prefix=${encodeURIComponent(rec.key.replace(/[^/]*$/, ""))}`}
                                target="_blank" rel="noreferrer">
                                Open in S3 ↗
                              </a>
                            )}
                          </div>
                        ) : rec?.error ? (
                          <p className="field-hint" style={{ color: "var(--danger)", maxWidth: 560 }}>
                            Recording delivery failed: {rec.error} — usually a trust-policy or region mismatch on the IAM role.
                          </p>
                        ) : (
                          <p className="field-hint">
                            None captured for this call. Recordings appear here when the Timing step's S3 recording is on (the location arrives a minute or so after the call ends; it's a download in S3 — add .mp4 to the filename to play it).
                          </p>
                        )}
                        <div className="subhead">Transcript</div>
                        {Array.isArray(transcript) && transcript.length ? (
                          <div className="transcript">
                            {transcript.filter((m) => m.role !== "system").map((m, i) => (
                              <div key={i} className={`t-row t-${m.role}`}>
                                <span className="t-role">{m.role === "assistant" ? (site.brand || "PAL") : "Visitor"}</span>
                                <span>{typeof m.content === "string" ? m.content : JSON.stringify(m.content)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="field-hint">No transcript yet — it appears shortly after a call ends.</p>
                        )}
                        <div className="subhead">What the PAL saw &amp; heard (perception)</div>
                        {pEvents.length ? pEvents.map((e, i) => (
                          <div key={i} className="perception-card">
                            {typeof e.properties?.analysis === "string" ? e.properties.analysis : JSON.stringify(e.properties, null, 2)}
                          </div>
                        )) : (
                          <p className="field-hint">No perception analysis — enable Vision on the PAL to get end-of-call visual summaries.</p>
                        )}
                        <div className="subhead">All events ({events.length})</div>
                        <p className="field-hint">Everything Tavus recorded for this call — tool calls, guardrail triggers, shutdown reason — is in the JSON download above.</p>
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  {callsList === null && <p className="field-hint">Click "Load calls" to list conversations (needs the API key from Setup).</p>}
                  {callsList?.length === 0 && <p className="field-hint">No conversations yet.</p>}
                  {!!callsList?.length && (() => {
                    // The API key is account-wide (everyone's calls) — scope the
                    // view client-side: text search + only-my-PAL toggle.
                    const palOf = (c) => c.persona_id || c.pal_id || "";
                    const hasPalField = callsList.some((c) => palOf(c));
                    const q = callsFilter.trim().toLowerCase();
                    const matches = callsList.filter((c) => {
                      if (onlyMyPal && palId.trim() && hasPalField && palOf(c) !== palId.trim()) return false;
                      if (!q) return true;
                      return `${c.conversation_name || ""} ${c.conversation_id || ""}`.toLowerCase().includes(q);
                    });
                    const PER_PAGE = 25;
                    const pageCount = Math.max(1, Math.ceil(matches.length / PER_PAGE));
                    const page = Math.min(callsPage, pageCount - 1); // clamp — filters can shrink the list
                    const shown = matches.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
                    return (
                      <>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                          <input style={{ maxWidth: 260 }} value={callsFilter} onChange={(e) => { setCallsFilter(e.target.value); setCallsPage(0); }}
                            placeholder="Filter by demo name or ID…" />
                          {hasPalField && palId.trim() && (
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted)", cursor: "pointer" }}>
                              <input type="checkbox" checked={onlyMyPal} onChange={(e) => { setOnlyMyPal(e.target.checked); setCallsPage(0); }} />
                              only my current PAL ({palId.trim().slice(0, 10)}…)
                            </label>
                          )}
                          {(q || onlyMyPal) && <span className="field-hint" style={{ margin: 0 }}>{matches.length} of {callsList.length}</span>}
                        </div>
                        <div className="kb-list">
                          {shown.map((c) => (
                            <div key={c.conversation_id} className="kb-row">
                              <span style={{ flex: 1, fontSize: 13 }}>
                                {c.conversation_name || <span className="mono" style={{ fontSize: 12 }}>{c.conversation_id}</span>}
                              </span>
                              {expMap[c.conversation_id]?.email && <span title={`Visitor: ${expMap[c.conversation_id].email}`} style={{ flexShrink: 0 }}>👤</span>}
                              {expMap[c.conversation_id]?.rating > 0 && <span title={`Rated ${expMap[c.conversation_id].rating}/5`} style={{ flexShrink: 0, color: "#F3B93F" }}>★{expMap[c.conversation_id].rating}</span>}
                              {recMap[c.conversation_id]?.uri && <span title={`Recorded: ${recMap[c.conversation_id].uri}`} style={{ flexShrink: 0 }}>⏺</span>}
                              <span className={`kb-status ${c.status === "ended" ? "" : "kb-ready"}`}>{c.status}</span>
                              <span style={{ color: "var(--muted)", fontSize: 11.5, flexShrink: 0 }}>{(c.created_at || "").slice(0, 16).replace("T", " ")}</span>
                              <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => openCall(c.conversation_id)} disabled={callDetailLoading}>
                                {callDetailLoading ? "…" : "View"}
                              </button>
                            </div>
                          ))}
                          {!shown.length && <p className="field-hint">Nothing matches this filter.</p>}
                        </div>
                        {pageCount > 1 && (() => {
                          // Numbered pager: all pages when few; first/last plus a
                          // window around the current page (with gaps) when many.
                          const nums = [];
                          for (let i = 0; i < pageCount; i++) {
                            if (pageCount <= 9 || i === 0 || i === pageCount - 1 || Math.abs(i - page) <= 2) nums.push(i);
                            else if (nums[nums.length - 1] !== "gap") nums.push("gap");
                          }
                          return (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                              <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12 }} disabled={page === 0}
                                onClick={() => setCallsPage(page - 1)}>←</button>
                              {nums.map((n, i) => n === "gap"
                                ? <span key={`g${i}`} style={{ color: "var(--muted)", fontSize: 12 }}>…</span>
                                : (
                                  <button key={n} className={"pill-btn" + (n === page ? " primary" : "")}
                                    style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => setCallsPage(n)}>
                                    {n + 1}
                                  </button>
                                ))}
                              <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12 }} disabled={page >= pageCount - 1}
                                onClick={() => setCallsPage(page + 1)}>→</button>
                              <span className="field-hint" style={{ margin: "0 0 0 6px" }}>{matches.length} calls</span>
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {step === "controls" && (
            <>
              <h1>Timing</h1>
              <p className="lede">
                How long the conversation runs and what the AI says as time runs out — plus a wake phrase for kiosks and a nudge for quiet visitors.
              </p>

              <div className="subhead">Conversation length</div>
              <Field label="Time limit (minutes)" hint="Blank = Tavus default (60). The call shuts down automatically when time is up.">
                <input type="number" min="1" max="60" style={{ maxWidth: 140 }} value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value)} placeholder="e.g. 10" />
              </Field>
              <Field label="Two-minutes-left announcement" hint="Spoken word-for-word when 2 minutes remain. Leave blank to skip. Needs a time limit of 3+ minutes.">
                <textarea value={timeWarning} onChange={(e) => setTimeWarning(e.target.value)}
                  placeholder="Just a heads up — we have about two minutes left. Is there anything else you'd like to cover?" />
              </Field>

              <div className="subhead">Quiet-visitor nudge</div>
              <Field label="Nudge after (seconds of silence)" hint="Blank = off. If nobody speaks for this long, the PAL says the reminder below — and if the silence continues another 10 seconds, the call closes.">
                <input type="number" min="10" max="600" style={{ maxWidth: 140 }} value={inactivitySeconds} onChange={(e) => setInactivitySeconds(e.target.value)} placeholder="e.g. 45" />
              </Field>
              <Field label="Reminder line" hint="Spoken word-for-word at the nudge.">
                <textarea value={inactivityUtterance} onChange={(e) => setInactivityUtterance(e.target.value)}
                  placeholder="Still there? I'll close our conversation in about ten seconds unless you'd like to keep going." />
              </Field>

              <div className="subhead">Wake phrase</div>
              <Field label="" hint="The AI greets once, then stays quiet until someone says this phrase — great for kiosks where people chat nearby. It's guidance (steers the AI), not a hard mute.">
                <input style={{ maxWidth: 320 }} value={wakePhrase} onChange={(e) => setWakePhrase(e.target.value)} placeholder='e.g. "Hey Ava"' />
              </Field>

              <div className="subhead">Recording → your S3 bucket</div>
              <div className="skill-head" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>⏺ Record every call to S3</span>
                <Toggle on={recordingEnabled} onChange={setRecordingEnabled} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: recordingEnabled ? 14 : 18 }}>
                Tavus uploads the finished recording straight into your bucket — including calls started from shared demo links.
                Files land at <span className="mono">tavus/&lt;conversation_id&gt;/&lt;timestamp&gt;</span>, and each call's recording
                location shows up in <b>Results</b> next to its transcript a minute or so after the call ends.
                One-time AWS setup: create the bucket and an IAM role Tavus can assume (a trust policy — no AWS keys ever go in here, only names).
                The details below are remembered on this browser — fill them in once and every new demo records by default.
              </p>
              {recordingEnabled && (
                <>
                  <Field label="S3 bucket name" hint="Just the bucket name, no s3:// prefix.">
                    <input className="mono" style={{ maxWidth: 360 }} value={recS3Bucket} onChange={(e) => setRecS3Bucket(e.target.value)} placeholder="acme-demo-recordings" />
                  </Field>
                  <Field label="Bucket region">
                    <input className="mono" style={{ maxWidth: 220 }} value={recS3Region} onChange={(e) => setRecS3Region(e.target.value)} placeholder="us-east-1" />
                  </Field>
                  <Field label="IAM role ARN" hint="The role in your AWS account that trusts Tavus. Tavus assumes it to write the file — nothing else.">
                    <input className="mono" value={recS3RoleArn} onChange={(e) => setRecS3RoleArn(e.target.value)} placeholder="arn:aws:iam::123456789012:role/tavus-recording-writer" />
                  </Field>
                  <Field label="External ID (optional)" hint="Only if your role's trust policy requires one.">
                    <input className="mono" style={{ maxWidth: 360 }} value={recS3ExternalId} onChange={(e) => setRecS3ExternalId(e.target.value)} placeholder="leave blank unless your security team set one" />
                  </Field>
                  <Field label="What gets recorded" hint='Everyone = AI human and all humans side by side, constantly (no speaker switching). Full stage = the entire call screen — canvas cards included — via a one-click "share this tab" prompt when you press the ⏺ button on the call (your launches only; visitor calls fall back to Everyone). Speaker focus = talker fills the frame. AI human only = the old behavior.'>
                    <div className="seg">
                      {[["everyone", "Everyone"], ["stage", "Full stage + canvas"], ["speaker", "Speaker focus"], ["pal", "AI human only"]].map(([v, label]) => (
                        <button key={v} className={recLayout === v ? "on" : ""} onClick={() => setRecLayout(v)}>{label}</button>
                      ))}
                    </div>
                  </Field>
                  {!(recS3Bucket.trim() && recS3Region.trim() && recS3RoleArn.trim()) && (
                    <p className="field-hint" style={{ color: "var(--danger)", maxWidth: 560 }}>
                      Recording stays off until bucket, region, and role ARN are all filled in.
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {step === "site" && (
            <>
              <h1>Page &amp; Brand</h1>
              <p className="lede">The launched conversation opens on a clean, branded page — the conversation stage front and center. Canvas cards and presentation slides appear inside the stage automatically.</p>

              <Field label="Match their website" hint="Paste the company's site and Claude restyles this page to their brand — colors, name, headline, logo. Everything stays editable below.">
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="mono" value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)} placeholder="https://acme.com"
                    onKeyDown={(e) => e.key === "Enter" && !theming && themeFromUrl()} />
                  <button className="pill-btn primary" style={{ flexShrink: 0 }} onClick={themeFromUrl} disabled={theming || !brandUrl.trim()}>
                    {theming ? "Theming…" : "Theme it"}
                  </button>
                </div>
                {site.theme && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    {["canvas", "surface", "accent", "text"].map((k) => site.theme[k] && (
                      <span key={k} title={`${k}: ${site.theme[k]}`} style={{ width: 16, height: 16, borderRadius: 5, background: site.theme[k], border: "1px solid var(--border)" }} />
                    ))}
                    <button className="pill-btn" style={{ padding: "3px 10px", fontSize: 11, marginLeft: 4 }} onClick={() => setSiteField("theme", null)}>Reset to Alto</button>
                  </span>
                )}
              </Field>

              <Field label="Brand name">
                <input value={site.brand} onChange={(e) => setSiteField("brand", e.target.value)} placeholder="Acme Health" />
              </Field>
              <Field label="Logo" hint="Upload an image (stored with the config — no hosting needed). Falls back to a monogram when empty.">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button className="pill-btn" onClick={() => logoFileRef.current?.click()}>Upload logo…</button>
                  {site.logoUrl && (
                    <>
                      <img src={site.logoUrl} alt="logo preview" style={{ height: 30, borderRadius: 7, objectFit: "contain", border: "1px solid var(--border)", background: "#fff", padding: 2 }} />
                      <button className="pill-btn" style={{ padding: "6px 12px", fontSize: 12, color: "var(--danger)" }} onClick={() => setSiteField("logoUrl", "")}>Remove</button>
                    </>
                  )}
                  <input ref={logoFileRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoFile(f); e.target.value = ""; }} />
                </div>
              </Field>
              <Field label="Headline">
                <input value={site.headline} onChange={(e) => setSiteField("headline", e.target.value)} placeholder="Meet your AI onboarding specialist" />
              </Field>
              <Field label="Tagline" hint="One supporting sentence under the headline. Leave blank for a stage-only page.">
                <input value={site.tagline} onChange={(e) => setSiteField("tagline", e.target.value)} placeholder="Ask anything about the platform — live, face to face." />
              </Field>
              <Field label="Button label">
                <input value={site.cta} onChange={(e) => setSiteField("cta", e.target.value)} />
              </Field>

              <div className="subhead">Format</div>
              <div className="placement-row" style={{ marginBottom: 18 }}>
                {SITE_FORMATS.map((f) => (
                  <div key={f.v} className={"placement-card" + ((site.format || "desktop") === f.v ? " on" : "")} onClick={() => setSiteField("format", f.v)}>
                    <div className="format-viz">
                      {f.v === "desktop" && <div className="fv-desktop" />}
                      {f.v === "phone" && <div className="fv-phone" />}
                      {f.v === "kiosk" && <div className="fv-kiosk" />}
                      {f.v === "hologram" && <div className="fv-holo" />}
                    </div>
                    <div style={{ fontWeight: 600 }}>{f.label}</div>
                    <div style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.4 }}>{f.desc}</div>
                  </div>
                ))}
              </div>

              <div className="subhead">In-call controls</div>
              <div className="skill-head" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>✋ Interrupt button</span>
                <Toggle on={interruptButton} onChange={setInterruptButton} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 18 }}>
                Adds a button to the call that instantly stops the AI mid-sentence — handy when it's mid-monologue and you want the floor.
              </p>

              <button className="pill-btn" onClick={() => setSiteMode(true)}>Preview the page</button>
            </>
          )}

          {step === "experience" && (
            <>
              <h1>Experience</h1>
              <p className="lede">
                Turn the demo page into a full product journey — guided steps you compose before the call
                (a waiver question, a persona picker, a video…), an email gate, and a feedback screen after.
                Everything rides shared links, and the visitor's answers shape the conversation and land in Results.
              </p>

              <div className="subhead">Guided journey (before the call)</div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 12 }}>
                Compose the steps a visitor walks through before the conversation starts. Their choices and answers
                are woven into the call — the AI knows them from its first words — and stored with the call in Results.
              </p>
              {expJourney.length > 0 && (
                <div className="jr-list">
                  {expJourney.map((s, i) => (
                    <div key={i} className="jr-card">
                      <div className="jr-head">
                        <span className="jr-num">{i + 1}</span>
                        <span className="jr-type">
                          {s.type === "info" ? "📄 info screen" : s.type === "video" ? "🎬 video" : s.type === "question" ? "☑️ question" : s.type === "input" ? "✏️ free text" : "🎭 persona picker"}
                        </span>
                        <span className="jr-btns">
                          <button className="kb-move" onClick={() => moveJourneyStep(i, -1)} disabled={i === 0} title="Move up">↑</button>
                          <button className="kb-move" onClick={() => moveJourneyStep(i, 1)} disabled={i === expJourney.length - 1} title="Move down">↓</button>
                          <button className="kb-del" onClick={() => removeJourneyStep(i)} title="Remove step">✕</button>
                        </span>
                      </div>
                      {s.type === "info" && (
                        <>
                          <input value={s.title || ""} onChange={(e) => patchJourneyStep(i, { title: e.target.value })} placeholder="Title — e.g. Welcome to your assessment" />
                          <textarea value={s.body || ""} onChange={(e) => patchJourneyStep(i, { body: e.target.value })} placeholder="A short paragraph the visitor reads before continuing." />
                        </>
                      )}
                      {s.type === "video" && (
                        <>
                          <input value={s.title || ""} onChange={(e) => patchJourneyStep(i, { title: e.target.value })} placeholder="Title — e.g. Watch this 60-second intro" />
                          <input className="mono" value={s.url || ""} onChange={(e) => patchJourneyStep(i, { url: e.target.value })} placeholder="Video URL — YouTube, Loom, or a direct .mp4 link" />
                        </>
                      )}
                      {s.type === "question" && (
                        <>
                          <input value={s.prompt || ""} onChange={(e) => patchJourneyStep(i, { prompt: e.target.value })} placeholder="Question — e.g. Have you filled out the waiver form?" />
                          <textarea value={s.optionsText || ""} onChange={(e) => patchJourneyStep(i, { optionsText: e.target.value })} placeholder={"One answer per line (2–6):\nYes, it's done\nNot yet"} />
                          <p className="field-hint" style={{ margin: 0 }}>The visitor's pick is fed to the AI as context and stored with the call.</p>
                        </>
                      )}
                      {s.type === "input" && (
                        <>
                          <input value={s.prompt || ""} onChange={(e) => patchJourneyStep(i, { prompt: e.target.value })} placeholder="Prompt — e.g. What's your first name?" />
                          <input value={s.placeholder || ""} onChange={(e) => patchJourneyStep(i, { placeholder: e.target.value })} placeholder="Placeholder text (optional)" />
                          <p className="field-hint" style={{ margin: 0 }}>Free text — great for names or specifics the AI should personalize around.</p>
                        </>
                      )}
                      {s.type === "personas" && (
                        <>
                          <input value={s.prompt || ""} onChange={(e) => patchJourneyStep(i, { prompt: e.target.value })} placeholder="Prompt — e.g. Who would you like to talk to?" />
                          {(s.options || []).map((o, oi) => (
                            <div key={oi} className="jr-opt">
                              <div style={{ display: "flex", gap: 6 }}>
                                <input value={o.label || ""} onChange={(e) => patchPersonaOption(i, oi, { label: e.target.value })} placeholder={`Option ${oi + 1} — e.g. Better Santa`} />
                                <button className="kb-del" onClick={() => patchJourneyStep(i, { options: s.options.filter((_, y) => y !== oi) })} disabled={(s.options || []).length <= 2} title="Remove option">✕</button>
                              </div>
                              <input value={o.desc || ""} onChange={(e) => patchPersonaOption(i, oi, { desc: e.target.value })} placeholder="One-line description the visitor sees" />
                              <textarea value={o.context || ""} onChange={(e) => patchPersonaOption(i, oi, { context: e.target.value })} placeholder="What changes when they pick this — instructions woven into the conversation." style={{ minHeight: 54 }} />
                              <div style={{ display: "flex", gap: 6 }}>
                                <input value={o.greeting || ""} onChange={(e) => patchPersonaOption(i, oi, { greeting: e.target.value })} placeholder="Custom opening line (optional)" />
                                <input className="mono" style={{ maxWidth: 170 }} value={o.palId || ""} onChange={(e) => patchPersonaOption(i, oi, { palId: e.target.value })} placeholder="PAL ID override (opt.)" title="Advanced: this option talks to a different PAL entirely" />
                              </div>
                            </div>
                          ))}
                          {(s.options || []).length < 4 && (
                            <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => patchJourneyStep(i, { options: [...(s.options || []), { label: "", desc: "", context: "" }] })}>
                              + Option
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                <button className="pill-btn" onClick={() => addJourneyStep("info")}>+ Info screen</button>
                <button className="pill-btn" onClick={() => addJourneyStep("video")}>+ Video</button>
                <button className="pill-btn" onClick={() => addJourneyStep("question")}>+ Question</button>
                <button className="pill-btn" onClick={() => addJourneyStep("input")}>+ Free text</button>
                <button className="pill-btn" onClick={() => addJourneyStep("personas")}>+ Persona picker</button>
              </div>

              <div className="subhead">Before the call</div>
              <div className="skill-head" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>📧 Email gate</span>
                <Toggle on={expEmailGate} onChange={setExpEmailGate} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 14 }}>
                Visitors enter their email before the conversation unlocks — so you always know who attended.
                It's stored with the call (see Results) and rides along on the attendance alert below.
              </p>
              {expEmailGate && (
                <>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", cursor: "pointer", marginBottom: 14 }}>
                    <input type="checkbox" style={{ width: "auto" }} checked={expEmailRequired} onChange={(e) => setExpEmailRequired(e.target.checked)} />
                    Required (unchecked adds a Skip link)
                  </label>
                  <Field label="Gate prompt" hint="The line above the email field. Leave blank for the default.">
                    <input value={expEmailPrompt} onChange={(e) => setExpEmailPrompt(e.target.value)} placeholder="Where can we reach you? The team likes to know who they're talking to." />
                  </Field>
                </>
              )}
              <Field label="Attendance alert webhook" hint="Optional. The moment a visitor starts a call on a shared link, this URL gets a POST with {type:'demo.attend', email, demo, conversation_id} — point it at a Zapier/Make catch hook for a Slack ping or email. Fires for visitor calls only (never your own previews), with or without the gate.">
                <input className="mono" value={expNotifyWebhook} onChange={(e) => setExpNotifyWebhook(e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/…" />
              </Field>

              <div className="subhead">After the call</div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 14 }}>
                With any of these on, ending the call lands on a thank-you screen instead of snapping back to the landing page.
              </p>
              <div className="skill-head" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>⭐ Rating &amp; comment</span>
                <Toggle on={expRating} onChange={setExpRating} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 14 }}>
                1–5 stars plus an optional comment — lands next to the call in Results.
              </p>
              <div className="skill-head" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>📅 Book a meeting</span>
                <Toggle on={expBooking} onChange={setExpBooking} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: expBooking && !schedulingUrl.trim() ? 8 : 14 }}>
                The conversion CTA — opens your scheduling link in a new tab.
              </p>
              {expBooking && (
                <Field label="Scheduling link" hint="Shared with the Magic Canvas scheduling card — set once, used by both.">
                  <input className="mono" value={schedulingUrl} onChange={(e) => setSchedulingUrl(e.target.value)} placeholder="https://calendly.com/you/30min" />
                </Field>
              )}
              <div className="skill-head" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>🔁 Talk again</span>
                <Toggle on={expTalkAgain} onChange={setExpTalkAgain} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 14 }}>
                One click starts a fresh conversation from the thank-you screen.
              </p>
              <Field label="Thank-you message" hint="Headline of the post-call screen.">
                <input value={expThanks} onChange={(e) => setExpThanks(e.target.value)} placeholder="Thanks for the conversation!" />
              </Field>

              <button className="pill-btn" onClick={() => setSiteMode(true)}>Preview the page</button>
            </>
          )}

          {step === "studio" && (
            <>
              <h1>Studio</h1>
              <p className="lede">
                Record real MP4 feature demos with nobody on the visitor side. Script what the "visitor" says;
                <b> Record take</b> opens the demo page, speaks your lines with TTS and natural turn-taking, and
                captures the <b>full stage</b> — Magic Canvas cards, presentation slides, and the AI human exactly
                as rendered — to your S3 bucket. The take ends itself and shows up in Results with a ⏺ badge.
              </p>

              <div className="subhead">Ready check</div>
              <div className="kb-list" style={{ marginBottom: 18 }}>
                <div className="kb-row">
                  <span style={{ flex: 1, fontSize: 13 }}>Demo ready (key + Face + PAL)</span>
                  <span className={"kb-status " + (canLaunch ? "kb-ready" : "kb-error")}>{canLaunch ? "ready" : "missing — Account step"}</span>
                </div>
                <div className="kb-row">
                  <span style={{ flex: 1, fontSize: 13 }}>S3 recording (captures the take)</span>
                  <span className={"kb-status " + (recordingEnabled && recS3Bucket.trim() && recS3Region.trim() && recS3RoleArn.trim() ? "kb-ready" : "kb-error")}>
                    {recordingEnabled && recS3Bucket.trim() && recS3Region.trim() && recS3RoleArn.trim() ? "configured" : "set up on Timing"}
                  </span>
                </div>
                <div className="kb-row">
                  <span style={{ flex: 1, fontSize: 13 }}>TTS visitor voice</span>
                  <span className={"kb-status " + (ttsAvail?.available ? "kb-ready" : ttsAvail === null ? "" : "kb-error")}>
                    {ttsAvail === null ? "checking…" : ttsAvail?.available ? `Cartesia ready (${ttsAvail.voice})` : "add CARTESIA_API_KEY on Vercel"}
                  </span>
                </div>
              </div>

              <div className="subhead">The visitor's lines</div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 10 }}>
                In order. The take waits for the AI human to finish each reply before speaking the next line —
                lines that exercise the feature you're demoing (say "pricing" to fire a scripted card,
                push a guardrail, ask for the deck…). Write them, or let Claude script them from this demo's config.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, maxWidth: 640 }}>
                <input style={{ flex: "1 1 280px" }} value={scriptFocus} onChange={(e) => setScriptFocus(e.target.value)}
                  placeholder='Focus (optional) — e.g. "show off the canvas cards and walk the deck"' />
                <button className="pill-btn primary" onClick={generateStudioScript} disabled={scriptBusy}>
                  {scriptBusy ? "Writing…" : "✨ Write the script for me"}
                </button>
              </div>
              <div className="kb-list" style={{ marginBottom: 10 }}>
                {studioLines.map((l, i) => (
                  <div key={i} className="kb-row">
                    <span className="jr-num" style={{ flexShrink: 0 }}>{i + 1}</span>
                    <input style={{ flex: 1 }} value={l.text} placeholder={i === 0 ? `e.g. Hi! Can you walk me through how this works?` : "…then the visitor says"}
                      onChange={(e) => setStudioLines((ls) => ls.map((x, j) => (j === i ? { text: e.target.value } : x)))} />
                    <button className="kb-move" onClick={() => setStudioLines((ls) => { if (!ls[i - 1]) return ls; const n = [...ls]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} disabled={i === 0} title="Move up">↑</button>
                    <button className="kb-move" onClick={() => setStudioLines((ls) => { if (!ls[i + 1]) return ls; const n = [...ls]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} disabled={i === studioLines.length - 1} title="Move down">↓</button>
                    <button className="kb-del" onClick={() => setStudioLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} disabled={studioLines.length <= 1} title="Remove line">✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                <button className="pill-btn" onClick={() => setStudioLines((ls) => (ls.length >= 12 ? ls : [...ls, { text: "" }]))}>+ Line</button>
              </div>

              <div className="subhead">Scripted cards for this take</div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 8 }}>
                Describe the cards you want and Claude designs them from this demo's config — chart, stat, note, image,
                or a clickable multiple-choice question. They land on the Magic Canvas step (editable, with live previews)
                and the forecast below updates instantly.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, maxWidth: 640 }}>
                <input style={{ flex: "1 1 280px" }} value={cardsPrompt} onChange={(e) => setCardsPrompt(e.target.value)}
                  placeholder='e.g. "a pricing chart when tiers come up, and a which-package question at the end"' />
                <button className="pill-btn primary" onClick={generateScriptedCards} disabled={cardsBusy}>
                  {cardsBusy ? "Designing…" : "✨ Generate cards"}
                </button>
              </div>

              <div className="subhead">What will be on camera</div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 8 }}>
                Recomputed live from this demo's config and the script above — fix every ⚠️ before recording, or the take won't show it.
              </p>
              <div className="kb-list" style={{ marginBottom: 16, maxWidth: 660 }}>
                {takeForecast.map((r, i) => (
                  <div key={i} className="kb-row" style={{ alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0 }}>{r.k === "ok" ? "✅" : r.k === "warn" ? "⚠️" : "🎲"}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0, minWidth: 150 }}>{r.label}</span>
                    <span style={{ fontSize: 12.5, color: r.k === "warn" ? "var(--danger)" : "var(--muted)", flex: 1, lineHeight: 1.5 }}>{r.detail}</span>
                  </div>
                ))}
              </div>

              <button className="pill-btn primary" onClick={startStudioTake} disabled={studioActive || !!duetRun}>
                {studioActive ? "Take running…" : "🎬 Record take"}
              </button>
              {studioStatus && <p className="field-hint" style={{ marginTop: 10, maxWidth: 560 }}>{studioStatus}</p>}
              <p className="field-hint" style={{ marginTop: 14, maxWidth: 560 }}>
                Chrome pre-selects this tab in the share dialog — keep the tab visible for the whole take.
                Each take is a normal conversation (normal minutes); re-rolling is one click. Lines save with the
                demo, so a scenario doubles as a repeatable video script. End a take early with the call's leave button.
              </p>

              <div className="subhead" style={{ marginTop: 30 }}>Duet — two AI humans in conversation</div>
              <p className="field-hint" style={{ maxWidth: 600, marginBottom: 12 }}>
                Your demo's AI human (Account step) gets interviewed on camera by a partner — each replies to what
                the other actually said, turn by turn. Both faces render side by side and the whole stage records
                locally (a .webm downloads when it ends). No microphones involved, so there's nothing to feed back.
              </p>
              <Field label="Conversation partner" hint="Two customer-facing personas just run their agendas at each other — the auto interviewer exists purely to make YOUR AI human shine.">
                <div className="seg">
                  <button className={duetMode === "auto" ? "on" : ""} onClick={() => setDuetMode("auto")}>Auto interviewer (recommended)</button>
                  <button className={duetMode === "custom" ? "on" : ""} onClick={() => setDuetMode("custom")}>Custom PAL</button>
                </div>
              </Field>
              {duetMode === "custom" && (
                <Field label="Partner PAL ID" hint="Any PAL — but give it an interviewer-ish prompt or the opening won't make sense.">
                  <input className="mono" value={duetPalB} onChange={(e) => setDuetPalB(e.target.value)} placeholder="p…" />
                </Field>
              )}
              <Field label="Partner face" hint={duetMode === "auto"
                ? `Pick a preset or paste any r… face ID.${duetPartnerId ? ` Interviewer PAL cached: ${duetPartnerId}` : " The interviewer PAL is created once on first run, then reused."}`
                : "Pick a preset or paste any r… face ID."}>
                <div className="face-row">
                  {FACE_PRESETS.map((f) => (
                    <button key={f.id} type="button" className={"face-chip" + (duetFaceB.trim() === f.id ? " on" : "")} onClick={() => setDuetFaceB(f.id)} title={f.id}>
                      <span className="face-chip-name">{f.name}</span>
                      <span className="face-chip-vibe">{f.vibe}</span>
                    </button>
                  ))}
                </div>
                <input className="mono" value={duetFaceB} onChange={(e) => setDuetFaceB(e.target.value)} placeholder="r…" />
              </Field>
              <Field label="Your AI human's opening line" hint="YOUR avatar starts the conversation with this; the partner joins right after and reacts. Blank = its natural greeting.">
                <input value={duetOpener} onChange={(e) => setDuetOpener(e.target.value)} placeholder="Ho ho ho! I'm Santa — well, the better Santa. Ask me anything!" />
              </Field>
              <Field label="Topic seed" hint="Optional. Woven into both sides' context so the conversation stays on subject.">
                <input value={duetTopic} onChange={(e) => setDuetTopic(e.target.value)} placeholder="comparing the tier-1 and Better Santa experiences for a retail client" />
              </Field>
              <Field label="Exchanges" hint="How many back-and-forths before it wraps and saves (hard cap 5 minutes).">
                <input type="number" min="2" max="20" style={{ maxWidth: 120 }} value={duetTurns} onChange={(e) => setDuetTurns(e.target.value)} />
              </Field>
              <div className="kb-list" style={{ margin: "4px 0 14px", maxWidth: 660 }}>
                <div className="kb-row" style={{ alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0 }}>{presentationEnabled && docIds.length ? (slidesTrigger === "walk_the_deck" ? "✅" : "🎲") : "⚠️"}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0, minWidth: 150 }}>🖥 Deck in this duet</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, lineHeight: 1.5 }}>
                    {presentationEnabled && docIds.length
                      ? slidesTrigger === "walk_the_deck"
                        ? "walk-the-deck — your AI human will present, and slides render big with its face as a corner tile."
                        : "on-demand — appears only if a speaker asks for it; put “ask them to walk through their deck” in the topic seed to steer the partner."
                      : "no deck attached (Presentation step) — this duet records faces and voices only."}
                  </span>
                </div>
                {compiledScriptedCards.map((c, i) => {
                  const icon = c.style === "chart" ? "📊" : c.style === "stat" ? "🔢" : c.style === "image" ? "🖼" : c.style === "question" ? "❓" : "📄";
                  const seeded = `${duetOpener} ${duetTopic}`.toLowerCase();
                  const kws = c.keywords.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
                  const seededHit = kws.find((k) => seeded.includes(k));
                  const [mark, detail] =
                    c.trigger === "start" ? ["✅", "appears when the duet starts — guaranteed."]
                    : c.trigger === "time" ? ["✅", `appears ${Math.floor(c.atSeconds / 60)}:${String(c.atSeconds % 60).padStart(2, "0")} in — guaranteed.`]
                    : seededHit ? ["✅", `your opening line/topic says “${seededHit}” — fires as soon as it's spoken.`]
                    : ["🎲", `fires when either AI says ${kws.map((k) => `“${k}”`).join(" / ")} — put a trigger word in the opening line or topic seed to make it certain.`];
                  return (
                    <div key={i} className="kb-row" style={{ alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0 }}>{mark}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0, minWidth: 150 }}>{icon} {c.title || `${c.style} card`}</span>
                      <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, lineHeight: 1.5 }}>{detail}</span>
                    </div>
                  );
                })}
                <div className="kb-row" style={{ alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0 }}>⚠️</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0, minWidth: 150 }}>🪄 Magic Canvas</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, lineHeight: 1.5 }}>
                    Tavus-rendered canvas cards never appear in duets — scripted cards (above) do, overlaid center-stage.
                  </span>
                </div>
              </div>
              <button className="pill-btn primary" onClick={startDuet} disabled={!!duetRun || studioActive}>
                {duetRun ? "Duet running…" : "🎭 Record duet"}
              </button>
            </>
          )}

          {step === "launch" && (
            <>
              <h1>Launch &amp; Share</h1>
              <p className="lede">
                On launch: {[
                  objectivesEnabled && objectivesPayload.data.length && "creates & attaches objectives",
                  guardrailsEnabled && guardrailsParsed.length && "creates & attaches guardrails",
                  visionEnabled && (visionPayload.visual_awareness_queries || visionPayload.audio_awareness_queries) && "attaches Vision",
                  speechEnabled && pronunciationRules.length && "creates & attaches pronunciation",
                  knowledgeIds.length && `gives the PAL ${knowledgeIds.length} knowledge doc${knowledgeIds.length > 1 ? "s" : ""}`,
                  toolsEnabled && toolDefs.length && `attaches ${toolDefs.length} custom tool${toolDefs.length > 1 ? "s" : ""}`,
                  presentationEnabled && "attaches Presentation",
                  canvasEnabled && "attaches Magic Canvas",
                ].filter(Boolean).join(", ") || "no customizations selected"}, then creates the conversation and opens it on your demo page.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="pill-btn primary big" disabled={!canLaunch || busy} onClick={launch}>
                  {busy ? "Working…" : "Launch demo"}
                </button>
                <button className="pill-btn" disabled={!canLaunch || busy || preflighting} onClick={preflight}
                  title="Validates the whole config with Tavus — goals chain, IDs, recording storage — without starting a call. Free.">
                  {preflighting ? "Checking…" : "✓ Preflight check"}
                </button>
                {conversation?.conversation_url && (
                  <button className="pill-btn" onClick={() => setSiteMode(true)}>Reopen page</button>
                )}
              </div>
              {!canLaunch && <p className="field-hint" style={{ marginTop: 10 }}>Complete Setup first — API key, Face ID, and PAL ID are required.</p>}
              <div className="subhead" style={{ marginTop: 26 }}>Shareable demo link</div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 10 }}>
                Mints a permanent link (like {window.location.origin}/d/x7Kp2q) anyone can open — no login, no keys. Each visitor gets their own fresh conversation. <b>Launch once first</b> so objectives, guardrails, vision, and skills are attached to the PAL; the link snapshots the demo as it is now (edit → share again for a new link).
              </p>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button className="pill-btn" onClick={shareDemo} disabled={sharing || !palId.trim() || !faceId.trim()}>
                  {sharing ? "Creating…" : shareUrl ? "Create a new link" : "Create shareable link"}
                </button>
                {shareUrl && (
                  <>
                    <span className="mono" style={{ fontSize: 12.5 }}>{shareUrl}</span>
                    <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => copy(shareUrl, "share")}>
                      {copied === "share" ? "Copied" : "Copy"}
                    </button>
                    <a className="pill-btn" style={{ padding: "5px 12px", fontSize: 12, textDecoration: "none" }} href={shareUrl} target="_blank" rel="noreferrer">Open</a>
                  </>
                )}
              </div>

              {conversation?.conversation_url && (
                <p className="field-hint" style={{ marginTop: 12 }}>
                  Room link:{" "}
                  <span className="mono" style={{ color: "var(--text)" }}>{conversation.conversation_url}</span>{" "}
                  <button className="pill-btn" style={{ padding: "4px 12px", marginLeft: 6, fontSize: 12 }} onClick={() => copy(conversation.conversation_url, "url")}>
                    {copied === "url" ? "Copied" : "Copy"}
                  </button>
                </p>
              )}
              {log.length > 0 && (
                <div className="log">
                  {log.map((l, i) => (
                    <div key={i} className="log-row">
                      <span className="log-t">{l.t}</span>
                      <span className={`log-${l.kind}`}>{l.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {(() => {
            const idx = STEPS.findIndex((s) => s.id === step);
            return (
              <div className="flow-nav">
                {idx > 0 ? (
                  <button className="pill-btn" onClick={() => setStep(STEPS[idx - 1].id)}>← {STEPS[idx - 1].label}</button>
                ) : <span />}
                <span className="flow-pos">{STEPS[idx]?.group} · {idx + 1} of {STEPS.length}</span>
                <span style={{ display: "flex", gap: 8 }}>
                  <button className="pill-btn" onClick={saveScenario}
                    title={`Saves the whole demo${activeScenario ? ` to "${activeScenario}"` : scenarioName.trim() ? ` as "${scenarioName.trim()}"` : " (named after your brand/demo)"} — everything except the API key. Same as Save in the top bar.`}>
                    {savedFlash ? "Saved ✓" : "💾 Save"}
                  </button>
                  {step !== "launch" && (
                    <button className="pill-btn" disabled={!canLaunch} title={canLaunch ? "Jump to Launch & Share" : "Needs your Tavus key + Face + PAL first (Account / Persona)"}
                      onClick={() => setStep("launch")}>🚀 Launch</button>
                  )}
                  {idx < STEPS.length - 1 && (
                    <button className="pill-btn primary" onClick={() => setStep(STEPS[idx + 1].id)}>Next: {STEPS[idx + 1].label} →</button>
                  )}
                </span>
              </div>
            );
          })()}
        </main>

        <aside className="preview">
          <div className="preview-card" style={showApi ? undefined : { flex: "none" }}>
            <div className="preview-head">
              <span className="preview-title">Under the hood</span>
              <span style={{ display: "flex", gap: 6 }}>
                {showApi && (
                  <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => copy(preview.text, "curl")}>
                    {copied === "curl" ? "Copied" : "Copy curl"}
                  </button>
                )}
                <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12 }}
                  onClick={() => { const v = !showApi; setShowApi(v); store.set(SHOWAPI_KEY, v); }}>
                  {showApi ? "Hide" : "Show"}
                </button>
              </span>
            </div>
            {showApi && (
              <>
                <span className="preview-title" style={{ color: "var(--muted)" }}>{preview.title}</span>
                <div className="preview-code">{preview.text}</div>
                <p className="preview-note">
                  The exact API request this step sends — copy it to reproduce anything from a terminal or your own code.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>

      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Demo library — searchable, grouped by "Client / name" convention,
          sorted by last save. Replaces the old flat dropdown. */}
      {libOpen && (
        <div className="lib-overlay" onClick={() => setLibOpen(false)}>
          <div className="lib-panel" onClick={(e) => e.stopPropagation()}>
            <div className="lib-head">
              <span style={{ fontWeight: 700, fontSize: 16 }}>Demo library</span>
              <span className="lib-hint">{cloudSync === "on" ? "☁ = synced to your account" : "saved in this browser (cloud sync unavailable)"}</span>
              <button className="pill-btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={exportScenario}>Export</button>
              <button className="pill-btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => importRef.current?.click()}>Import</button>
              <button className="pill-btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setLibOpen(false)}>✕</button>
            </div>
            <input className="lib-search" autoFocus placeholder="Search demos…" value={libQuery} onChange={(e) => setLibQuery(e.target.value)} />
            <p className="field-hint" style={{ margin: "6px 2px 0" }}>
              Tip: name demos <b>Client / Use case</b> (e.g. “Santa / Better Santa”) and they group under the client automatically.
            </p>
            <div className="lib-list">
              {(() => {
                const all = Array.from(new Set([...Object.keys(scenarios), ...cloudNames]));
                const q = libQuery.trim().toLowerCase();
                const filtered = q ? all.filter((n) => n.toLowerCase().includes(q)) : all;
                if (!filtered.length) {
                  return <p className="field-hint" style={{ padding: 12 }}>{all.length ? "Nothing matches that search." : "No saved demos yet — build one and hit Save (you'll also be prompted after a launch)."}</p>;
                }
                const groupOf = (n) => { const m = n.match(/^(.+?)\s*\/\s*.+$/); return m ? m[1].trim() : ""; };
                const time = (n) => scenMeta[n]?.updatedAt || "";
                const groups = {};
                filtered.forEach((n) => { (groups[groupOf(n)] ||= []).push(n); });
                const keys = Object.keys(groups).sort((a, b) => (a === "") - (b === "") || a.localeCompare(b));
                return keys.map((g) => (
                  <div key={g || "(ungrouped)"}>
                    {(g || keys.length > 1) && <div className="lib-group">{g || "Ungrouped"}</div>}
                    {groups[g].sort((a, b) => time(b).localeCompare(time(a)) || a.localeCompare(b)).map((n) => {
                      const t = time(n);
                      return (
                        <div className="lib-row" key={n}>
                          <button className="lib-name" onClick={() => { loadScenario(n); setLibOpen(false); }} title={`Load “${n}”`}>
                            {g ? n.replace(/^.+?\s*\/\s*/, "") : n}
                            {activeScenario === n && <span className="lib-active">loaded</span>}
                          </button>
                          {cloudNames.includes(n) && <span title="Synced to your account — survives cleared browser storage">☁</span>}
                          {t && <span className="lib-time" title={t}>{new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                          <button className="kb-del" title={`Delete “${n}”`}
                            onClick={() => { if (window.confirm(`Delete “${n}”? This removes the saved copy everywhere.`)) deleteScenario(n); }}>
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Post-launch / post-share save prompt — launched demos are worth keeping. */}
      {savePrompt && !siteMode && (
        <div className="saveprompt">
          <span style={{ fontWeight: 700 }}>💾 Save this demo?</span>
          <span className="saveprompt-sub">
            {activeScenario
              ? <>It has unsaved changes since <b>{activeScenario}</b> was last saved.</>
              : <>Keep it in your library so you can reload, tweak, and share it later.</>}
          </span>
          <input
            value={savePromptName}
            onChange={(e) => setSavePromptName(e.target.value)}
            placeholder="Client / demo name"
            onKeyDown={(e) => e.key === "Enter" && saveScenario(savePromptName || undefined)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pill-btn primary" style={{ flex: 1 }} onClick={() => saveScenario(savePromptName || undefined)}>Save</button>
            <button className="pill-btn ghost" onClick={() => setSavePrompt(false)}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}
