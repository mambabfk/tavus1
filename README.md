# Tavus Docs Q&A server

A local server that mirrors the Tavus documentation and exposes a tool-call
endpoint a Tavus CVI persona can hit (via ngrok) to retrieve relevant docs with
no network round-trips at query time. Acts as a knowledge source for an "AI
Solutions Engineer" persona.

## How it works

1. `scrape.py` crawls `docs.tavus.io` (via its sitemap) and writes one file per
   page into `docs_store/`, plus the machine-readable `openapi.yaml` and
   `llms-full.txt` bundles.
2. `server.py` loads `docs_store/` on startup, builds an in-memory BM25 index,
   and serves search/answer endpoints. URL and title are derived from each file.

`docs_store/` ships pre-seeded with the core docs (persona, LLM/tool calling,
objectives, guardrails, knowledge base, memories, conversations, full API
reference) so the server works immediately. Run `scrape.py` to mirror the
complete, up-to-date docs on your machine.

## Run

```bash
pip install -r requirements.txt

# Optional: refresh / complete the local mirror (needs network access)
python scrape.py
# If the server is already running, pick up new docs with: curl -X POST localhost:8000/reload

python server.py          # http://0.0.0.0:8000
ngrok http 8000           # gives you a public https URL for the Tavus persona
```

## Endpoints

- `GET /health` — `{status, pages, chunks}`
- `POST /search` — `{query, top_k?}` → `{results: [{title, url, path, score, text}]}`
- `POST /ask` — `{query, top_k?}` → `{context, sources}`; `context` is a ready-to-read
  string for the persona's LLM to answer from. **This is the tool-call entrypoint.**
- `POST /reload` — re-read `docs_store/` after a fresh scrape

```bash
curl -X POST https://YOUR-NGROK-URL/ask \
  -H 'content-type: application/json' \
  -d '{"query": "how do I set up tool calling for a persona?"}'
```

## Wiring into a Tavus persona

Add a tool to the persona's `layers.llm.tools` (OpenAI function-calling format):

```json
{
  "type": "function",
  "function": {
    "name": "search_tavus_docs",
    "description": "Look up Tavus documentation to answer questions about CVI, personas, replicas, conversations, and the API.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "The user's question about Tavus" }
      },
      "required": ["query"]
    }
  }
}
```

Tavus does **not** execute tool calls or call this server directly. When the
LLM emits a `conversation.tool_call`, Tavus broadcasts it over the conversation's
WebRTC data channel (Daily). Something must be joined to the conversation to
catch that event, call `/ask`, and inject the result back. `bridge.py` is that
listener (see below) — so this works even with the Dev Portal's default UI.

## bridge.py — the tool-call listener

`bridge.py` joins the conversation headlessly (Daily Python SDK), listens for
`search_tavus_docs` tool calls, queries this server's `/ask`, and injects the
docs back via `conversation.append_llm_context` so the replica answers from them.

```bash
pip install -r requirements-bridge.txt   # daily-python (separate so it can't break the server install)

# Option A: let the bridge create the conversation (opens a URL you talk through)
export TAVUS_API_KEY=...        # your Tavus API key
export PERSONA_ID=p...          # persona that defines the search_tavus_docs tool
export REPLICA_ID=r...          # optional
export DOCS_SERVER_URL=http://localhost:8800
python bridge.py                # prints a conversation URL to open in your browser

# Option B: attach to a conversation you already created in the Dev Portal
export CONVERSATION_URL="https://tavus.daily.co/xxxx"
export CONVERSATION_ID="c..."
python bridge.py
```

Env knobs: `TOOL_NAME` (default `search_tavus_docs`), `RESULT_MODE`
(`append_llm_context` default, or `respond` to make the LLM answer immediately,
or `echo` to have the replica read text directly), `TOP_K`, `DOCS_SERVER_URL`.

Run order: `server.py` (docs) → `ngrok`/optional → `bridge.py` (listener) →
open the conversation URL and talk. `bridge.py` reaches the docs server over
`DOCS_SERVER_URL` (localhost is fine since it runs on the same machine — ngrok
is only needed if the listener runs elsewhere). See
`docs_store/sections/onboarding-guide/tool-calling-examples` for the protocol.

> Note: `daily-python` may not yet publish wheels for the very newest Python
> (e.g. 3.14). If `pip install -r requirements-bridge.txt` fails, run the bridge
> in a Python 3.12/3.13 venv — it can be separate from the server's venv.

## Config (env vars)

`DOCS_DIR`, `PORT`, `TAVUS_DOCS_BASE`, `CHUNK_CHARS`, `CHUNK_OVERLAP`,
and for the scraper `TAVUS_SITEMAP`, `SCRAPE_TIMEOUT`, `SCRAPE_DELAY`.
