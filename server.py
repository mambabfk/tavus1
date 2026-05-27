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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rank_bm25 import BM25Okapi

DOCS_DIR = os.environ.get("DOCS_DIR", os.path.join(os.path.dirname(__file__), "docs_store"))
DOCS_BASE = os.environ.get("TAVUS_DOCS_BASE", "https://docs.tavus.io")
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
    top_k: int = 5


def _format_context(query: str, results: list[dict]) -> str:
    if not results:
        return f"No Tavus documentation was found for: {query!r}."
    parts = [f"Tavus documentation relevant to: {query}\n"]
    for n, r in enumerate(results, 1):
        src = f" ({r['url']})" if r["url"] else ""
        parts.append(f"[{n}] {r['title']}{src}\n{r['text']}\n")
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


@app.post("/reload")
def reload() -> dict:
    """Re-read docs_store/ from disk (after a fresh scrape)."""
    index.num_pages = 0
    index.load()
    return {"status": "reloaded", "pages": index.num_pages, "chunks": len(index.chunks)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
