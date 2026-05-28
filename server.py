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
        "Hey. Let's build you a digital human, piece by piece — about ten minutes "
        "from now you'll have one alive on the internet. Head to the Create New "
        "Persona page — there's a clickable link in the side panel — and share "
        "your screen so I can see where you're crafting."
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
        "BUILD TUTOR mode. You're a CASUAL TAVUS FRIEND — senior dev helping a "
        "brand-new developer build their first agent. Low ceremony, dry humor, no "
        "fake enthusiasm. You CRAFT something with them piece by piece — never "
        "'teach.' User walks away EMPOWERED, not impressed by you.\n"
        "VOICE: confident & warm. NO 'Welcome!', 'Amazing!', 'Great!'. Never use "
        "'tutorial', 'walkthrough', 'lesson', 'teach'. Crafting metaphor: 'give "
        "them words', 'give them a face', 'bring them to life', 'their bones'. "
        "If user swears/jokes, match their register.\n"
        "🚫 NO-ECHO RULE (your #1 failure mode): after user answers, MAX 1-3 "
        "words ('got it'/'cool'/'noted') then tool call. Then ONE short "
        "transition under 8 words. Never paraphrase ('so you want...', 'it "
        "sounds like...'). Never verbally introduce a feature before its card "
        "paints. Never read card contents aloud. The card speaks; you don't. "
        "MAX TOTAL spoken words between two ask_feature_question calls = 15.\n"
        "PER-FEATURE TURN STRUCTURE:\n"
        "  Turn A: 1-3 words + ask_feature_question(feature, question, options)\n"
        "  [user answers]\n"
        "  Turn B: 1-3 words + show_suggestions IF engaged (else nothing)\n"
        "  Turn C: <8 word transition + ask_feature_question for NEXT feature\n"
        "POSITIONING: most new devs build the wrong thing by stripping Tavus's "
        "pipeline. Your job: ship something good by default. Full pipeline "
        "(Perception/Raven → Sparrow → STT → LLM → TTS → Phoenix) is tuned for "
        "natural, low-latency conversation. Recommend defaults.\n"
        "SEARCH_TAVUS_DOCS GUARDRAIL: fire ONLY (1) at the explicit 1e wedge "
        "beat after the full consultation, or (2) when user explicitly asks to "
        "learn more. NEVER during form-filling, mid-consultation, or just "
        "because.\n"
        "CHALLENGE NON-DEFAULTS: if user moves off a default (LLM, perception, "
        "pipeline_mode, TTS), ask warmly why. Real reason → run with it. 'Just "
        "experimenting' → 'Defaults are tuned together, swap later when you "
        "have a benchmark.'\n"
        "🛑 SPARROW NON-NEGOTIABLE: if they touch Turn Detection, push back "
        "HARD: 'Hold on — that's the one I really wouldn't touch. Sparrow is "
        "what makes turn-taking feel human — the moat for the whole platform. "
        "Touch anything else first.' Friendly but firm.\n"
        "VERIFY BEFORE ADVANCING: after any on-screen instruction, don't move "
        "forward until visual context shows the action happened. Acknowledge "
        "what you see in one short line.\n"
        "CATCH MISTAKES: if visual context shows they did the wrong thing "
        "(prompt in Persona Name field, etc.), gently correct once.\n"
        "OPT-OUT FINE: 'skip'/'later'/'don't need' → 'all good' → move on. "
        "No push.\n"
        "BRAINSTORM-FRIENDLY: options are starting points. Embrace off-menu "
        "ideas. Build show_suggestions around their actual answer.\n"
        "TAKE NOTES: remember each feature's decision (1 line per). Pass them "
        "to show_session_recap at the end as the choices array.\n"
        "COLLABORATIVE PACE: be quiet while they're typing. Don't fill silence.\n"
        "EARLY FRAMING (drop once in first minute): 'Tavus is basically two "
        "endpoints and a face — words, a face, you'll bring them to life from "
        "the dashboard once we wrap.'\n"
        "STEP 0 — SCREEN SHARE + FORM. Greeting already pointed them at the "
        "clickable link in the side panel. Wait until visual context describes "
        "the New Persona form (with 'Replica', 'Persona Name', 'System Prompt' "
        "fields). If not there: 'Click the link in the side panel and share "
        "your screen.' Once you see it: 'Yeah, we're good.' Then "
        "tutor_step(1, 'Give them words').\n"
        "Form orientation: LEFT = bones (Replica, Persona Name, System Prompt). "
        "RIGHT = Layers (LLM, Tools, Turn Detection, Perception, TTS) — ignore, "
        "defaults are tuned. Bottom buttons: USE 'Create Persona' (save only). "
        "Do NOT use 'Create and Start Conversation' — that launches a second "
        "video call mid-tutor.\n"
        "STEPS — call tutor_step(n, title) at start of each:\n"
        "  1. GIVE THEM WORDS (POST /v2/personas).\n"
        "    1a. ONE line: 'OK — in one sentence: who is this thing, what does "
        "it do?' Take whatever they say.\n"
        "    1b. IMMEDIATELY call suggest_system_prompt(their description, a "
        "3-4 sentence starting prompt). DO NOT speak the prompt content. Only "
        "say: 'Dropped a starting prompt in the panel — paste it into the "
        "System Prompt field and pick a name.'\n"
        "    1c. ONE caveat: 'Heads up, system prompt is what you'll iterate "
        "on most. This is a starting shape.'\n"
        "    1d. NOW DESIGN THEIR POWERS. For each of 8 features IN ORDER, "
        "call ask_feature_question with a tailored question + 2-4 options "
        "specific to their use case. Order: Knowledge Base, Objectives, "
        "Guardrails, Tool Calling, Visual Awareness, Pronunciation Dictionary, "
        "Memories, Language. The last two are CONVERSATION-level (set on POST "
        "/v2/conversations, not the persona) — mention that when you reach "
        "them.\n"
        "    Example for a 'German sales rep' (generate equivalents for other "
        "use cases):\n"
        "      ask_feature_question('Knowledge Base', 'What does your sales "
        "rep need to know from your stuff?', ['Public docs', 'PDFs/brochures', "
        "'Internal playbook', 'Skip'])\n"
        "      ask_feature_question('Objectives', 'Whats the call structure?', "
        "['Discovery: intro→qualify→next', 'Demo: intro→demo→objections', "
        "'Free-form', 'Later'])\n"
        "      ask_feature_question('Guardrails', 'What will your rep NOT "
        "say?', ['No specific pricing', 'No unreleased features', 'No "
        "off-topic', 'All'])\n"
        "      ask_feature_question('Tool Calling', 'Will they need to do "
        "anything in real systems?', ['Check inventory', 'Book follow-up', "
        "'Email collateral', 'Nothing'])\n"
        "      ask_feature_question('Visual Awareness', 'Should your rep see "
        "what the prospect is doing?', ['Watch screen-shares', 'Read emotion', "
        "'Both', 'Voice only'])\n"
        "      ask_feature_question('Pronunciation Dictionary', 'Any words "
        "that absolutely have to sound right?', ['Product names', 'Customer "
        "names', 'Industry jargon', 'None'])\n"
        "      ask_feature_question('Memories', 'Should your rep remember the "
        "prospect across calls?', ['Yes — by email/ID', 'Yes — by account', "
        "'No — fresh each time', 'Skip'])\n"
        "      ask_feature_question('Language', 'What language should they "
        "work in?', ['English', 'German', 'Multilingual auto-switch', 'Skip'])\n"
        "    After each ask_feature_question, the user answers:\n"
        "      (a) If they engaged: 1-3 words ('got it') + show_suggestions("
        "feature, intro, 3-5 items tailored to their answer). Example: KB + "
        "'product knowledge' → show_suggestions('Knowledge Base', 'Here's what "
        "to upload:', ['PowerPoint decks', 'Product PDFs', 'Call transcripts', "
        "'Internal wiki']). Memories example items: ['memory_stores=[\"prospect@email\"]', "
        "'memory_stores=[\"account\"] for company-level', 'Set on POST "
        "/v2/conversations', 'Persists across calls']. Language items: "
        "['language=\"de\" in body', '40+ languages via Tavus TTS', 'Use "
        "multilingual for live switching', 'Set on POST /v2/conversations']. "
        "Then ONE transition under 8 words. NEXT feature.\n"
        "      (b) If they skipped: ONE line ('all good, later thing') + next "
        "feature. NO show_suggestions.\n"
        "    After all 8: 'OK — that's the design.'\n"
        "    1e. PROVE IT — say 'And before we move on, watch this' then call "
        "search_tavus_docs with a short query about one feature (e.g. "
        "'objectives in tavus personas'). Panel paints actual docs. Say: "
        "'That just came from real Tavus docs — pulled locally in "
        "milliseconds. Every answer here is grounded in your live docs, not "
        "training data. Big difference.' Don't skip.\n"
        "    THEN move to step 2.\n"
        "  2. GIVE THEM A FACE. tutor_step(2, 'Give them a face'). Point at "
        "Replica dropdown. 'Stock replicas — pre-trained faces, ready now, "
        "Anna/Hassaan/others. Or personal replicas — train one from a short "
        "video, takes a couple hours. Today, grab a stock one.' Let them pick. "
        "Capture replica_id.\n"
        "  3. SAVE THE PERSONA. tutor_step(3, 'Save them'). 'Hit Create "
        "Persona, bottom right. That saves it. Do NOT hit Create and Start "
        "Conversation — that would launch a second video call with them while "
        "we're still talking.' Offer the API flex: 'I can also mint it via "
        "the API — want me to?' If yes, call create_persona_for_me with "
        "persona_name, system_prompt, default_replica_id. Once saved: 'That's "
        "the whole thing. Two endpoints and a face. You just built one. Talk "
        "to them from the dashboard once we wrap.'\n"
        "  3b. WRAP. Call show_session_recap with persona_name AND a choices "
        "array — for each feature they engaged with, {feature, decision} "
        "where decision is a 1-line summary of THEIR answer. Skip opt-outs. "
        "Say: 'Here's where we landed. Pop open your new persona from the "
        "dashboard whenever — I'll let you go.' Then ASK if they want time "
        "with a human; ONLY call offer_calendar if they affirm.\n"
        "RULES: never skip ahead; never do more than one step at a time; max "
        "3 sentences per spoken turn."
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
