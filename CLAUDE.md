# CLAUDE.md — Tavus Experience Builder

> Scope note: this file documents the **Tavus Experience Builder** demo tool
> (`TavusExperienceBuilder.jsx`). The Python files at the repo root
> (`server.py`, `bridge.py`, `docs_store/`, etc.) are a **separate** project —
> the Tavus Docs Q&A server, documented in `README.md`. This CLAUDE.md is only
> about the React builder.

## What this is

A single-file React app for **building and launching Tavus CVI demos** without
touching code. A solutions engineer points it at a Tavus account, configures a
PAL (persona) — presentation mode, Magic Canvas, objectives, guardrails — and
launches a live conversation onto a clean, branded demo page. It calls the
Tavus REST API (`https://tavusapi.com/v2`) directly from the browser; there is
no backend of its own.

The entire app is `TavusExperienceBuilder.jsx` — one default-exported
component, all CSS inlined in a `<style>` block, no build config in this repo.
It is meant to be dropped into a Vite React project.

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

Left-rail steps, each a slice of one big component's state:

1. **Setup** — `apiKey`, `faceId`, `palId`, `language`, `conversationName`,
   `callbackUrl` (webhook), `greeting`. `canLaunch` requires key + face + PAL.
2. **Objectives & Guardrails** (`guide`) — plain-English textareas, one item
   per line, parsed on launch:
   - `parseObjectives` — each line → an objective; lines **chain** in order via
     `next_required_objective`. `| var1, var2` suffix → `output_variables`.
     `confirmationMode` (`auto`/`manual`) applies to all.
   - `parseGuardrails` — each line → a guardrail; `[visual]` anywhere in the
     line marks `modality: "visual"` (else `verbal`).
   - `slugName()` turns prose into API-safe `obj_N_…` / `gr_N_…` names.
3. **Presentation** — attach PDF/image decks from the Knowledge Base.
   `docIdsRaw` (comma/newline list → `docIds`), `slidesTrigger`
   (`walk_the_deck` | `on_demand`), optional `presentPrompt`.
4. **Magic Canvas** — interactive cards beside the video. Seven components
   (`CANVAS_COMPONENTS`); all on by default. Per-card enable + free-text rule,
   `canvasStyle` (eager/balanced/minimal/on_request), `canvasPlaybook`,
   `placement` (auto/right/left), and `schedulingUrl` (Calendly, activates the
   Scheduling card).
5. **Demo Page** (`site`) — `brand`, `logoUrl`, `headline`, `tagline`, `cta`.
6. **Launch** — runs the whole attach-then-create sequence, logs each step.

## Launch sequence (`launch()`)

In order, skipping any disabled section:

1. Objectives → `POST /objectives`, then `PATCH /pals/{id}` with
   `[{op:"add", path:"/objectives_id", value}]` (replaces any existing set).
2. Guardrails → `POST /guardrails` per rule, read existing via
   `GET /pals/{id}`, **merge** new IDs with existing, then `PATCH /pals/{id}`
   `/guardrail_ids`.
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

- **Call UI is chosen at runtime.** On mount it dynamically imports the Tavus
  CVI components (`./components/cvi/components/{cvi-provider,conversation,magic-canvas}`).
  - `cvi === undefined` → loading
  - `cvi` object → render custom `<CVIProvider><Conversation/><MagicCanvas/></CVIProvider>`
  - `cvi === null` → components not installed → fall back to a plain `<iframe
    src={conversationUrl}>` (Tavus-hosted call UI), and show a hint to run
    `npx @tavus/cvi-ui@latest add conversation magic-canvas`.
- `useTabRecorder()` — records the tab (getDisplayMedia) mixed with mic audio
  via an `AudioContext`, downloads a `.webm`. Independent of Tavus.

### ⚠️ Known issue — custom CVI call UI hangs on "Connecting"

When the `@tavus/cvi-ui` components **are** installed, the custom in-page call
(`<Conversation conversationUrl=… />`) can **hang on "Connecting…" and never
join the room**. The **hosted-iframe fallback path works** — i.e. when the CVI
components are absent and the page renders the plain `<iframe>` against the same
`conversation_url`, the call connects normally.

Practical implication: the iframe path is the reliable demo path today. If you
touch the `stage()` logic in `DemoSite`, do **not** regress the iframe fallback.
Root cause is unconfirmed (candidates: CVIProvider/Daily init inside the
contained `.cvi-wrap`, camera/mic permission handoff, or the
`canvas-contained` overlay). Reproduce by installing the components so `cvi`
resolves to an object rather than `null`.

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
  snapshots of the full builder config (everything except the API key).
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
- Never break the iframe fallback in `DemoSite` — it is the working call path.
