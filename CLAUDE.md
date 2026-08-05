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
- `builder/api/login.js` + `builder/api/_auth.js` — login. When
  `BUILDER_PASSWORD` is set + Redis attached: per-user email/password
  accounts (scrypt in Redis); sign-up needs an invite — either the shared
  `BUILDER_PASSWORD` or a **per-person single-use code** (`TVS-XXXXXXXX`,
  minted by any signed-in user via `api/invites.js`, 30-day unused TTL,
  burned on use; "Team access" panel on the Account step). Sessions are HMAC
  cookies derived from the password — rotating it signs everyone out but
  keeps accounts. Unset = open (local dev).
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
- `builder/api/experience.js` — **experience arc data** (attendance +
  feedback). POST is public-with-credential: a real demo slug (visitor) or a
  builder session (preview); records merge under `exp:{conversation_id}`
  (90-day TTL, hourly rate caps). `kind: "attend"` on a slug call forwards an
  alert to the demo's stored `experience.notifyWebhook` (SSRF-guarded,
  text/plain — Zapier/Make-friendly; fires once per conversation, never for
  builder previews). GET `?ids=` (builder session) returns the per-call map —
  same shape as `/api/recordings`. The demo snapshot stores the full
  `experience` object; the public demo GET strips `notifyWebhook`.
- `builder/api/scenarios.js` — **cloud-synced scenarios**. One Redis hash per
  account (`scenarios:{email}`, field per scenario name; `"team"` for legacy
  shared-code sessions), holding `{name, config, updatedAt, savedBy}` —
  configs never include the Tavus API key. GET → names, GET `?name=` → one,
  POST upsert, DELETE `?name=`. Builder session required; 501 without Redis
  (frontend falls back to localStorage-only silently).
- `kind: "demo"` on `generate-persona` — "Start from an idea" (Setup step):
  Claude returns a full template JSON (site copy, greeting, personaBrief,
  objectives, guardrails, visionVibe, canvasPlaybook) applied across all
  steps; everything stays hand-editable, persona draft is cleared as stale.
- `builder/vercel.json` — bumps the function's `maxDuration` to 60s; rewrite
  for `/d/:slug`.
- `builder/tools/walkthroughs.mjs` — **auto-built video walkthroughs**
  (`npm run walkthroughs`): drives the built app with Playwright
  (playwright-core devDep; browser via `$CHROMIUM_PATH` or
  `/opt/pw-browsers/chromium`), records scripted scenes with a visible
  cursor + caption overlay, transcodes to MP4 (`$FFMPEG_PATH`, Playwright's
  bundled ffmpeg is VP8-only). Output `builder/walkthroughs/` is
  gitignored — regenerate after feature changes; add scenes to the `SCENES`
  list.
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
each STEPS entry). Step labels use **Tavus-native terms** (Objectives &
Guardrails, Perception, Knowledge Base, Presentation — per explicit user
direction; don't "simplify" them back to generic words). The persona
generator (`GENERATOR_SYSTEM`) emits the official Tavus Prompting Guide
structure: `## Identity & Role`, `## Personality & Conversational Style`
(base energy 1–10, SIGNATURE/NEVER-USE phrases), `## Core Behaviors`,
`## Response Style Rules`, `## Perception`, `## Guardrails & Constraints`,
`## Conversation Flow` — and receives perception/knowledge/tools context
alongside objectives/guardrails/presentation/canvas. Every step ends with a `flow-nav` footer (Back /
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
   attach never happens without the human seeing the text.
   **Revise with feedback** (`revisePersona()`, `kind: "revise"`): a one-line
   feedback field under the draft sends draft + current objectives/guardrails
   text + presentation setup (`presentationContext()`: trigger, presenter
   style, talk track — generate sends the same object) + feedback; Claude
   returns JSON `{prompt, objectives|null, guardrails|null, note}` — an
   *edit*, not a regenerate. Objectives are
   revised together with the prompt because they drive flow mechanically
   (a prompt-only edit leaves the PAL looping on stale objectives — learned
   from user pain). Frontend applies all three; goals re-attach on next
   launch, prompt needs manual re-attach; failure restores the prior draft.
   **Test drive** (`startTestDrive()` etc.): text-only chat against the PAL —
   `POST /conversations {persona_id, chat: true}`, then per turn
   `POST /conversations/{id}/respond {text, timeout_s}` (if not immediately
   `status:"ready"`, poll `GET …/respond`), `POST …/end` to finish. Runs the
   PAL's ATTACHED config (attach first!); no video pipeline; billed like
   conversation time. Endpoint shape confirmed from the `tavus-cli` package
   (not in public API reference — may change).
   The prompt persists on the PAL like objectives do.
   Setup also offers **Create PAL** (`createPal()`): `POST /pals` with
   `pal_name`, `default_face_id` (uses the Face ID field), and `system_prompt`
   (the persona draft when present, else a generic default) → fills `palId`.
2. **Objectives & Guardrails** (`guide`) — plain-English textareas, one item
   per line, parsed on launch (slug names are generated internally and never
   shown in the UI — summaries use `shortLabel(objective_prompt)`; branch
   nodes show as `↳`):
   - `parseObjectives` — top-level lines → objectives **chaining** in order
     via `next_required_objective`. **If/then branching**: an indented
     `if <condition> -> <detour objective>` line under a step compiles to
     `next_conditional_objectives` (mutually exclusive with next_required);
     detours rejoin the main flow at the next top-level step and a catch-all
     ("In any other case") is added automatically so uncovered answers never
     stall. `| var1, var2` suffix → `output_variables`.
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
   (`walk_the_deck` | `on_demand`), optional `presentPrompt`, per-slide
   `talkTrack`. **Inject into prompt** (`injectPresentationIntoPrompt()`,
   mirrors the canvas inject): weaves the deck — trigger mode, presenter
   style, talk track — into the persona + objectives via the revise
   machinery, so the flow actually reaches and finishes the deck.
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
4.55. **Tavus skills** (bottom of `tools` step) — `internet_search` (no
   config) and `browser_use` (optional raw-JSON config textarea; the skill is
   brand-new and its config schema wasn't in the docs mirror at build time) —
   on launch `PUT /pals/{id}/skills/{skill_id}` `{config}`; per-skill Detach
   buttons (`DELETE …/skills/{id}`). Browser view arrives as the replica's
   screenVideo track — same path as slides, already rendered by the custom UI.
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
   **Recording → S3** also lives here: **on by default**, and the S3 fields
   persist in localStorage (`REC_KEY = "tavus_builder_recording_v1"`) —
   entered once per browser; `applyConfig` falls back to those saved values
   when a scenario predates the feature. Fields: `recordingEnabled` + `recS3Bucket`/
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
   `tavus/<conversation_id>/<epoch_ms>` in the bucket (MP4, no extension).
   **Recording visibility**: when recording is on, `conversationPayload`
   points `callback_url` at `/api/recording-hook` (public POST; a
   user-entered webhook still gets every event — it rides along as `?fwd=`,
   SSRF-guarded). The hook stores `application.recording_ready` /
   `recording_copy_failed` under `rec:{conversation_id}` in Redis (90-day
   TTL, hourly abuse cap, always answers 200). `GET /api/recordings?ids=`
   (builder session required) returns the map; the Calls & Data step shows a
   ⏺ badge per recorded call and a Recording panel (s3:// URI, copy, S3
   console link) above the transcript.
5. **Demo Page** (`site`) — `brand`, `logoUrl` (set via **file upload** →
   canvas-downscaled ≤512px data URL, stored in config, no hosting),
   `headline`, `tagline`, `cta`, and `format`: `desktop` | `phone` (a
   scrollable in-app screen — status bar, app header, hero + CTA, skeleton
   cards standing in for the host app — inside a phone frame; in-call the
   conversation takes the screen over full-bleed) | `kiosk` (framed
   freestanding totem preview with a touch-to-start attract screen; the
   **Go live** button flips to `demo-kiosk-live` — chrome-less full-viewport
   + fullscreen for real kiosk/tablet hardware, Esc drops back to the framed
   preview) | `hologram` (a Proto-style holobox: white enclosure with brand
   top bar + speaker grilles, glowing blue 9:16 screen the call renders
   into — bright and physical, per explicit user direction; NOT dark
   sci-fi).
   `DemoSite` switches on `site.format` via `demo-{format}` CSS classes.
   Canvas split-layout only engages on `desktop` and live kiosk — phone,
   framed kiosk, and hologram keep the card overlay behavior.
5.5. **Experience** (`experience`) — the arc around the call, all riding
   shared links (config travels in the demo snapshot). **Guided journey**
   (`expJourney`, editor shape → `compiledJourney` ships): up to 8
   builder-composed pre-call steps — `info`, `video` (YouTube/Loom/Vimeo/mp4
   via `videoEmbed()`), `question` (choice), `input` (free text), `personas`
   (cards with per-option context/greeting/PAL-ID override). The visitor
   walks them as guided screens (progress dots) ending in the email gate;
   answers are woven into the conversation via `applyJourneyPrefs()` —
   duplicated in `api/demo-launch.js` (server resolves INDEXES against the
   stored journey; keep both copies in sync) — and stored as `{q,a}` pairs
   on the exp record (Results shows them). **Pre-call**: email
   gate (`expEmailGate`/`expEmailRequired`/`expEmailPrompt`) — **default ON**
   (email is table stakes; only explicit false turns it off, and old
   scenarios inherit ON); visitors
   enter an email before the CTA fires; `expNotifyWebhook` gets a
   `demo.attend` POST (incl. answers) the moment a visitor starts (works
   gate-on or -off).
   **Post-call** (any toggle on → ending the call lands on a thank-you
   screen instead of leaving): `expRating` (1–5 stars + comment),
   `expBooking` (opens `schedulingUrl` — shared with the Canvas scheduling
   card), `expTalkAgain`, `expThanks` (headline). All off = classic
   landing→call flow. In `DemoSite`: gate/post screens render inside the
   stage for every format (`exp-screen`); `handleLeave` routes to the post
   screen via `onCallEnd` (clears the conversation without closing the
   page). Attend/feedback POST to `/api/experience`; the Results step shows
   a "Visitors & feedback" list, 👤/★ row badges, and a Visitor panel on
   call detail (`expMap`, fetched alongside recordings).
5.8. **Studio** (`studio`) — records scripted takes as MP4 feature demos.
   `studioLines` (saved with scenarios) script the visitor — hand-written or
   Claude-drafted (`kind: "script"` on generate-persona: lines engineered
   from the demo's config to fire scripted-card trigger words in order,
   request/react to the deck per its trigger mode, invite canvas cards,
   advance the objectives, optionally test one guardrail); `startStudioTake()`
   captures the tab via getDisplayMedia **inside the click** (gesture rule),
   renders lines via `POST /api/tts` (**Cartesia** Sonic behind
   `CARTESIA_API_KEY` — per explicit user direction, same voice stack as
   Tavus; `CARTESIA_VOICE_ID`/`CARTESIA_MODEL`/`CARTESIA_VERSION` env
   overrides, voice falls back to the account's first voice; GET probes
   availability for the step's ready-check), then `launch()`es
   with `controls.studio: true` + `recordingLayout: "stage"`. The take
   engine in `CallExtras` (reads module-level `STUDIO_RUNTIME`) joins with
   the TTS MediaStream as mic (`setInputDevicesAsync`), camera off,
   publishes the captured tab as the stage screenshare, starts the S3
   recording, and turn-takes off utterance app-messages (1.7s quiet → next
   line; 12–16s fallback timers so a take always completes). Tab capture is
   the point: Daily's composed recordings can't see DOM overlays, so this
   is the only capture that includes Magic Canvas cards. Takes surface in
   Results as ordinary ⏺ recordings. **Live-call path untested in CI** —
   verify on deployed hardware before demoing.
   **Duet mode** (same step): two AI humans in live conversation. Because
   two customer-facing personas just run their agendas at each other, the
   partner defaults to an **auto-created interviewer PAL** (`duetMode:
   "auto"`; `INTERVIEWER_PROMPT`; created once via POST /pals, id cached in
   `duetPartnerId` and saved with the demo, cleared+recreated if a
   conversation-create fails on it) whose whole prompt is "make the guest
   shine". **The DEMO's AI human opens** (side A: `duetOpener` as its
   custom_greeting, blank = natural greeting — per explicit user
   direction); the partner room (side B) only MOUNTS after A's first turn
   arrives (18s fallback), with per-side ready flags + queued respond
   messages in `DuetStage` — deterministic opening order, no colliding
   greetings. `duetMode: "custom"` accepts any PAL as the partner instead.
   Two conversations are created; each joins in a same-origin iframe
   (`?duet=join&url=…&side=a|b` → `DuetJoiner`; dodges Daily's
   one-call-object-per-page limit). The joiner renders the replica's
   screen track (presentation slides / Browser Use) dominant with the face
   as a corner tile when present, so decks show up in duet recordings. The parent `DuetStage` is a pure TEXT
   switchboard: a replica's finished turn (buffered `conversation.utterance`
   speech, flushed on `stopped_speaking`; role from properties OR embedded
   in the event type, user role skipped, streaming-utterance events
   excluded) is sent to the other room as `conversation.respond`. No
   microphones in either room → no feedback loops. Recording is LOCAL:
   getDisplayMedia tab capture (with tab audio) → MediaRecorder → .webm
   auto-download — S3/Daily recording never sees both rooms. Config fields
   `duetPalB/FaceB/Opener/Topic/Turns` persist with scenarios; hard caps:
   2×turns relays + 5-minute timer + `max_call_duration: 360` on both rooms.
   **Scripted cards in duets**: `DuetStage` receives `compiledScriptedCards`
   and runs its own trigger engine off the relayed turn texts (either
   speaker's words), overlaying `ScriptedCard` bottom-center (`duet-card`) —
   Magic Canvas still never renders in duets.
   **Scripted-card extras**: style `question` = clickable multiple choice
   (title is the question, body lines are the options); the pick goes to the
   LLM as `conversation.respond` (answer fn threaded through
   `onScriptedCard({card, seq, answer})`) and appends to the exp record's
   answers via kind:"attend" (server APPENDS answers now, cap 24). Claude
   can draft the whole card set: `kind: "cards"` on generate-persona
   (JSON array), wired to "✨ Generate cards" on the Studio step (lands in
   `scCards`, editable on the Magic Canvas step).
6. **Launch** — runs the whole attach-then-create sequence, logs each step.
   Also **Preflight check** (`preflight()`): `POST /objectives/validate`
   (shape/chain check, nothing saved) + `POST /conversations` with
   `test_mode: true` (Tavus validates the full payload incl. recording
   storage; conversation is created pre-ended — no PAL joins, no cost).

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
- (The old `useTabRecorder` tab-capture button was removed once server-side
  S3 recording shipped — don't reintroduce a second recording path.)
- **Magic Canvas split layout**: when a side card is active,
  `onLayoutEffectChange` flips `canvasPanel` and the stage splits — the video
  pane resizes into the remaining width (`.cvi-video-pane` + `left`/`right`
  insets) and the card lands in a dedicated `.canvas-panel` region with its own
  background. Cards get their own screen beside the video, never overlaying it.
  (Replaced the old `translateX` video-shift, which still let cards cut into
  the video.) Panel width is `--canvas-panel-w` on `.cvi-wrap`; the vendored
  side slots are re-fit to it via `[data-canvas-slot]` overrides (the module
  CSS sizes them off `100vw`, wrong inside a contained stage). Phone format
  keeps the overlay behavior — too narrow to split.

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
  including `personaBrief` and `personaDraft`. The top-bar UI is a
  **Demo library** panel (`libOpen`), not a dropdown: search, per-row
  load/delete, ☁ badges, last-saved dates (`SCENMETA_KEY` locally +
  `scenmeta:{email}` hash via GET `/api/scenarios` → `{names, meta}`), and
  automatic grouping by the `Client / Use case` naming convention. A
  **save prompt** (`savePrompt`, bottom-right card) fires after a
  successful launch (on return from the demo page) and after creating a
  share link, whenever `isConfigDirty()` — keep `collectConfig` cheap, it
  runs in the dirty check.
  `collectConfig()` / `applyConfig()` are the serialize/restore pair; keep them
  in sync when adding a new field. Save/Load/Delete plus **Export/Import** to a
  JSON file (the file path works even when localStorage is blocked).
  **Cloud sync** (`/api/scenarios`): localStorage is only the instant/offline
  cache — every save/import also POSTs to the account's Redis hash, the
  dropdown shows the union of local + cloud names (☁ = synced), and load
  prefers the cloud copy when the two differ (it's the one that survives
  cleared browser storage and follows the account across devices).
  `cloudSync` state: `"unknown" → "on"/"off"`; `"off"` (no Redis, bare vite)
  degrades to the old localStorage-only behavior with honest log lines.
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
