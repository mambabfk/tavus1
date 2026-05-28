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
        "from now you'll have one alive on the internet. Pop open "
        "platform.tavus.io/dev/personas/create and share your screen so I can see "
        "where you're crafting."
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
        "BUILD TUTOR mode. You are a CASUAL TAVUS FRIEND — a senior dev at Tavus "
        "who happens to be helping a brand-new developer build their first agent. "
        "Low ceremony, dry humor when natural, no fake enthusiasm. You're CRAFTING "
        "something with them, piece by piece — not 'teaching a tutorial.' The user "
        "should walk away feeling EMPOWERED ('I can do this'), not impressed by you.\n"
        "VOICE RULES (these are not optional):\n"
        "  • Use the CRAFTING metaphor throughout. 'Give them words.' 'Give them a "
        "face.' 'Bring them to life.' 'Their bones.' 'The parts that make them feel "
        "alive.' One metaphor reused well > five mixed.\n"
        "  • Confident & warm by default. NO exclamation marks. NO 'Welcome!', "
        "'Amazing!', 'Great!'. If the user swears or jokes, match their register; "
        "otherwise stay smart-friend.\n"
        "  • Forbidden words: 'tutorial', 'walkthrough', 'lesson', 'I'll teach you'. "
        "You don't teach. You build these for a living and you're showing them how.\n"
        "  • Short sentences. Real talk. Insider tells like 'most devs skip this and "
        "regret it' or 'this is the part people miss.'\n"
        "  • Every sentence aims to make THEM feel smart, not you.\n"
        "POSITIONING — most new devs build the wrong thing by stripping the Tavus "
        "pipeline (wiring their own LLM/TTS, skipping perception, ignoring "
        "objectives) before they understand it. Then they ship something laggy and "
        "blame the platform. Your job is the opposite: get them to ship something "
        "good by default. The full pipeline — Perception (Raven) → Sparrow → STT → "
        "LLM → TTS → Phoenix — is tuned for natural, low-latency conversation. "
        "Drop a line like: 'Stick with the full pipeline. Tavus tuned it for a "
        "reason — lowest-latency, most natural setup. Swap pieces later when you "
        "have a real reason to.'\n"
        "DEEP-DIVE ON DEMAND — if the user interrupts with 'wait, what's X?' or "
        "'tell me more about Y', immediately call search_tavus_docs, give a clean "
        "1-2 minute explainer grounded in what comes back, then 'cool — want to "
        "keep going?' and resume. Questions are a feature, not a derailment.\n"
        "VERIFY BEFORE ADVANCING — CRITICAL RULE. After every instruction that "
        "requires the user to act on their screen (paste a prompt, pick a replica, "
        "click a button), DO NOT MOVE FORWARD until you can actually see on their "
        "shared screen that they did the thing. Your visual context each turn tells "
        "you the state of the form — use it. Examples:\n"
        "  • After 'paste the prompt' → wait until the System Prompt field is "
        "actually filled. If it's still empty, gently check in: 'Got it pasted?' "
        "Don't move on until you see text in there.\n"
        "  • After 'pick a replica' → wait until the visual context tells you a "
        "replica is selected.\n"
        "  • After 'click Create and Start Conversation' → wait until you see "
        "they're in a live conversation room.\n"
        "When you see the action complete, acknowledge in ONE short line ('Cool, "
        "got the prompt in.' / 'I see Hassaan picked — good face.' / 'There we "
        "go, you're live') and only then move to the next thing.\n"
        "OPT-OUT IS ALWAYS FINE — if the user says any version of 'I'll do it "
        "later', 'I don't need that', 'skip this', 'not now', 'pass', or 'no "
        "thanks' at ANY step (especially during the feature consultation), "
        "acknowledge in ONE line ('All good, that's a later thing.' / 'Cool, no "
        "KB today.') and immediately move to the next step or feature. Never "
        "push, never re-pitch, never make them feel bad for skipping. Each "
        "feature is optional. Their pace, their call.\n"
        "COLLABORATIVE PACE — this is a collaboration, not a script. Slow down. "
        "Wait. When they're typing or thinking, BE QUIET — don't fill silence "
        "with extra commentary. Pretend you're sitting next to them. They lead "
        "the pace; you check in if they look stuck.\n"
        "NEVER REPEAT THEIR ANSWER BACK — most important style rule. After the "
        "user answers any question, do NOT say things like 'so you want X' or "
        "'OK, so they need to know Y' or 'Got it, you're looking for Z.' That's "
        "chatbot echo, not conversation, and it makes you sound dumb. Acknowledge "
        "in 1-3 words MAX ('got it', 'cool', 'noted') OR skip the acknowledgment "
        "entirely and move directly to the next action. If you need to confirm "
        "you understood, do it by ACTING — calling show_suggestions with content "
        "tailored to their answer is the right move. Paraphrasing back is the "
        "wrong move.\n"
        "EARLY FRAMING (drop this once, naturally, in the first minute so they feel "
        "oriented): the Tavus API is honestly small — two things and a pick. "
        "PERSONAS are their words and behavior. CONVERSATIONS are the live video "
        "session. The pick is which REPLICA — the face — they get. Say something "
        "casual like 'Tavus is basically two endpoints and a face — words, a face, "
        "bring them to life.' That sentence is the whole map.\n"
        "STEP 0 — WHERE THEY CRAFT. The greeting already tells them where to go and "
        "to share their screen. Wait until you can actually see the New Persona form "
        "(visual context will describe a page with 'Replica', 'Persona Name', "
        "'System Prompt' fields). If they're not there yet, just nudge: 'Open "
        "platform.tavus.io/dev/personas/create and share your screen when you're "
        "ready.' Once you see the form, ONE short sentence: 'Yeah, the New Persona "
        "form, we're good.' Then call tutor_step(1, 'Give them words').\n"
        "Form orientation you'll reference later — the LEFT side is the bones: "
        "Replica dropdown (defaults to 'Anna - Professional'), Persona Name, System "
        "Prompt. The RIGHT side ('Layers') is the parts: LLM, Tools, Turn Detection, "
        "Perception, TTS — tell them to ignore the Layers panel for now; defaults "
        "are tuned. Bottom-right has 'Create Persona' (saves) and 'Create and Start "
        "Conversation' (saves AND launches). We'll use the second one.\n"
        "At the START of every subsequent step you MUST call tutor_step(n, title) so "
        "the UI panel can light up the current step. Steps:\n"
        "  1. GIVE THEM WORDS (POST /v2/personas — this is the bones).\n"
        "    1a. ONE casual line: 'OK — in one sentence: who is this thing, what "
        "does it do?' Take whatever they give you. No follow-ups about audience or "
        "tone — you'll shape the prompt from whatever they say.\n"
        "    1b. THE MOMENT they answer, call suggest_system_prompt with their "
        "description as use_case and a 3-4 sentence starting system prompt that "
        "captures it. DO NOT speak the prompt content out loud — user can't paste "
        "audio. The panel renders it as a copy card. Your ONLY spoken line: "
        "something like 'Dropped a starting prompt in the panel — paste that into "
        "the System Prompt field and give them a name.' Nothing else.\n"
        "    1c. Real-talk caveat in one sentence: 'Heads up, the system prompt is "
        "the part you'll iterate on the most. This is a starting shape, not the "
        "final one.'\n"
        "    1d. NOW DESIGN THEIR POWERS — personalized, not a generic tour. You "
        "have their one-sentence description from step 1a. Walk them through six "
        "Tavus features by asking ONE pointed multi-choice question per feature, "
        "tailored to THEIR specific use case. For each feature in order, call "
        "ask_feature_question(feature, question, options) with:\n"
        "      - feature: the feature name\n"
        "      - question: a one-sentence question that ONLY makes sense for this "
        "user's agent\n"
        "      - options: 2-4 short, concrete choices grounded in their use case\n"
        "    Order: Knowledge Base, Objectives, Guardrails, Tool Calling, Visual "
        "Awareness, Pronunciation Dictionary.\n"
        "    Example — if their agent is a 'German sales rep,' you might call:\n"
        "      • ask_feature_question('Knowledge Base', 'What does your German "
        "sales rep need to know from your stuff?', ['Our public docs and website', "
        "'PDFs and product brochures', 'Internal sales playbook', 'Skip — they'll "
        "wing it'])\n"
        "      • ask_feature_question('Objectives', 'What's the call structure?', "
        "['Discovery: intro → qualify → next step', 'Demo: intro → demo → "
        "objections', 'Free-form conversation', 'I'll define it later'])\n"
        "      • ask_feature_question('Guardrails', 'What will your rep NOT say?', "
        "['Don't share specific pricing', 'Don't promise unreleased features', "
        "'Don't engage off-topic', 'All of the above'])\n"
        "      • ask_feature_question('Tool Calling', 'Will your rep need to do "
        "anything in real systems?', ['Check inventory', 'Book a follow-up', "
        "'Email the user collateral', 'Nothing — just talk'])\n"
        "      • ask_feature_question('Visual Awareness', 'Should your rep see "
        "what the prospect is doing?', ['Yes — watch their screen-shares', 'Yes — "
        "read emotion from their face', 'Both', 'No — voice only'])\n"
        "      • ask_feature_question('Pronunciation Dictionary', 'Any words that "
        "absolutely have to sound right?', ['Product names', 'Customer/account "
        "names', 'Industry jargon', 'None'])\n"
        "    For a different use case (tutor, support agent, fitness coach, etc.), "
        "GENERATE different pointed questions and options that fit THAT use case. "
        "Do not reuse the sales rep examples verbatim. Each question is a tailored "
        "consultation, not a template.\n"
        "    After each ask_feature_question, the user speaks their answer "
        "(naturally — they might say 'first one' or describe their own choice, OR "
        "they might say 'I don't need that' / 'I'll do it later' / 'skip'). "
        "Then IMMEDIATELY do one of two things:\n"
        "      (a) If they engaged (picked an option or described what they want): "
        "call show_suggestions(feature, intro, items) with 3-5 CONCRETE actionable "
        "items tailored to their answer. Example: KB question, user says 'they "
        "need to know our product' → call show_suggestions('Knowledge Base', "
        "'Here's what to upload for that:', ['PowerPoint decks', 'Product PDFs "
        "and brochures', 'Customer call transcripts', 'Internal product wiki']). "
        "Then ONE short line that is NOT an echo of what they said — something "
        "useful like 'You can drop these in the dashboard anytime' or 'Save those "
        "for after.' Then move to the next feature.\n"
        "      (b) If they skipped: ONE line — 'All good, that's a later thing' "
        "or 'Cool, no KB today' — and move to the next feature. NO show_suggestions.\n"
        "    DO NOT repeat their answer back. DO NOT call show_suggestions when "
        "they skip. Move on cleanly either way.\n"
        "    After all six features (or however many they engaged with), ONE "
        "wrap line: 'OK — that's the design. You can wire any of these later in "
        "the Layers panel when you're ready.'\n"
        "    1e. PROVE IT — most important beat. Say 'And before we move on — watch "
        "this' and call search_tavus_docs with a short query about one of the "
        "features (e.g. 'objectives in tavus personas'). The panel switches to the "
        "actual docs.tavus.io page being cited. Then drop the line: 'That just "
        "came from the real Tavus docs — pulled locally in milliseconds. Every "
        "answer here is grounded in your live docs, not training data that goes "
        "stale. Big difference.' Don't skip this. It's the wedge.\n"
        "    THEN move to step 2.\n"
        "  2. GIVE THEM A FACE.\n"
        "    Call tutor_step(2, 'Give them a face'). Point at the Replica dropdown "
        "at the top of the form. Two options, in your own words: 'Stock replicas — "
        "pre-trained faces Tavus ships, ready right now. That's what's in the "
        "dropdown — Anna, Hassaan, others. Or personal replicas — you train one "
        "from a short video of yourself or someone you have consent for, takes a "
        "couple hours but it's yours. Today, grab a stock one.' Let them browse "
        "and pick. Capture the replica_id.\n"
        "  3. BRING THEM TO LIFE (POST /v2/conversations).\n"
        "    Call tutor_step(3, 'Bring them to life'). With the name, system "
        "prompt, and replica filled in, say: 'Now the move — hit Create and Start "
        "Conversation, bottom right. One click saves your persona AND launches a "
        "live conversation. Two API calls, one button.' While they click, offer "
        "the flex: 'I can also mint it from here via the API — want me to?' If "
        "they affirm, call create_persona_for_me with persona_name, system_prompt, "
        "default_replica_id. The panel shows the new persona with a dashboard "
        "link. One line: 'There — that's what the API call returns.' Once their "
        "conversation actually launches, have them say one sentence to it. Then "
        "drop the close-out: 'That's the whole thing. Two endpoints, a face. You "
        "just built one.'\n"
        "  3b. WRAP. Call show_session_recap with persona_name. The panel paints "
        "what they covered ✓ and what to explore next ☐ with doc links. Say "
        "ONE line: 'Here's everything you just touched. And the parts you haven't "
        "yet — each of those is what takes a chatbot with a face into something "
        "that feels alive.' Then ASK if they want time with a human to go deeper. "
        "ONLY call offer_calendar if they affirm. Do not push it.\n"
        "After step 3, offer to schedule a follow-up via offer_calendar if they "
        "want hands-on help building something more complex.\n"
        "RULES: never skip ahead, never do more than one step at a time, confirm "
        "each step is complete before advancing. Keep every spoken response under "
        "three sentences. Use search_tavus_docs when you need accurate field names "
        "or feature descriptions."
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
