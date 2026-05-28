"""
Tavus Docs Q&A server.

Loads a local mirror of the Tavus documentation (see scrape.py / docs_store/),
builds an in-memory BM25 index, and serves a tool-call endpoint that a Tavus
CVI persona can hit (via ngrok) to retrieve relevant documentation with no
network round-trips at query time.

Run:
    pip install -r requirements.txt
    python server.py            # serves on http://0.0.0.0:8000
    ngrok http 8000             # expose to the Tavus persona
"""

import os
import re
import glob
import math
from dataclasses import dataclass, field
from typing import Optional

from contextlib import asynccontextmanager

import httpx
from fastapi import Body, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from rank_bm25 import BM25Okapi

DOCS_DIR = os.environ.get("DOCS_DIR", os.path.join(os.path.dirname(__file__), "docs_store"))
DOCS_BASE = os.environ.get("TAVUS_DOCS_BASE", "https://docs.tavus.io")
MAX_CONTEXT_CHARS = int(os.environ.get("MAX_CONTEXT_CHARS", "2200"))

# Mode-specific greeting + conversational_context injected at conversation creation.
# Both modes use the same persona; the context steers behavior.
GREETINGS = {
    "se": (
        "Hey — I'm Tavus's solutions engineer. Here to help you build anything. "
        "What are we breaking… I mean, building today?"
    ),
    "tutor": (
        "Welcome — I'll walk you from zero to your first working Tavus agent in about "
        "five minutes. What kind of agent do you want to build?"
    ),
}
CONTEXTS = {
    "se": (
        "This conversation is in SOLUTIONS ENGINEER mode. The user is an existing or "
        "prospective Tavus developer who needs open-ended help. They may share their "
        "screen at any time — if they do, react to what they're actually looking at on "
        "docs.tavus.io or platform.tavus.io. Default: answer questions concisely, using "
        "search_tavus_docs when the user asks something factual about Tavus. Do NOT push "
        "a calendar; only call offer_calendar after the user explicitly agrees to "
        "schedule. Never call tutor_step or create_persona_for_me in this mode."
    ),
    "tutor": (
        "This conversation is in BUILD TUTOR mode. The user is a brand-new Tavus "
        "developer who has never shipped an agent. Walk them from zero to a live, "
        "working CVI agent in 5 steps, in this exact order. At the START of each step "
        "you MUST call the tutor_step tool with the step number and a short title so "
        "the UI panel can track progress. Steps:\n"
        "  1. Confirm they're signed into platform.tavus.io and on the Personas tab. "
        "If they don't have an API key yet, point them to Developer Portal → API Key.\n"
        "  2. Pick a stock replica from the gallery — recommend a friendly one; let "
        "them browse if they want.\n"
        "  3. Help them write a 3-sentence system prompt for the persona they want to "
        "build. Ask what the agent should DO in one sentence, then offer your draft.\n"
        "  4. Add one tool — recommend a simple get_weather stub so they see the "
        "conversation.tool_call event flow. Use search_tavus_docs to ground the schema.\n"
        "  5. Have them start a test conversation from the dashboard and speak one "
        "sentence to it.\n"
        "AFTER step 5, call the create_persona_for_me tool with persona_name, "
        "system_prompt, and default_replica_id to mint a real starter persona that "
        "reflects their choices. Then offer to schedule a follow-up via offer_calendar.\n"
        "RULES: never skip ahead, never do more than one step at a time, confirm each "
        "step is complete before advancing. Keep every spoken response under three "
        "sentences. Use search_tavus_docs at any step where you need accurate fields."
    ),
}
CHUNK_CHARS = int(os.environ.get("CHUNK_CHARS", "1100"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "200"))

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


@dataclass
class Chunk:
    text: str
    title: str
    url: str
    path: str
    tokens: list[str] = field(default_factory=list)


def parse_doc(raw: str) -> tuple[dict, str]:
    """Split optional `---` frontmatter from body. Returns (meta, body)."""
    meta: dict = {}
    body = raw
    if raw.startswith("---"):
        end = raw.find("\n---", 3)
        if end != -1:
            header = raw[3:end].strip()
            body = raw[end + 4 :].lstrip("\n")
            for line in header.splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip()
    return meta, body


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    """Chunk on paragraph boundaries, packing paragraphs up to `size` chars."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        if len(p) > size:
            # Flush buffer, then hard-split the long paragraph.
            if buf:
                chunks.append(buf)
                buf = ""
            start = 0
            while start < len(p):
                chunks.append(p[start : start + size])
                start += max(1, size - overlap)
            continue
        if buf and len(buf) + len(p) + 2 > size:
            chunks.append(buf)
            tail = buf[-overlap:] if overlap else ""
            buf = (tail + "\n\n" + p).strip()
        else:
            buf = (buf + "\n\n" + p).strip() if buf else p
    if buf:
        chunks.append(buf)
    return chunks


class DocIndex:
    def __init__(self, docs_dir: str):
        self.docs_dir = docs_dir
        self.chunks: list[Chunk] = []
        self.bm25: Optional[BM25Okapi] = None
        self.num_pages = 0

    def load(self) -> None:
        self.chunks = []
        files = sorted(glob.glob(os.path.join(self.docs_dir, "**", "*.md"), recursive=True))
        for fp in files:
            with open(fp, "r", encoding="utf-8") as f:
                raw = f.read()
            meta, body = parse_doc(raw)
            if not body.strip():
                continue
            self.num_pages += 1
            rel = os.path.relpath(fp, self.docs_dir)
            rel_noext = os.path.splitext(rel)[0]
            first_line = next((ln.strip() for ln in body.splitlines() if ln.strip()), "")
            title = (
                meta.get("title")
                or (first_line if 0 < len(first_line) <= 80 else "")
                or os.path.basename(rel_noext).replace("-", " ").title()
            )
            url = meta.get("url") or f"{DOCS_BASE}/{rel_noext.replace(os.sep, '/')}"
            for ct in chunk_text(body, CHUNK_CHARS, CHUNK_OVERLAP):
                self.chunks.append(
                    Chunk(text=ct, title=title, url=url, path=rel, tokens=tokenize(title + " " + ct))
                )
        if self.chunks:
            self.bm25 = BM25Okapi([c.tokens for c in self.chunks])

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        if not self.bm25 or not query.strip():
            return []
        scores = self.bm25.get_scores(tokenize(query))
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        results = []
        for i in ranked:
            if scores[i] <= 0:
                break
            c = self.chunks[i]
            results.append(
                {
                    "title": c.title,
                    "url": c.url,
                    "path": c.path,
                    "score": round(float(scores[i]), 4),
                    "text": c.text,
                }
            )
            if len(results) >= top_k:
                break
        return results


index = DocIndex(DOCS_DIR)


@asynccontextmanager
async def lifespan(_: FastAPI):
    index.load()
    print(f"[tavus-docs] loaded {index.num_pages} pages -> {len(index.chunks)} chunks from {DOCS_DIR}")
    yield


app = FastAPI(title="Tavus Docs Q&A", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    top_k: int = 3


def _format_context(query: str, results: list[dict]) -> str:
    """Compact context for the persona LLM. Capped at MAX_CONTEXT_CHARS to keep
    the post-tool-call LLM pass fast (smaller context = lower latency)."""
    if not results:
        return f"No Tavus documentation was found for: {query!r}."
    parts = [f"Tavus documentation relevant to: {query}\n"]
    budget = MAX_CONTEXT_CHARS
    for n, r in enumerate(results, 1):
        src = f" ({r['url']})" if r["url"] else ""
        text = r["text"]
        if len(text) > budget:
            text = text[:budget].rsplit(" ", 1)[0] + " ..."
        parts.append(f"[{n}] {r['title']}{src}\n{text}\n")
        budget -= len(text)
        if budget <= 0:
            break
    return "\n".join(parts)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "pages": index.num_pages, "chunks": len(index.chunks)}


@app.get("/")
def root() -> dict:
    return {
        "service": "Tavus Docs Q&A",
        "pages": index.num_pages,
        "chunks": len(index.chunks),
        "endpoints": ["POST /search", "POST /ask", "GET /health"],
    }


@app.post("/search")
def search(req: SearchRequest) -> dict:
    """Return the top matching documentation chunks as structured results."""
    results = index.search(req.query, req.top_k)
    return {"query": req.query, "count": len(results), "results": results}


@app.post("/ask")
def ask(req: SearchRequest) -> dict:
    """
    Tool-call entrypoint for the Tavus persona.

    Returns a ready-to-read `context` string (the persona's LLM speaks from it)
    plus structured `sources` for citation.
    """
    results = index.search(req.query, req.top_k)
    return {
        "query": req.query,
        "context": _format_context(req.query, results),
        "sources": [{"title": r["title"], "url": r["url"]} for r in results],
    }


@app.get("/viewer")
def viewer() -> FileResponse:
    """Serve the embedded conversation + live-context-panel viewer.
    Open with ?conversation=<daily-room-url> to attach to an existing room, or
    open it bare to mint a new conversation via POST /conversations."""
    return FileResponse(os.path.join(os.path.dirname(__file__), "frontend", "viewer.html"))


@app.get("/config")
def config() -> dict:
    """Non-secret config the viewer needs in the browser (e.g. Calendly URL)."""
    return {
        "calendly_url": os.environ.get(
            "CALENDLY_URL",
            "https://calendly.com/tim-tavus/ai-video-developer-chat-with-tavus",
        )
    }


@app.post("/conversations")
def create_conversation(payload: dict = Body(default={})):
    """Mint a fresh Tavus conversation. Body: {"mode": "se" | "tutor"}.
    Same persona for both; conversational_context steers behavior."""
    api_key = os.environ.get("TAVUS_API_KEY", "")
    persona_id = os.environ.get("PERSONA_ID", "")
    if not api_key or not persona_id:
        return JSONResponse(
            {"error": "Set TAVUS_API_KEY and PERSONA_ID on the server before calling /conversations."},
            status_code=500,
        )
    mode = str((payload or {}).get("mode", "se")).lower()
    if mode not in GREETINGS:
        mode = "se"
    body = {
        "persona_id": persona_id,
        "custom_greeting": GREETINGS[mode],
        "conversational_context": CONTEXTS[mode],
    }
    replica_id = os.environ.get("REPLICA_ID", "")
    if replica_id:
        body["replica_id"] = replica_id
    r = httpx.post(
        "https://tavusapi.com/v2/conversations",
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    if r.status_code >= 400:
        return JSONResponse({"error": r.text}, status_code=r.status_code)
    data = r.json()
    return {
        "conversation_url": data.get("conversation_url"),
        "conversation_id": data.get("conversation_id"),
        "mode": mode,
    }


@app.post("/personas")
def create_persona(payload: dict = Body(...)):
    """Server-side proxy to POST /v2/personas; keeps TAVUS_API_KEY off the browser.
    Used by the tutor's create_persona_for_me tool to mint a real persona at the
    end of the 5-step flow."""
    api_key = os.environ.get("TAVUS_API_KEY", "")
    if not api_key:
        return JSONResponse({"error": "TAVUS_API_KEY not set on the server."}, status_code=500)
    persona_name = (payload.get("persona_name") or "My First Tavus Agent").strip()
    system_prompt = (payload.get("system_prompt") or "You are a helpful assistant.").strip()
    body = {
        "persona_name": persona_name,
        "system_prompt": system_prompt,
        "pipeline_mode": "full",
        "layers": {
            "llm": {"model": "tavus-gpt-oss"},
            "perception": {"perception_model": "raven-1"},
        },
    }
    replica_id = (payload.get("default_replica_id") or "").strip()
    if replica_id:
        body["default_replica_id"] = replica_id
    r = httpx.post(
        "https://tavusapi.com/v2/personas",
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    if r.status_code >= 400:
        return JSONResponse({"error": r.text}, status_code=r.status_code)
    data = r.json()
    return {
        "persona_id": data.get("persona_id"),
        "persona_name": persona_name,
        "dashboard_url": f"https://platform.tavus.io/personas/{data.get('persona_id', '')}",
    }


@app.post("/reload")
def reload() -> dict:
    """Re-read docs_store/ from disk (after a fresh scrape)."""
    index.num_pages = 0
    index.load()
    return {"status": "reloaded", "pages": index.num_pages, "chunks": len(index.chunks)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
