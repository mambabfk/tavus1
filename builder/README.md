# Tavus Experience Builder

Vite + React app for configuring Tavus PALs and launching branded demos, with a
Claude-powered persona-prompt generator. Deploys to Vercel as a static frontend
plus one serverless function.

## Architecture

- **Frontend** (`src/`) — the builder wizard. Calls the Tavus API directly from
  the browser with the API key the user enters in Setup (unchanged from the
  original single-file version).
- **`api/generate-persona.js`** — Vercel serverless function. Calls Claude
  (`claude-opus-4-8`, adaptive thinking, streamed) to draft a PAL system prompt
  from the plain-English brief in the Persona step. The **Anthropic key stays
  server-side** — set `ANTHROPIC_API_KEY` in Vercel env vars; it is never
  shipped to the browser.

## Deploy (Vercel)

```bash
cd builder
npm install
npx vercel                  # link/create the project; set root to builder/
npx vercel env add ANTHROPIC_API_KEY   # paste the key (Production + Preview)
npx vercel --prod
```

Vercel auto-detects Vite; `vercel.json` bumps the persona function to a 60s
max duration so long generations don't get cut off.

## Local dev

```bash
npm install
npm run dev        # vercel dev — serves the UI *and* the /api function on :3000
```

`npm run dev:ui` runs bare Vite (faster HMR) and proxies `/api` to a
`vercel dev` instance on port 3000 — run both if you want HMR plus generation.
For the function to work locally: `npx vercel env pull` (writes `.env.local`)
or `export ANTHROPIC_API_KEY=...` before `npm run dev`.

## Custom call UI (optional)

The demo page uses the Tavus-hosted iframe by default — **currently the
reliable path** (the custom CVI UI has a known hang on "Connecting"; see the
root `CLAUDE.md`). To try the custom Alto call experience:

```bash
npx @tavus/cvi-ui@latest add conversation magic-canvas
```

The components land in `src/components/cvi/` and are picked up automatically
via `import.meta.glob` — no code changes, just rebuild.
