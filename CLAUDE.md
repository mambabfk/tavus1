# CLAUDE.md — Tavus Experience Builder

> Scope note: this file documents the **Tavus Experience Builder** demo tool
> (the `builder/` directory). The Python files at the repo root (`server.py`,
> `bridge.py`, `docs_store/`, etc.) are a **separate** project — the Tavus
> Docs Q&A server, documented in `README.md`. This CLAUDE.md is only about
> the React builder.

## What this is

A React app for **building and launching Tavus CVI demos** without touching
code. A solutions engineer points it at a Tavus account, configures a PAL
(persona) — Claude-drafted system prompt, presentation mode, Magic Canvas,
objectives, guardrails — and launches a live conversation onto a clean,
branded demo page. Tavus REST calls (`https://tavusapi.com/v2`) go directly
from the browser; Claude calls go through a serverless backend that holds the
Anthropic key.

## Layout & deployment

`builder/` is a Vercel project (see `builder/README.md` for deploy steps):

- `builder/src/TavusExperienceBuilder.jsx` — the whole UI: one
  default-exported component, all CSS inlined in a `<style>` block.
- `builder/api/generate-persona.js` — Vercel serverless function that calls
  Claude (`claude-opus-4-8`, `@anthropic-ai/sdk`, adaptive thinking, streamed
  as plain text) to draft a persona system prompt. Requires the
  `ANTHROPIC_API_KEY` env var on Vercel — the key never reaches the browser.
- `builder/api/login.js` + `builder/api/_auth.js` — shared access-code login.
  When `BUILDER_PASSWORD` is set, the UI gates behind a lock screen and
  `generate-persona` requires the HMAC session cookie (stateless — derived
  from the password, so rotating the password revokes all sessions). Unset =
  open (local dev).
- `builder/api/demos.js` + `builder/api/demo-launch.js` + `builder/api/_kv.js`
  — **shareable demo links**. `POST /api/demos` (builder session required)
  stores an immutable snapshot `{name, site, controls, payload}` in Upstash
  Redis (`KV_REST_API_URL`/`UPSTASH_REDIS_REST_URL` env pairs, zero-dep REST
  client) under `demo:{slug}` → `/d/{slug}` (vercel.json rewrite → SPA).
  `GET /api/demos?slug=` is public but strips `payload`; visitors launch via
  `POST /api/demo-launch` which creates the Tavus conversation server-side
  with the `TAVUS_API_KEY` env var (rate-limited per slug/hour). The frontend
  `VisitorDemo` component (`?demo=` or `/d/` detection, before the auth gate)
  renders `DemoSite` standalone.
- `kind: "demo"` on `generate-persona` — "Start from an idea" (Setup step):
  Claude returns a full template JSON (site copy, greeting, personaBrief,
  objectives, guardrails, visionVibe, canvasPlaybook) applied across all
  steps; everything stays hand-editable, persona draft is cleared as stale.
- `builder/vercel.json` — bumps the function's `maxDuration` to 60s; rewrite
  for `/d/:slug`.
- Note: the repo **root** `api/`, `vercel.json`, `package.json`, and
  `.vercelignore` mirror `builder/` so the Vercel project can build from the
  repo root with zero config. Keep root `api/` in sync with `builder/api/`.

## Mental model

- **PAL** (`pal_id`, `p…`) — the persona that drives the conversation. **Skills
  attach to the PAL.**
- **Face** (`face_id`, `r…`) — the face shown on the call.
- **Skills are persistent, playbooks are per-conversation.** This distinction
  runs through the whole tool:
  - **Objectives, Guardrails, Presentation, Magic Canvas** are attached to the
    PAL via the API and **persist on the PAL** until explicitly removed — every
    future conversation on that PAL inherits them.
  - The **Canvas playbook**, **card style/rules**, and **placement** are *not*
    attached to the PAL. They are compiled into a `conversational_context`
    string sent with the `POST /conversations` call, so different demos can run
    different behavior against the same PAL without mutating it.

## The wizard (`STEPS`)

Left-rail steps, grouped into four phases rendered as rail headers
(`Start` → `The AI human` → `The experience` → `Run it`; `group` field on
each STEPS entry). Every step ends with a `flow-nav` footer (Back /
"Next: X →" / a 🚀 Launch shortcut gated on `canLaunch`). The default step
is `start` — a hero step combining the prospect URL + use-case idea into
one "Draft my demo" action (runs `draftDemo()` then `themeFromUrl()`,
lands on Persona). The right-hand curl panel is titled "Under the hood"
and is collapsible (persisted via `SHOWAPI_KEY`).

Categorization rules learned the hard way: the ✋ interrupt-button toggle
lives in **Page & Brand** (it's call UI, not timing); the guardrail
voice-line lives in **Goals & Rules** next to the guardrails textarea;
Timing keeps only duration/warning/nudge/wake-phrase. Magic Canvas has a
"Suggest a canvas plan" button (`kind: "canvas"` → JSON
{style, playbook, rules, disable}, biased against card overuse).

Step slices of the one big component's state (labels renamed for
non-technical users; ids unchanged):

1. **Setup** — `apiKey`, `faceId`, `palId`, `language`, `conversationName`,
   `callbackUrl` (webhook), `greeting`. `canLaunch` requires key + face + PAL.
1.5. **Persona** — plain-English brief (`personaBrief`: product, audience,
   goal, tone, mustCover, avoid) → `generatePersona()` POSTs brief + current
   builder context (objectives, guardrails, canvas playbook, presentation) to
   `/api/generate-persona` and streams the draft into an editable
   `personaDraft` textarea → `attachPersona()` PATCHes the PAL with
   `[{op:"add", path:"/system_prompt", value}]`. Draft → review → attach; the
   attach never happens without the human seeing the text. The prompt persists
   on the PAL like objectives do.
   Setup also offers **Create PAL** (`createPal()`): `POST /pals` with
   `pal_name`, `default_face_id` (uses the Face ID field), and `system_prompt`
   (the persona draft when present, else a generic default) → fills `palId`.
2. **Objectives & Guardrails** (`guide`) — plain-English textareas, one item
   per line, parsed on launch (slug names are generated internally and never
   shown in the UI — summaries use `shortLabel(objective_prompt)`):
   - `parseObjectives` — each line → an objective; lines **chain** in order via
     `next_required_objective`. `| var1, var2` suffix → `output_variables`.
     `confirmationMode` (`auto`/`manual`) applies to all.
   - `parseGuardrails` — each line → a guardrail; `[visual]` anywhere in the
     line marks `modality: "visual"` (else `verbal`).
   - `slugName()` turns prose into API-safe `obj_N_…` / `gr_N_…` names.
2.5. **Vision** (`vision`) — the perception layer. Plain-English "what should
   it notice" (`visionVibe`) → `generateVision()` calls `/api/generate-persona`
   with `kind: "vision"`; Claude returns `VISUAL:`/`AUDIO:` sections parsed by
   `parseVisionDraft` into editable per-line textareas. On launch →
   `PATCH /pals/{id}` `/layers/perception` with `{perception_model: "raven-1",
   visual_awareness_queries, audio_awareness_queries}`. Persists on the PAL.
3. **Presentation** — attach PDF/image decks from the Knowledge Base.
   `docIdsRaw` (comma/newline list → `docIds`), `slidesTrigger`
   (`walk_the_deck` | `on_demand`), optional `presentPrompt`.
4. **Magic Canvas** — interactive cards beside the video. Seven components
   (`CANVAS_COMPONENTS`); all on by default. Per-card enable + free-text rule,
   `canvasStyle` (eager/balanced/minimal/on_request), `canvasPlaybook`,
   `placement` (auto/right/left), and `schedulingUrl` (Calendly, activates the
   Scheduling card).
4.5. **Pronunciation** (`speech`) — `parsePronunciation`: one rule per line,
   `word = how to say it` (also `:` / `->`), `[ipa]` → `type: "ipa"`, `[case]`
   → `case_sensitive`, duplicates dropped. On launch →
   `POST /pronunciation-dictionaries` then `PATCH /pals/{id}`
   `/layers/tts/pronunciation_dictionary_id`. Persists on the PAL.
4.6. **Integrations** (`tools`) — plain-English ability rows
   ({name, desc, fields}) → `toolDefs` (OpenAI function shape, slugged names,
   comma fields → required string params) → on launch
   `PATCH /pals/{id}` `/layers/llm/tools`. `toolWebhook`/`toolEcho` travel in
   `controlsConfig`; `CallExtras` forwards `conversation.tool_call`
   app-messages to the webhook as `text/plain` JSON (no CORS preflight —
   works with Zapier/Make catch hooks) and optionally echoes a confirmation.
4.65. **Calls & Data** (`calls`) — pull-based, straight from Tavus:
   `GET /conversations` list + `GET /conversations/{id}?verbose=true` for
   transcript (`transcription`-type event), perception analyses, and raw JSON
   download. Covers visitor calls from shared links too (same Tavus account).
4.7. **Timing & Controls** (`controls`) — `maxMinutes` →
   `properties.max_call_duration`; `wakePhrase` → a conversational_context
   instruction. The rest run client-side in `CallExtras` (rendered inside
   `CVIProvider`, custom call UI only) via Daily app-messages:
   `timeWarning` (echoed at T−2min), `inactivitySeconds`/`inactivityUtterance`
   (silence → echo → 10s grace → leave), `interruptButton`
   (`conversation.interrupt`), `guardrailEcho` (echo on any `*guardrail*`
   app-message event).
   **Recording → S3** also lives here: `recordingEnabled` + `recS3Bucket`/
   `recS3Region`/`recS3RoleArn` (+ optional `recS3ExternalId`) →
   `properties.enable_recording: true` and `properties.recording_storage`
   (`{provider:"s3", bucket_name, bucket_region, assume_role_arn,
   external_id?}`) on the conversation payload — non-secret identifiers only;
   AWS access comes from a one-time IAM role trust to Tavus, never keys.
   **Gotcha: Tavus does NOT start the recording on its own** — `CallExtras`
   calls `daily.startRecording()` on `joined-meeting` when
   `controls.recording` is set (the flag travels in `controlsConfig`, so
   visitor calls from shared links record too; the storage config rides the
   stored payload through `demo-launch`). Recordings land at
   `tavus/<conversation_id>/<epoch_ms>` in the bucket.
5. **Demo Page** (`site`) — `brand`, `logoUrl` (set via **file upload** →
   canvas-downscaled ≤512px data URL, stored in config, no hosting),
   `headline`, `tagline`, `cta`, and `format`: `desktop` | `phone` (portrait
   stage in a device bezel) | `kiosk` (chrome-less full-viewport stage with a
   floating exit button). `DemoSite` switches on `site.format` via
   `demo-{format}` CSS classes.
6. **Launch** — runs the whole attach-then-create sequence, logs each step.

## Launch sequence (`launch()`)

In order, skipping any disabled section:

1. Objectives → `POST /objectives`, then `PATCH /pals/{id}` with
   `[{op:"add", path:"/objectives_id", value}]` (replaces any existing set).
2. Guardrails → `POST /guardrails` per rule, then `PATCH /pals/{id}`
   `/guardrail_ids` with **exactly the new IDs (full replace)** — merging
   accumulated duplicates across relaunches until PALs hit Tavus's
   50-guardrail cap and launches 400'd. The builder owns the PAL's set.
3. Presentation → `PUT /pals/{id}/skills/presentation`.
4. Magic Canvas → `PUT /pals/{id}/skills/magic_canvas`.
5. `POST /conversations` → stores `conversation`, flips `siteMode` on to open
   the demo page.

All requests go through `tavusFetch(method, path, body)` with the `x-api-key`
header. The right-hand **preview panel** shows the exact `curl` for the current
step (`curlFor`) — if a browser call is blocked by CORS, the log tells the user
to copy that curl and run it from a terminal/backend.

## Payload construction (the `useMemo` blocks)

- `presentationPayload` → `{ config: { document_ids, slides_trigger, prompt? } }`
- `canvasPayload` → `{ config: { components: overlay } }` where `overlay` only
  lists **disabled** components (`{enabled:false}`) plus the scheduling embed.
  **Gotcha (noted in the preview panel): a PATCH containing `components`
  replaces the whole overlay map — always send the complete set of overrides.**
  This tool uses `PUT` (full overwrite) for skill attaches.
- `conversationPayload` → `face_id` + `pal_id`, optional name/callback/greeting,
  `properties.language`, and (when canvas is on) the assembled
  `conversational_context` combining style text, per-card rules, playbook, and a
  `layout.preferred_slot` instruction for `safe-area-{left|right}`.

## Demo page (`DemoSite`)

Full-screen branded shell rendered when `siteMode` is true.

- **The custom CVI call UI is the ONLY call path** (per explicit product
  decision — never show the Daily prebuilt/hosted iframe). Components are
  vendored under `src/components/cvi/` and loaded via
  `import.meta.glob("./components/cvi/components/*/index.{tsx,ts,jsx,js}")`.
  - `cvi === undefined` → loading
  - `cvi` object → render custom `<CVIProvider><Conversation/><MagicCanvas/></CVIProvider>`
  - `cvi === null` → chunk load failure → a "Reload" prompt. There is **no
    iframe fallback** and no `?ui=` escape hatch.
- `useTabRecorder()` — records the tab (getDisplayMedia) mixed with mic audio
  via an `AudioContext`, downloads a `.webm`. Independent of Tavus.

### Fixed — custom CVI call UI used to hang on "Connecting"

Root cause (confirmed & fixed): the vendored `Conversation` component joined
in a **mount-only** `useEffect`, but `DailyProvider` creates the Daily call
object asynchronously and child effects run before parent effects — so
`useDaily()` was still `null`, `daily?.join()` silently no-oped, and nothing
retried. The fix (in `components/cvi/components/conversation/index.jsx`)
gates the join effect on `useDaily()` so it fires once the call object
exists. **Don't regress this when re-running `npx @tavus/cvi-ui add` — the
CLI's `--overwrite` will clobber the patched file.**

(Historical note: a hosted-iframe fallback existed until the user asked for
the prebuilt UI to be impossible; it was removed once this fix made the
custom path reliable.)

## Design system — Alto

Styling approximates **Alto (the Tavus Design System)**: warm light canvas,
white cards, hairline borders, large radii, black pill buttons, peach accent.
**All tokens live in the `:root` block** at the top of the `<style>` (`--canvas`,
`--surface`, `--border`, `--text`, `--muted`, `--accent`, radii, fonts). These
are approximations — **paste real Alto values into `:root` to match exactly**;
that is the single intended place to retheme.

## Persistence — scenarios & API key (localStorage)

`store` is a try/catch wrapper over `localStorage` that **silently no-ops where
storage is blocked** (e.g. the claude.ai preview iframe) — saves succeed in a
real local Vite app.

- **Scenarios** (`SCENARIOS_KEY = "tavus_builder_scenarios_v1"`) — named
  snapshots of the full builder config (everything except the API key),
  including `personaBrief` and `personaDraft`.
  `collectConfig()` / `applyConfig()` are the serialize/restore pair; keep them
  in sync when adding a new field. Save/Load/Delete plus **Export/Import** to a
  JSON file (the file path works even when localStorage is blocked).
- **API key** (`APIKEY_KEY = "tavus_builder_api_key_v1"`) — remembered only when
  the "Remember key" box is checked; **never included in scenario exports**.

## Conventions when editing

- It's one component; add UI as a new `step` in `STEPS` and a `{step === "…"}`
  block. New config fields must be threaded through `collectConfig`,
  `applyConfig`, and (if they shape a request) the relevant payload `useMemo`.
- Prefer `PUT` for skill attaches (full overwrite). If you switch to `PATCH`,
  remember the components-map replacement gotcha above.
- Retheme via `:root` tokens, not scattered literals.
- Never reintroduce a hosted-iframe/Daily-prebuilt call path — the custom CVI UI is the only sanctioned call surface.
