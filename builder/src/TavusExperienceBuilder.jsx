import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useDaily } from "@daily-co/daily-react";
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
  { id: "guide", label: "Goals & Rules", group: "The AI human" },
  { id: "vision", label: "Vision", group: "The AI human" },
  { id: "kb", label: "Knowledge", group: "The AI human" },
  { id: "presentation", label: "Slides", group: "The experience" },
  { id: "canvas", label: "Magic Canvas", group: "The experience" },
  { id: "speech", label: "Voice", group: "The experience" },
  { id: "site", label: "Page & Brand", group: "The experience" },
  { id: "tools", label: "Integrations", group: "Run it" },
  { id: "controls", label: "Timing", group: "Run it" },
  { id: "launch", label: "Launch & Share", group: "Run it" },
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

const SITE_FORMATS = [
  { v: "desktop", label: "Desktop", desc: "Full page — headline, tagline, wide 16:9 stage. The default." },
  { v: "phone", label: "Phone", desc: "Portrait stage in a phone frame — preview the mobile-app experience." },
  { v: "kiosk", label: "Kiosk", desc: "Nothing but the conversation, full screen — for tablets, lobbies, trade-show booths." },
];

/* Turn a plain-English line into an API-safe objective/guardrail name */
const slugName = (text, prefix, i) => {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return `${prefix}_${i + 1}_${s || "item"}`;
};

/* One objective per line; lines chain in order via next_required_objective.
   Legacy: a "| var1, var2" suffix still extracts output_variables (kept for
   old saved scenarios) but the syntax is no longer surfaced in the UI. */
const parseObjectives = (text, confirmationMode) => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items = lines.map((line, i) => {
    const [promptPart, varsPart] = line.split("|").map((s) => s.trim());
    const item = {
      objective_name: slugName(promptPart, "obj", i),
      objective_prompt: promptPart,
      confirmation_mode: confirmationMode,
    };
    if (varsPart) {
      const vars = varsPart.split(",").map((v) => v.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")).filter(Boolean);
      if (vars.length) item.output_variables = vars;
    }
    return item;
  });
  items.forEach((item, i) => {
    if (i < items.length - 1) item.next_required_objective = items[i + 1].objective_name;
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

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/demo-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
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
      <DemoSite
        site={demo.site || {}}
        controls={demo.controls || {}}
        conversationUrl={conversation?.conversation_url || null}
        conversationId={conversation?.conversation_id || null}
        onStart={start}
        onExit={() => setConversation(null)}
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

/* ── In-call extras: timers, wake reminders, interrupt button, guardrail echo.
      Lives INSIDE CVIProvider so it can use the Daily call object; these
      features need the custom call UI (they're inert in the iframe fallback). */
function CallExtras({ controls, conversationId, onForceLeave }) {
  const daily = useDaily();

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
  // never take down a live demo.
  useEffect(() => {
    if (!daily || !controls.recording) return;
    let started = false;
    const startRec = () => {
      if (started) return;
      if (daily.meetingState() !== "joined-meeting") return;
      started = true;
      try { daily.startRecording(); } catch { /* recording is best-effort */ }
    };
    daily.on("joined-meeting", startRec);
    startRec(); // already joined by the time this mounts
    return () => { daily.off("joined-meeting", startRec); };
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

  if (!controls.interruptButton) return null;
  return (
    <button className="interrupt-btn" onClick={interrupt} title="Stop the PAL mid-sentence">
      ✋ Interrupt
    </button>
  );
}

/* ── Tab recorder: tab video + tab audio mixed with mic → .webm ── */
function useTabRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef(null);
  const streamsRef = useRef([]);
  const timerRef = useRef(null);

  const stop = () => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  };

  const start = async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      let mic = null;
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { /* mic denied */ }

      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      if (display.getAudioTracks().length) ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(dest);
      if (mic) ctx.createMediaStreamSource(mic).connect(dest);

      const mixed = new MediaStream([...display.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      streamsRef.current = [display, mic, ctx].filter(Boolean);

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
      const rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tavus-demo-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        streamsRef.current.forEach((s) => {
          if (s.getTracks) s.getTracks().forEach((t) => t.stop());
          else if (s.close) s.close();
        });
        streamsRef.current = [];
        clearInterval(timerRef.current);
        setRecording(false);
        setElapsed(0);
      };
      display.getVideoTracks()[0].addEventListener("ended", stop);

      recRef.current = rec;
      rec.start(1000);
      setRecording(true);
      const t0 = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    } catch { /* user cancelled share picker */ }
  };

  useEffect(() => () => { clearInterval(timerRef.current); }, []);
  return { recording, elapsed, start, stop };
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

/* ── Demo page: minimal Alto shell around the conversation ──── */

function DemoSite({ site, conversationUrl, conversationId, controls, onStart, onExit, busy, visitor = false }) {
  const { recording, elapsed, start: startRec, stop: stopRec } = useTabRecorder();
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Magic Canvas reports a signed pixel shift so the host can slide the video
  // away from active cards — without it, side cards can cover the face.
  const [videoShift, setVideoShift] = useState(0);
  const onCanvasLayout = useCallback((l) => setVideoShift(l?.active ? l.video_shift_x || 0 : 0), []);

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
      return (
        <CVIProvider>
          <div className="cvi-wrap">
            {/* Shift the video away from active canvas cards so they never
                cover the face — MagicCanvas computes the exact offset. */}
            <div className="cvi-video-shift" style={{ transform: videoShift ? `translateX(${videoShift}px)` : "none" }}>
              <Conversation conversationUrl={conversationUrl} onLeave={onExit} />
            </div>
            {/* Contained inside the stage instead of a full-viewport overlay */}
            <MagicCanvas className="canvas-contained" onError={(e) => console.error("canvas error", e)} onLayoutEffectChange={onCanvasLayout} />
            <CallExtras controls={controls} conversationId={conversationId} onForceLeave={onExit} />
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

  // Kiosk = take over the physical screen. Fullscreen needs a user gesture,
  // so it rides on the start-conversation click (and a manual ⛶ button).
  const goFullscreen = () => document.documentElement.requestFullscreen?.().catch(() => {});
  const exitFullscreen = () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  const handleStart = () => {
    if (format === "kiosk") goFullscreen();
    onStart();
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

  return (
    <div className={`demo-root demo-${format}`} style={themeVars}>
      {format === "kiosk" && (
        <>
          <button className="kiosk-exit" onClick={handleExit} title="Back to builder">×</button>
          <button className="kiosk-exit kiosk-fs" onClick={goFullscreen} title="Fullscreen (kiosk)">⛶</button>
        </>
      )}
      <nav className="demo-nav">
        <div className="demo-brandwrap">
          {site.logoUrl ? (
            <img src={site.logoUrl} alt="" className="demo-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <span className="demo-monogram">{(site.brand || "T")[0].toUpperCase()}</span>
          )}
          <span className="demo-brand">{site.brand || "Your Brand"}</span>
        </div>
        {!visitor && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={"pill-btn ghost" + (recording ? " rec-on" : "")}
              onClick={recording ? stopRec : startRec}
              title={recording ? "Stop and download the recording" : 'Record this tab — pick "This Tab" and keep tab audio on'}
            >
              <span className={"rec-dot" + (recording ? " pulsing" : "")} />
              {recording ? `Stop · ${fmt(elapsed)}` : "Record"}
            </button>
            <button className="pill-btn ghost" onClick={onExit}>← Builder</button>
          </div>
        )}
      </nav>

      <main className="demo-main">
        {format === "desktop" && (site.headline || !conversationUrl) && (
          <header className="demo-header">
            <h1>{site.headline || "Talk to our AI expert"}</h1>
            {site.tagline && <p>{site.tagline}</p>}
          </header>
        )}

        {format === "phone" ? (
          <div className="phone-frame">
            <div className="phone-notch" />
            <div className="demo-stage">{stage()}</div>
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
  const [callbackUrl, setCallbackUrl] = useState("");
  const [greeting, setGreeting] = useState("");

  // Persona (Claude-drafted system prompt)
  const [personaBrief, setPersonaBrief] = useState({
    product: "", audience: "", goal: "", tone: "", emotions: "", mustCover: "", avoid: "",
  });
  const setBriefField = (k, v) => setPersonaBrief((b) => ({ ...b, [k]: v }));
  const [personaDraft, setPersonaDraft] = useState("");
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

  // Integrations (custom LLM tools → any webhook)
  const [toolsEnabled, setToolsEnabled] = useState(false);
  const [toolRows, setToolRows] = useState([{ name: "", desc: "", fields: "" }]);
  const [toolWebhook, setToolWebhook] = useState("");
  const [toolEcho, setToolEcho] = useState("");

  // Demo dashboard (per-slug stats from Redis)
  const [demoStats, setDemoStats] = useState(null);
  const [demoStatsLoading, setDemoStatsLoading] = useState(false);
  const [demoDetail, setDemoDetail] = useState(null);

  // Calls & data (pulled straight from Tavus)
  const [callsList, setCallsList] = useState(null);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callDetail, setCallDetail] = useState(null);
  const [callDetailLoading, setCallDetailLoading] = useState(false);

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
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [recS3Bucket, setRecS3Bucket] = useState("");
  const [recS3Region, setRecS3Region] = useState("");
  const [recS3RoleArn, setRecS3RoleArn] = useState("");
  const [recS3ExternalId, setRecS3ExternalId] = useState("");

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

  // Demo page
  const [site, setSite] = useState({
    brand: "", logoUrl: "", headline: "", tagline: "", cta: "Start the conversation", format: "desktop",
  });
  const setSiteField = (k, v) => setSite((s) => ({ ...s, [k]: v }));

  // Launch
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [siteMode, setSiteMode] = useState(false);
  const [copied, setCopied] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);

  // "Start from an idea" — Claude drafts the entire template
  const [ideaText, setIdeaText] = useState("");
  const [ideating, setIdeating] = useState(false);

  // Scenarios (named snapshots of the full builder config)
  const [scenarios, setScenarios] = useState(() => store.get(SCENARIOS_KEY, {}));
  const [scenarioName, setScenarioName] = useState("");
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
    recordingEnabled, recS3Bucket, recS3Region, recS3RoleArn, recS3ExternalId,
    toolsEnabled, toolRows, toolWebhook, toolEcho,
    presentationEnabled, docIdsRaw, slidesTrigger, presentPrompt, talkTrack,
    objectivesEnabled, objectivesText, confirmationMode, guardrailsEnabled, guardrailsText,
    canvasEnabled, components, schedulingUrl, placement, canvasStyle, componentRules, canvasPlaybook,
    palLlm, knowledgeIdsRaw,
    site,
  });

  const applyConfig = (c) => {
    if (!c || typeof c !== "object") return;
    setFaceId(c.faceId ?? ""); setPalId(c.palId ?? ""); setLanguage(c.language ?? "english");
    setConversationName(c.conversationName ?? ""); setCallbackUrl(c.callbackUrl ?? ""); setGreeting(c.greeting ?? "");
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
    setRecordingEnabled(!!c.recordingEnabled);
    setRecS3Bucket(c.recS3Bucket ?? ""); setRecS3Region(c.recS3Region ?? "");
    setRecS3RoleArn(c.recS3RoleArn ?? ""); setRecS3ExternalId(c.recS3ExternalId ?? "");
    setToolsEnabled(!!c.toolsEnabled);
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
  };

  const saveScenario = () => {
    const name = (scenarioName || activeScenario || "").trim();
    if (!name) return;
    const next = { ...scenarios, [name]: collectConfig() };
    setScenarios(next);
    const ok = store.set(SCENARIOS_KEY, next);
    setActiveScenario(name);
    setScenarioName("");
    addLog(ok ? "ok" : "info", ok ? `Scenario "${name}" saved.` : `Scenario "${name}" saved for this session only — storage is blocked in this environment. Use Export for a file.`);
  };

  const loadScenario = (name) => {
    if (!name || !scenarios[name]) { setActiveScenario(""); return; }
    applyConfig(scenarios[name]);
    setActiveScenario(name);
    addLog("info", `Scenario "${name}" loaded.`);
  };

  const deleteScenario = () => {
    if (!activeScenario) return;
    const next = { ...scenarios };
    delete next[activeScenario];
    setScenarios(next);
    store.set(SCENARIOS_KEY, next);
    addLog("info", `Scenario "${activeScenario}" deleted.`);
    setActiveScenario("");
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

    const parts = [];

    if (wakePhrase.trim()) {
      parts.push(
        `Wake phrase: after greeting the user once, stay quiet and do not respond to speech until someone says "${wakePhrase.trim()}" (or a close variation). Once you hear it, engage normally for the rest of the conversation. If people talk among themselves without saying it, remain silent.`
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
  }, [faceId, palId, conversationName, callbackUrl, greeting, language, canvasEnabled, placement, canvasStyle, componentRules, canvasPlaybook, knowledgeIds, wakePhrase, maxMinutes, recordingEnabled, recS3Bucket, recS3Region, recS3RoleArn, recS3ExternalId]);

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

  const controlsConfig = useMemo(() => ({
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
  }), [maxMinutes, timeWarning, inactivitySeconds, inactivityUtterance, interruptButton, guardrailEcho, toolsEnabled, toolWebhook, toolEcho, recordingEnabled, recS3Bucket, recS3Region, recS3RoleArn]);

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
    return { title: "POST /conversations", text: curlFor("POST", "/conversations", conversationPayload) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, palId, apiKey, personaDraft, visionPayload, pronunciationPayload, presentationPayload, canvasPayload, conversationPayload, objectivesPayload, guardrailsParsed, objectivesEnabled, guardrailsEnabled, kbUrl, kbName, kbCrawl, toolDefs]);

  /* ── API ── */

  const addLog = (kind, msg) => setLog((l) => [...l, { kind, msg, t: new Date().toLocaleTimeString() }]);

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

  const generatePersona = async () => {
    setGenerating(true);
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
            presentation: presentationEnabled && docIds.length > 0,
            canvas: canvasEnabled,
            canvasPlaybook: canvasEnabled ? canvasPlaybook.trim() : "",
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
      addLog("ok", "Persona prompt drafted — review it, then attach to the PAL.");
    } catch (e) {
      addLog("err", `Persona generation: ${e.message}`);
    } finally {
      setGenerating(false);
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
      if (slug) setDemoDetail(j);
      else { setDemoStats(j.demos || []); setDemoDetail(null); }
    } catch (e) {
      addLog("err", `Dashboard: ${e.message}`);
    } finally {
      setDemoStatsLoading(false);
    }
  };

  /* ── Calls & data: pulled straight from Tavus (source of truth) ── */

  const fetchCalls = async () => {
    if (!apiKey.trim()) { addLog("err", "Enter your Tavus API key in Setup first."); return; }
    setCallsLoading(true);
    setCallDetail(null);
    try {
      const d = await tavusFetch("GET", "/conversations");
      setCallsList(d.data || d.conversations || []);
    } catch (e) {
      addLog("err", `Calls: ${e.message}`);
    } finally {
      setCallsLoading(false);
    }
  };

  const openCall = async (id) => {
    setCallDetailLoading(true);
    try {
      const d = await tavusFetch("GET", `/conversations/${id}?verbose=true`);
      setCallDetail(d);
    } catch (e) {
      addLog("err", `Call detail: ${e.message}`);
    } finally {
      setCallDetailLoading(false);
    }
  };

  const downloadCall = () => {
    if (!callDetail) return;
    const blob = new Blob([JSON.stringify(callDetail, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tavus-call-${callDetail.conversation_id || "data"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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
    } catch (e) {
      addLog("err", `Share: ${e.message}`);
    } finally {
      setSharing(false);
    }
  };

  /* ── "Start from an idea": Claude drafts the whole template, all editable ── */

  const draftDemo = async () => {
    if (!ideaText.trim()) return;
    setIdeating(true);
    try {
      addLog("info", "Drafting the whole demo from your idea…");
      const res = await fetch("/api/generate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "demo", vibe: ideaText }),
      });
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
      addLog("err", `Draft demo: ${e.message}`);
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
      const res = await fetch("/api/brand-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: /^https?:\/\//i.test(url) ? url : `https://${url}`, useCase }),
      });
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
    } catch (e) {
      addLog("err", `Brand theme: ${e.message}`);
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
      addLog("ok", "Persona prompt attached (persists on the PAL until you change it).");
    } catch (e) {
      addLog("err", e.message + " — if this is a network/CORS block, copy the curl from the preview panel and run it from a terminal.");
    } finally {
      setGenerating(false);
    }
  };

  const canLaunch = apiKey.trim() && faceId.trim() && palId.trim();

  const launch = async () => {
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
      const data = await tavusFetch("POST", "/conversations", conversationPayload);
      setConversation(data);
      addLog("ok", `Live: ${data.conversation_id || ""}`);
      setSiteMode(true);
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

  /* ── UI ── */

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
      <style>{`
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
        .demo-header h1 { font-size:clamp(28px,4.5vw,44px); font-weight:700; letter-spacing:-1.2px; margin:0; line-height:1.1; max-width:760px; }
        .demo-header p { color:var(--muted); font-size:16px; line-height:1.6; max-width:600px; margin:14px auto 0; }
        .demo-stage { width:min(1080px,100%); aspect-ratio:16/9; background:var(--surface); border:1px solid var(--border); border-radius:20px; overflow:hidden; box-shadow:0 20px 60px -24px rgba(20,20,20,.18); display:flex; align-items:center; justify-content:center; position:relative; }
        .demo-stage iframe { width:100%; height:100%; border:none; }
        .cvi-wrap { position:relative; width:100%; height:100%; background:#0e0f12; overflow:hidden; }
        .cvi-wrap > * { width:100%; height:100%; }
        .cvi-video-shift { position:absolute; inset:0; transition:transform .55s cubic-bezier(.22,.9,.3,1); will-change:transform; }
        .cvi-video-shift > * { width:100%; height:100%; }
        /* Keep Magic Canvas cards inside the stage instead of a full-viewport overlay */
        .canvas-contained { position:absolute !important; inset:0 !important; }
        .interrupt-btn { position:absolute; bottom:18px; right:18px; z-index:30; border-radius:999px; border:none; background:rgba(255,255,255,.92); color:#17181A; padding:10px 16px; font:inherit; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,.25); }
        .interrupt-btn:hover { background:#fff; }
        .demo-cta { display:flex; flex-direction:column; align-items:center; gap:14px; }
        .demo-cta-hint { color:var(--muted); font-size:13px; }
        .demo-powered { color:var(--muted); font-size:11px; font-family:var(--mono); margin-top:30px; }
        .rec-dot { width:9px; height:9px; border-radius:50%; background:var(--danger); }
        .rec-on { background:var(--danger); border-color:var(--danger); color:#fff; font-variant-numeric:tabular-nums; }
        .rec-on .rec-dot { background:#fff; }
        .pulsing { animation:recpulse 1.2s infinite; }
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
        .fv-kiosk { width:56px; height:38px; background:currentColor; border-radius:5px; opacity:.35; }

        /* phone format: portrait stage in a device frame */
        .demo-phone .demo-main { justify-content:center; }
        .phone-frame { position:relative; width:min(390px, 92vw); aspect-ratio:9/19; background:#0e0f12; border-radius:44px; padding:12px; box-shadow:0 30px 80px -30px rgba(20,20,20,.45), 0 0 0 2px rgba(20,20,20,.9); display:flex; }
        .phone-notch { position:absolute; top:12px; left:50%; transform:translateX(-50%); width:110px; height:22px; background:#0e0f12; border-radius:0 0 14px 14px; z-index:2; }
        .demo-phone .demo-stage { width:100%; aspect-ratio:auto; flex:1; border-radius:32px; border:none; }

        /* kiosk format: conversation only, full screen */
        .demo-kiosk .demo-nav, .demo-kiosk .demo-header, .demo-kiosk .demo-powered { display:none; }
        .demo-kiosk .demo-main { padding:0; }
        .demo-kiosk .demo-stage { width:100vw; height:100vh; max-width:none; aspect-ratio:auto; border-radius:0; border:none; }
        .demo-kiosk .demo-cta { transform:scale(1.25); }
        .kiosk-exit { position:fixed; top:14px; right:14px; z-index:60; width:38px; height:38px; border-radius:50%; border:1px solid var(--border); background:rgba(255,255,255,.85); color:var(--muted); font-size:20px; line-height:1; cursor:pointer; opacity:.35; }
        .kiosk-exit:hover { opacity:1; }
        .kiosk-fs { top:60px; font-size:15px; }

        @media (max-width:1100px){ .preview { display:none; } }
        @media (max-width:760px){
          .rail { width:56px; }
          .rail-btn span.rail-label, .rail-check { display:none; }
          .main { padding:20px; }
          .layout { padding:0 10px 10px; gap:10px; }
        }
      `}</style>

      {siteMode && (
        <DemoSite
          site={site}
          conversationUrl={conversation?.conversation_url || null}
          conversationId={conversation?.conversation_id || null}
          controls={controlsConfig}
          onStart={launch}
          onExit={() => setSiteMode(false)}
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
          <select
            value={activeScenario}
            onChange={(e) => loadScenario(e.target.value)}
            style={{ width: 180 }}
            title="Load a saved scenario"
          >
            <option value="">— scenarios —</option>
            {Object.keys(scenarios).sort().map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input
            style={{ width: 170 }}
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder={activeScenario ? `save as… (${activeScenario})` : "scenario name"}
            onKeyDown={(e) => e.key === "Enter" && saveScenario()}
          />
          <button className="pill-btn" style={{ padding: "8px 14px", fontSize: 13 }} onClick={saveScenario} disabled={!scenarioName.trim() && !activeScenario}>Save</button>
          <button className="pill-btn" style={{ padding: "8px 14px", fontSize: 13 }} onClick={exportScenario}>Export</button>
          <button className="pill-btn" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => importRef.current?.click()}>Import</button>
          {activeScenario && (
            <button className="pill-btn" style={{ padding: "8px 14px", fontSize: 13, color: "var(--danger)" }} onClick={deleteScenario}>Delete</button>
          )}
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
                  if (ideaText.trim()) await draftDemo();
                  if (brandUrl.trim()) await themeFromUrl();
                  setStep("persona");
                }} disabled={ideating || theming || (!ideaText.trim() && !brandUrl.trim())}>
                  {ideating ? "Drafting the demo…" : theming ? "Matching their brand…" : "✨ Draft my demo"}
                </button>
                <p className="field-hint" style={{ marginTop: 10 }}>
                  Takes ~30 seconds. You land on the Persona step to review — every word stays editable.
                </p>
              </div>

              <p className="field-hint" style={{ maxWidth: 560 }}>
                Returning to a demo you saved? Load it from the <b>scenarios</b> menu in the top bar instead.
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
              <Field label="Face ID" hint="The face that appears on the call, e.g. r79e1c033f.">
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
            </>
          )}

          {step === "guide" && (
            <>
              <h1>Goals &amp; Rules</h1>
              <p className="lede">
                What the conversation should achieve, and what's off-limits — in plain English, one per line. These stick with the AI human for every future conversation until you change them.
              </p>

              <div className="skill-head">
                <div className="subhead" style={{ margin: 0 }}>Goals</div>
                <Toggle on={objectivesEnabled} onChange={setObjectivesEnabled} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 8 }}>
                One goal per line, in plain English — top to bottom is the order the conversation follows. If the PAL should collect something, just say so in the goal ("Ask for their name and email").
              </p>
              <Field label="" hint={objectivesEnabled && objectivesPayload.data.length
                ? `Your ${objectivesPayload.data.length}-step flow: ${objectivesPayload.data.map((o, i) => `${i + 1}) ${shortLabel(o.objective_prompt)}`).join("   ")}`
                : "Best for templated flows (intake, interview, qualification). Free-flowing conversations usually don't need objectives."}>
                <textarea
                  style={{ minHeight: 110 }}
                  disabled={!objectivesEnabled}
                  value={objectivesText}
                  onChange={(e) => setObjectivesText(e.target.value)}
                  placeholder={"Ask which product they're evaluating\nUnderstand their budget and timeline\nAsk who else is involved in the decision\nBook a follow-up meeting"}
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
                <div className="subhead" style={{ margin: 0 }}>Rules (guardrails)</div>
                <Toggle on={guardrailsEnabled} onChange={setGuardrailsEnabled} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 8 }}>
                One rule per line — what the PAL must never do, or what should be flagged. Add [visual] to a line for camera-enforced rules (e.g. "More than one person is visible [visual]"). Violations fire real-time events and hit your callback URL.
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

              <button className="pill-btn primary" style={{ marginBottom: 18 }} onClick={generateCanvasPlan} disabled={!canvasEnabled || canvasPlanning}>
                {canvasPlanning ? "Planning…" : "✨ Suggest a canvas plan"}
              </button>

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

              <div className="subhead">All calls on this account</div>

              {callDetail ? (
                <>
                  <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                    <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setCallDetail(null)}>← All calls</button>
                    <button className="pill-btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={downloadCall}>Download JSON</button>
                  </div>
                  <p className="field-hint">
                    <span className="mono">{callDetail.conversation_id}</span> · {callDetail.conversation_name || "unnamed"} · {callDetail.status}
                  </p>
                  {(() => {
                    const events = callDetail.events || [];
                    const tEvent = events.find((e) => /transcription/i.test(e.event_type || ""));
                    const transcript = tEvent?.properties?.transcript;
                    const pEvents = events.filter((e) => /perception/i.test(e.event_type || ""));
                    return (
                      <>
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
                  {!!callsList?.length && (
                    <div className="kb-list">
                      {callsList.map((c) => (
                        <div key={c.conversation_id} className="kb-row">
                          <span style={{ flex: 1, fontSize: 13 }}>
                            {c.conversation_name || <span className="mono" style={{ fontSize: 12 }}>{c.conversation_id}</span>}
                          </span>
                          <span className={`kb-status ${c.status === "ended" ? "" : "kb-ready"}`}>{c.status}</span>
                          <span style={{ color: "var(--muted)", fontSize: 11.5, flexShrink: 0 }}>{(c.created_at || "").slice(0, 16).replace("T", " ")}</span>
                          <button className="pill-btn" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => openCall(c.conversation_id)} disabled={callDetailLoading}>
                            {callDetailLoading ? "…" : "View"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                Files land at <span className="mono">tavus/&lt;conversation_id&gt;/&lt;timestamp&gt;</span>.
                One-time AWS setup: create the bucket and an IAM role Tavus can assume (a trust policy — no AWS keys ever go in here, only names).
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
    </div>
  );
}
