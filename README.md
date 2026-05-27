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

When the LLM emits a `conversation.tool_call` for `search_tavus_docs`, your app
calls `POST /ask` with the `query`, then returns the `context` to the
conversation via a `conversation.echo` / `conversation.append_llm_context`
interaction. Tavus does not execute tool calls itself — your app bridges the
tool call to this server. See `docs_store/.../tool-calling-examples` for the flow.

## Config (env vars)

`DOCS_DIR`, `PORT`, `TAVUS_DOCS_BASE`, `CHUNK_CHARS`, `CHUNK_OVERLAP`,
and for the scraper `TAVUS_SITEMAP`, `SCRAPE_TIMEOUT`, `SCRAPE_DELAY`.
