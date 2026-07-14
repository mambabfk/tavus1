import { useState, useMemo, useRef, useEffect } from "react";

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
  { id: "setup", label: "Setup" },
  { id: "persona", label: "Persona" },
  { id: "guide", label: "Objectives & Guardrails" },
  { id: "presentation", label: "Presentation" },
  { id: "canvas", label: "Magic Canvas" },
  { id: "site", label: "Demo Page" },
  { id: "launch", label: "Launch" },
];

/* Turn a plain-English line into an API-safe objective/guardrail name */
const slugName = (text, prefix, i) => {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return `${prefix}_${i + 1}_${s || "item"}`;
};

/* One objective per line. Optional "| var1, var2" suffix extracts variables.
   Lines chain in order via next_required_objective. */
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

function DemoSite({ site, conversationUrl, onStart, onExit, busy }) {
  const { recording, elapsed, start: startRec, stop: stopRec } = useTabRecorder();
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Load @tavus/cvi-ui components if installed (npx @tavus/cvi-ui@latest add conversation magic-canvas).
  // import.meta.glob keeps the build green when they're absent and bundles them when present.
  // Falls back to a plain iframe when they aren't installed.
  const [cvi, setCvi] = useState(undefined); // undefined=loading, null=unavailable, object=ready
  useEffect(() => {
    let alive = true;
    const mods = import.meta.glob("./components/cvi/components/*/index.{tsx,ts,jsx,js}");
    const load = (name) => {
      const key = Object.keys(mods).find((k) => k.includes(`/${name}/`));
      return key ? mods[key]() : Promise.reject(new Error(`${name} not installed`));
    };
    Promise.all([load("cvi-provider"), load("conversation"), load("magic-canvas")])
      .then(([p, c, m]) => alive && setCvi({ CVIProvider: p.CVIProvider, Conversation: c.Conversation, MagicCanvas: m.MagicCanvas }))
      .catch(() => alive && setCvi(null));
    return () => { alive = false; };
  }, []);

  const stage = () => {
    if (!conversationUrl) {
      return (
        <div className="demo-cta">
          <button className="pill-btn primary big" onClick={onStart} disabled={busy}>
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
            <Conversation conversationUrl={conversationUrl} onLeave={onExit} />
            {/* Contained inside the stage instead of a full-viewport overlay */}
            <MagicCanvas className="canvas-contained" onError={(e) => console.error("canvas error", e)} />
          </div>
        </CVIProvider>
      );
    }
    return (
      <iframe
        src={conversationUrl}
        allow="camera; microphone; autoplay; display-capture; fullscreen"
        title="Live conversation"
      />
    );
  };

  return (
    <div className="demo-root">
      <nav className="demo-nav">
        <div className="demo-brandwrap">
          {site.logoUrl ? (
            <img src={site.logoUrl} alt="" className="demo-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <span className="demo-monogram">{(site.brand || "T")[0].toUpperCase()}</span>
          )}
          <span className="demo-brand">{site.brand || "Your Brand"}</span>
        </div>
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
      </nav>

      <main className="demo-main">
        {(site.headline || !conversationUrl) && (
          <header className="demo-header">
            <h1>{site.headline || "Talk to our AI expert"}</h1>
            {site.tagline && <p>{site.tagline}</p>}
          </header>
        )}

        <div className="demo-stage">
          {stage()}
        </div>

        {conversationUrl && cvi === null && (
          <p className="demo-cta-hint" style={{ marginTop: 14, maxWidth: 560, textAlign: "center" }}>
            Showing the default call UI. For the fully custom Alto call experience, install the Tavus components:
            run <code>npx @tavus/cvi-ui@latest add conversation magic-canvas</code> in the project, then restart.
          </p>
        )}

        <span className="demo-powered">powered by tavus</span>
      </main>
    </div>
  );
}

/* ── Main app ──────────────────────────────────────────────── */

export default function TavusExperienceBuilder() {
  const [step, setStep] = useState("setup");

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
    product: "", audience: "", goal: "", tone: "", mustCover: "", avoid: "",
  });
  const setBriefField = (k, v) => setPersonaBrief((b) => ({ ...b, [k]: v }));
  const [personaDraft, setPersonaDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [personaAttached, setPersonaAttached] = useState(false);

  // Presentation
  const [presentationEnabled, setPresentationEnabled] = useState(false);
  const [docIdsRaw, setDocIdsRaw] = useState("");
  const [slidesTrigger, setSlidesTrigger] = useState("walk_the_deck");
  const [presentPrompt, setPresentPrompt] = useState("");

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
    brand: "", logoUrl: "", headline: "", tagline: "", cta: "Start the conversation",
  });
  const setSiteField = (k, v) => setSite((s) => ({ ...s, [k]: v }));

  // Launch
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [siteMode, setSiteMode] = useState(false);
  const [copied, setCopied] = useState("");

  // Scenarios (named snapshots of the full builder config)
  const [scenarios, setScenarios] = useState(() => store.get(SCENARIOS_KEY, {}));
  const [scenarioName, setScenarioName] = useState("");
  const [activeScenario, setActiveScenario] = useState("");
  const [rememberKey, setRememberKey] = useState(() => !!store.get(APIKEY_KEY, ""));
  const importRef = useRef(null);

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
    presentationEnabled, docIdsRaw, slidesTrigger, presentPrompt,
    objectivesEnabled, objectivesText, confirmationMode, guardrailsEnabled, guardrailsText,
    canvasEnabled, components, schedulingUrl, placement, canvasStyle, componentRules, canvasPlaybook,
    site,
  });

  const applyConfig = (c) => {
    if (!c || typeof c !== "object") return;
    setFaceId(c.faceId ?? ""); setPalId(c.palId ?? ""); setLanguage(c.language ?? "english");
    setConversationName(c.conversationName ?? ""); setCallbackUrl(c.callbackUrl ?? ""); setGreeting(c.greeting ?? "");
    setPersonaBrief({ product: "", audience: "", goal: "", tone: "", mustCover: "", avoid: "", ...(c.personaBrief || {}) });
    setPersonaDraft(c.personaDraft ?? "");
    setPersonaAttached(false);
    setPresentationEnabled(!!c.presentationEnabled); setDocIdsRaw(c.docIdsRaw ?? "");
    setSlidesTrigger(c.slidesTrigger ?? "walk_the_deck"); setPresentPrompt(c.presentPrompt ?? "");
    setObjectivesEnabled(!!c.objectivesEnabled); setObjectivesText(c.objectivesText ?? "");
    setConfirmationMode(c.confirmationMode ?? "auto");
    setGuardrailsEnabled(!!c.guardrailsEnabled); setGuardrailsText(c.guardrailsText ?? "");
    setCanvasEnabled(!!c.canvasEnabled);
    setComponents({ ...Object.fromEntries(CANVAS_COMPONENTS.map((x) => [x.key, true])), ...(c.components || {}) });
    setSchedulingUrl(c.schedulingUrl ?? ""); setPlacement(c.placement ?? "auto");
    setCanvasStyle(c.canvasStyle ?? "balanced");
    setComponentRules({ ...Object.fromEntries(CANVAS_COMPONENTS.map((x) => [x.key, ""])), ...(c.componentRules || {}) });
    setCanvasPlaybook(c.canvasPlaybook ?? "");
    setSite({ brand: "", logoUrl: "", headline: "", tagline: "", cta: "Start the conversation", ...(c.site || {}) });
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

  /* ── Payloads ── */

  const presentationPayload = useMemo(() => {
    const config = { document_ids: docIds };
    if (slidesTrigger) config.slides_trigger = slidesTrigger;
    if (presentPrompt.trim()) config.prompt = presentPrompt.trim();
    return { config };
  }, [docIds, slidesTrigger, presentPrompt]);

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

    if (canvasEnabled) {
      const parts = [];
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

      if (parts.length) body.conversational_context = parts.join("\n\n");
    }

    body.properties = { language };
    return body;
  }, [faceId, palId, conversationName, callbackUrl, greeting, language, canvasEnabled, placement, canvasStyle, componentRules, canvasPlaybook]);

  const objectivesPayload = useMemo(
    () => ({ data: parseObjectives(objectivesText, confirmationMode) }),
    [objectivesText, confirmationMode]
  );
  const guardrailsParsed = useMemo(() => parseGuardrails(guardrailsText), [guardrailsText]);

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
    if (step === "presentation")
      return { title: "PUT /pals/…/skills/presentation", text: curlFor("PUT", `/pals/${pal}/skills/presentation`, presentationPayload) };
    if (step === "canvas")
      return { title: "PUT /pals/…/skills/magic_canvas", text: curlFor("PUT", `/pals/${pal}/skills/magic_canvas`, canvasPayload) };
    return { title: "POST /conversations", text: curlFor("POST", "/conversations", conversationPayload) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, palId, apiKey, personaDraft, presentationPayload, canvasPayload, conversationPayload, objectivesPayload, guardrailsParsed, objectivesEnabled, guardrailsEnabled]);

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
    if (!res.ok) throw new Error(`${res.status}: ${data.message || data.error || text || "request failed"}`);
    return data;
  };

  /* ── Persona: Claude drafts the system prompt via the backend ── */

  const generatePersona = async () => {
    setGenerating(true);
    setPersonaDraft("");
    setPersonaAttached(false);
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
        throw new Error(text.replace(/^\[error\]\s*/, "") || `${res.status}: generation failed`);
      }
      addLog("ok", "Persona prompt drafted — review it, then attach to the PAL.");
    } catch (e) {
      addLog("err", `Persona generation: ${e.message}`);
    } finally {
      setGenerating(false);
    }
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

      // Guardrails: create each, then merge with the PAL's existing guardrail_ids.
      if (guardrailsEnabled && guardrailsParsed.length) {
        addLog("info", `Creating ${guardrailsParsed.length} guardrail${guardrailsParsed.length > 1 ? "s" : ""}…`);
        const newIds = [];
        for (const g of guardrailsParsed) {
          const created = await tavusFetch("POST", "/guardrails", g);
          const id = created.uuid || created.guardrail_uuid || created.id;
          newIds.push(id);
          addLog("ok", `Guardrail ${g.guardrail_name}: ${id}`);
        }
        let existing = [];
        try {
          const palData = await tavusFetch("GET", `/pals/${pal}`);
          existing = palData.guardrail_ids || [];
        } catch { addLog("info", "Couldn't read existing guardrails — attaching new ones only."); }
        const merged = [...new Set([...existing, ...newIds])];
        addLog("info", "Attaching guardrails to the PAL…");
        await tavusFetch("PATCH", `/pals/${pal}`, [
          { op: "add", path: "/guardrail_ids", value: merged },
        ]);
        addLog("ok", `Guardrails attached (${merged.length} total on the PAL; persists until removed).`);
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
        .cvi-wrap { position:relative; width:100%; height:100%; background:#0e0f12; }
        .cvi-wrap > * { width:100%; height:100%; }
        /* Keep Magic Canvas cards inside the stage instead of a full-viewport overlay */
        .canvas-contained { position:absolute !important; inset:0 !important; }
        .demo-cta { display:flex; flex-direction:column; align-items:center; gap:14px; }
        .demo-cta-hint { color:var(--muted); font-size:13px; }
        .demo-powered { color:var(--muted); font-size:11px; font-family:var(--mono); margin-top:30px; }
        .rec-dot { width:9px; height:9px; border-radius:50%; background:var(--danger); }
        .rec-on { background:var(--danger); border-color:var(--danger); color:#fff; font-variant-numeric:tabular-nums; }
        .rec-on .rec-dot { background:#fff; }
        .pulsing { animation:recpulse 1.2s infinite; }
        @keyframes recpulse { 0%,100%{opacity:1} 50%{opacity:.35} }

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
        </div>
      </header>

      <div className="layout">
        <nav className="rail">
          {STEPS.map((s) => (
            <button key={s.id} className={"rail-btn" + (step === s.id ? " active" : "")} onClick={() => setStep(s.id)}>
              <span className="rail-label">{s.label}</span>
              {s.id === "setup" && canLaunch && <span className="rail-check">●</span>}
              {s.id === "persona" && personaDraft.trim() && <span className="rail-check">●</span>}
              {s.id === "guide" && (objectivesEnabled || guardrailsEnabled) && <span className="rail-check">●</span>}
              {s.id === "presentation" && presentationEnabled && <span className="rail-check">●</span>}
              {s.id === "canvas" && canvasEnabled && <span className="rail-check">●</span>}
              {s.id === "site" && site.brand && <span className="rail-check">●</span>}
            </button>
          ))}
        </nav>

        <main className="main">
          {step === "setup" && (
            <>
              <h1>Setup</h1>
              <p className="lede">Point the builder at your account and the PAL you want to configure. Everything else layers on top of this.</p>
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
              <Field label="PAL ID" hint="The PAL (persona) that drives the conversation, e.g. p5317866. Skills attach to this PAL.">
                <input className="mono" value={palId} onChange={(e) => setPalId(e.target.value)} placeholder="p…" />
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
              <Field label="Must cover" hint="Optional — key points the persona should work in.">
                <textarea value={personaBrief.mustCover} onChange={(e) => setBriefField("mustCover", e.target.value)} placeholder={"HIPAA compliance\n5-minute setup\nEHR integrations"} />
              </Field>
              <Field label="Must avoid" hint="Optional — topics or behaviors to steer clear of. Hard rules belong in Guardrails.">
                <textarea value={personaBrief.avoid} onChange={(e) => setBriefField("avoid", e.target.value)} placeholder={"Custom pricing\nCompetitor comparisons"} />
              </Field>

              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <button className="pill-btn primary" onClick={generatePersona} disabled={generating}>
                  {generating && !personaDraft ? "Drafting…" : personaDraft ? "Regenerate" : "Generate with Claude"}
                </button>
                {personaDraft.trim() && (
                  <button className="pill-btn" onClick={attachPersona} disabled={generating || personaAttached}>
                    {personaAttached ? "Attached ✓" : "Attach to PAL"}
                  </button>
                )}
              </div>

              <Field label="System prompt draft" hint={personaDraft
                ? "Edit freely — this exact text is what gets attached to the PAL."
                : "Generated here; you can also paste or write your own."}>
                <textarea
                  style={{ minHeight: 260, fontSize: 13, lineHeight: 1.6 }}
                  value={personaDraft}
                  onChange={(e) => { setPersonaDraft(e.target.value); setPersonaAttached(false); }}
                  placeholder="You are…"
                />
              </Field>
            </>
          )}

          {step === "guide" && (
            <>
              <h1>Objectives &amp; Guardrails</h1>
              <p className="lede">
                Type in plain English — one per line. On launch, the builder converts them into structured Tavus resources and attaches them to your PAL. Heads up: unlike Canvas playbooks, these live on the PAL itself — every future conversation inherits them until you remove them.
              </p>

              <div className="skill-head">
                <div className="subhead" style={{ margin: 0 }}>Objectives</div>
                <Toggle on={objectivesEnabled} onChange={setObjectivesEnabled} />
              </div>
              <p className="field-hint" style={{ maxWidth: 560, marginBottom: 8 }}>
                One goal per line, in the order the conversation should progress — lines chain automatically into a workflow. Add "| name, email" after a line to extract variables from it.
              </p>
              <Field label="" hint={objectivesEnabled && objectivesPayload.data.length
                ? `Will create a ${objectivesPayload.data.length}-step workflow: ${objectivesPayload.data.map((o) => o.objective_name).join(" → ")}`
                : "Best for templated flows (intake, interview, qualification). Free-flowing conversations usually don't need objectives."}>
                <textarea
                  style={{ minHeight: 110 }}
                  disabled={!objectivesEnabled}
                  value={objectivesText}
                  onChange={(e) => setObjectivesText(e.target.value)}
                  placeholder={"Ask which product line they're evaluating | product_line\nUnderstand their budget and timeline | budget, timeline\nConfirm who else is involved in the decision | stakeholders\nBook a follow-up meeting"}
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
            </>
          )}

          {step === "presentation" && (
            <>
              <div className="skill-head">
                <h1>Presentation</h1>
                <Toggle on={presentationEnabled} onChange={setPresentationEnabled} />
              </div>
              <p className="lede">The PAL presents PDF decks and images from your Knowledge Base as a live screen share. PDFs must be 50 pages or fewer and fully processed before attaching. Slides appear inside the conversation automatically.</p>
              <Field label="Document IDs" hint="Comma or newline separated. IDs come from the Create Document API — documents must already exist in your Knowledge Base.">
                <textarea className="mono" value={docIdsRaw} onChange={(e) => setDocIdsRaw(e.target.value)} placeholder={"d1234567890\nd2468101214"} />
              </Field>
              <Field label="Slides trigger">
                <div className="seg">
                  <button className={slidesTrigger === "walk_the_deck" ? "on" : ""} onClick={() => setSlidesTrigger("walk_the_deck")}>Walk the deck</button>
                  <button className={slidesTrigger === "on_demand" ? "on" : ""} onClick={() => setSlidesTrigger("on_demand")}>On demand</button>
                </div>
                <span className="field-hint">Walk the deck: the deck drives the conversation end to end. On demand: the PAL pulls the relevant slide when the conversation calls for it.</span>
              </Field>
              <Field label="Presenter prompt" hint="Optional instructions for how the PAL should present.">
                <textarea value={presentPrompt} onChange={(e) => setPresentPrompt(e.target.value)} placeholder="Walk the participant through the deck one slide at a time. Pause for questions after each section." />
              </Field>
            </>
          )}

          {step === "canvas" && (
            <>
              <div className="skill-head">
                <h1>Magic Canvas</h1>
                <Toggle on={canvasEnabled} onChange={setCanvasEnabled} />
              </div>
              <p className="lede">The PAL shows interactive cards next to the video and decides when to use them. Attaching enables everything by default — switch off what you don't want, and add rules to control when each card appears.</p>

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

          {step === "site" && (
            <>
              <h1>Demo Page</h1>
              <p className="lede">The launched conversation opens on a clean, branded page — the conversation stage front and center. Canvas cards and presentation slides appear inside the stage automatically.</p>
              <Field label="Brand name">
                <input value={site.brand} onChange={(e) => setSiteField("brand", e.target.value)} placeholder="Acme Health" />
              </Field>
              <Field label="Logo URL" hint="Optional. Any public image URL; falls back to a monogram if empty or broken.">
                <input className="mono" value={site.logoUrl} onChange={(e) => setSiteField("logoUrl", e.target.value)} placeholder="https://…/logo.png" />
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
              <button className="pill-btn" onClick={() => setSiteMode(true)}>Preview the page</button>
            </>
          )}

          {step === "launch" && (
            <>
              <h1>Launch</h1>
              <p className="lede">
                On launch: {[
                  objectivesEnabled && objectivesPayload.data.length && "creates & attaches objectives",
                  guardrailsEnabled && guardrailsParsed.length && "creates & attaches guardrails",
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
        </main>

        <aside className="preview">
          <div className="preview-card">
            <div className="preview-head">
              <span className="preview-title">{preview.title}</span>
              <button className="pill-btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => copy(preview.text, "curl")}>
                {copied === "curl" ? "Copied" : "Copy curl"}
              </button>
            </div>
            <div className="preview-code">{preview.text}</div>
            <p className="preview-note">
              The exact request this builder sends. Skill attaches use PUT (overwrite); PATCH merges — but a PATCH containing "components" replaces the whole overlay map, so send the complete set of overrides.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
