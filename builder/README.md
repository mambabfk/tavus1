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

**Easiest — dashboard import (recommended, zero config):**

The repo root carries a deploy shim (`/vercel.json`, `/package.json`,
`/api/generate-persona.js`) so Vercel builds this app straight from the repo
root — no Root Directory setting needed.

1. Go to [vercel.com/new](https://vercel.com/new) and import the
   `mambabfk/tavus1` GitHub repo. Leave every build setting as-is.
2. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` — powers persona generation (required)
   - `BUILDER_PASSWORD` — shared access code; when set, the app shows a
     lock screen and the Claude endpoint rejects unauthenticated calls.
     Leave unset to keep the app open (e.g. local dev). Changing it
     signs everyone out.
3. Deploy, then in **Project → Settings → Git** set **Production Branch** to
   the branch that carries the builder (unless it's already merged to the
   default branch). Every push auto-deploys from then on.

**Or via CLI** — run everything **from inside this `builder/` directory**
(running `vercel` from elsewhere deploys the wrong folder):

```bash
git clone https://github.com/mambabfk/tavus1.git
cd tavus1/builder
npm install
npx vercel                                        # link/create the project
npx vercel env add ANTHROPIC_API_KEY production   # paste the key when prompted
npx vercel env add ANTHROPIC_API_KEY preview
npx vercel --prod
```

Note: Vercel CLI v56+ requires the environment name
(`production` / `preview` / `development`) as the second argument to
`env add`.

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
