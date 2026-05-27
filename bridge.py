"""
Tool-call bridge for a Tavus CVI persona <-> the local docs server.

Tavus does not execute tool calls itself: when the persona's LLM calls a tool,
Tavus emits a `conversation.tool_call` event over the conversation's WebRTC data
channel (Daily). This headless client joins the conversation, listens for that
event, queries the local docs server (server.py) for the answer context, and
injects it back so the replica can answer — no frontend required.

Flow:
    user speaks -> Tavus LLM emits conversation.tool_call (search_tavus_docs)
    -> this bridge calls POST {DOCS_SERVER_URL}/ask
    -> bridge sends the docs back via conversation.append_llm_context (default)
    -> the replica answers using the docs.

Setup:
    pip install -r requirements.txt        # includes daily-python
    export TAVUS_API_KEY=...               # to create a conversation, OR
    #   provide an existing room with CONVERSATION_URL + CONVERSATION_ID
    export PERSONA_ID=p...                  # persona must define the tool (see README)
    export REPLICA_ID=r...                  # optional; uses persona default otherwise
    python bridge.py

The persona's layers.llm.tools must include a function named like TOOL_NAME
(default: search_tavus_docs) with a single string `query` parameter. See README.
"""

import os
import sys
import json
import time
import base64
import signal
import pathlib
import threading

import httpx
from daily import CallClient, Daily, EventHandler

DOCS_SERVER_URL = os.environ.get("DOCS_SERVER_URL", "http://localhost:8800").rstrip("/")
TOOL_NAME = os.environ.get("TOOL_NAME", "search_tavus_docs")
RESULT_MODE = os.environ.get("RESULT_MODE", "append_llm_context")  # or: respond | echo
TOP_K = int(os.environ.get("TOP_K", "3"))
TAVUS_API_KEY = os.environ.get("TAVUS_API_KEY", "")
PERSONA_ID = os.environ.get("PERSONA_ID", "")
REPLICA_ID = os.environ.get("REPLICA_ID", "")
CONVERSATION_URL = os.environ.get("CONVERSATION_URL", "")
CONVERSATION_ID = os.environ.get("CONVERSATION_ID", "")
SAVE_FRAMES = os.environ.get("SAVE_FRAMES", "false").lower() in ("1", "true", "yes")
FRAMES_DIR = os.environ.get("FRAMES_DIR", "frames")


def create_conversation() -> tuple[str, str]:
    """Create a Tavus conversation and return (conversation_url, conversation_id)."""
    if not TAVUS_API_KEY or not PERSONA_ID:
        sys.exit(
            "Set CONVERSATION_URL + CONVERSATION_ID to join an existing room, "
            "or TAVUS_API_KEY + PERSONA_ID to create one."
        )
    body = {"persona_id": PERSONA_ID}
    if REPLICA_ID:
        body["replica_id"] = REPLICA_ID
    r = httpx.post(
        "https://tavusapi.com/v2/conversations",
        headers={"x-api-key": TAVUS_API_KEY, "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    return data["conversation_url"], data["conversation_id"]


# Reused keep-alive connection so each lookup skips TCP/handshake setup.
_docs = httpx.Client(base_url=DOCS_SERVER_URL, timeout=10)


def fetch_docs(query: str) -> str:
    import time

    t0 = time.perf_counter()
    r = _docs.post("/ask", json={"query": query, "top_k": TOP_K})
    r.raise_for_status()
    ctx = r.json().get("context", "")
    print(f"[bridge] docs lookup {(time.perf_counter() - t0) * 1000:.0f}ms, {len(ctx)} chars")
    return ctx


def build_result_message(conversation_id: str, context: str) -> dict:
    if RESULT_MODE == "echo":
        return {
            "message_type": "conversation",
            "event_type": "conversation.echo",
            "conversation_id": conversation_id,
            "properties": {"modality": "text", "text": context, "done": True},
        }
    if RESULT_MODE == "respond":
        return {
            "message_type": "conversation",
            "event_type": "conversation.respond",
            "conversation_id": conversation_id,
            "properties": {"text": context},
        }
    # default: inject as LLM context; the replica answers using it without reading it aloud
    return {
        "message_type": "conversation",
        "event_type": "conversation.append_llm_context",
        "conversation_id": conversation_id,
        "properties": {"context": context},
    }


def parse_tool_call(props: dict) -> tuple[str, dict]:
    """Return (tool_name, arguments_dict) from a tool_call event's properties."""
    name = props.get("name") or props.get("function", {}).get("name", "")
    raw_args = props.get("arguments", props.get("function", {}).get("arguments", "{}"))
    if isinstance(raw_args, str):
        try:
            args = json.loads(raw_args or "{}")
        except json.JSONDecodeError:
            args = {}
    else:
        args = raw_args or {}
    return name, args


class Bridge(EventHandler):
    def __init__(self, conversation_id: str):
        super().__init__()
        self.conversation_id = conversation_id
        self.client: CallClient | None = None

    def on_app_message(self, message, sender: str) -> None:
        if not isinstance(message, dict):
            return
        event_type = message.get("event_type")
        if event_type == "conversation.tool_call":
            self.handle_llm_tool(message)
        elif event_type == "conversation.perception_tool_call":
            self.handle_perception_tool(message)

    def _inject(self, message, context: str) -> None:
        conv_id = message.get("conversation_id") or self.conversation_id
        if self.client:
            self.client.send_app_message(build_result_message(conv_id, context))
            print(f"[bridge] injected {len(context)} chars via {RESULT_MODE}")

    def handle_llm_tool(self, message: dict) -> None:
        props = message.get("properties", {}) or {}
        name, args = parse_tool_call(props)
        if name != TOOL_NAME:
            print(f"[bridge] ignoring LLM tool '{name}' (waiting for '{TOOL_NAME}')")
            return
        query = args.get("query") or args.get("q") or ""
        print(f"[bridge] tool_call {name}(query={query!r})")
        if not query:
            return
        try:
            context = fetch_docs(query)
        except Exception as e:
            print(f"[bridge] docs server error: {e}", file=sys.stderr)
            context = f"Documentation lookup failed for: {query}"
        self._inject(message, context)

    def handle_perception_tool(self, message: dict) -> None:
        props = message.get("properties", {}) or {}
        name, args = parse_tool_call(props)
        modality = props.get("modality") or message.get("modality") or "?"
        print(f"[bridge] perception_tool_call {name} modality={modality} args={args}")
        if SAVE_FRAMES:
            self._save_frames(props.get("frames") or message.get("frames") or [])
        if name == "capture_screen_issue":
            issue = args.get("summary") or args.get("reason") or ""
            if not issue:
                return
            try:
                docs = fetch_docs(f"troubleshoot: {issue}")
            except Exception as e:
                print(f"[bridge] docs server error: {e}", file=sys.stderr)
                docs = ""
            context = (
                f"The user appears to have this issue visible on their screen: {issue}\n\n"
                f"Relevant Tavus documentation:\n{docs}"
            )
            self._inject(message, context)
        elif name == "escalate_to_human":
            print(f"[bridge] ESCALATION requested: {args.get('reason')!r}  "
                  "(hook your own escalation here)")

    def _save_frames(self, frames: list) -> None:
        if not frames:
            return
        d = pathlib.Path(FRAMES_DIR)
        d.mkdir(exist_ok=True)
        ts = int(time.time() * 1000)
        for i, f in enumerate(frames):
            try:
                raw = base64.b64decode(str(f).split(",")[-1])
                (d / f"frame_{ts}_{i}.jpg").write_bytes(raw)
            except Exception as e:
                print(f"[bridge] frame save error: {e}", file=sys.stderr)
        print(f"[bridge] saved {len(frames)} frame(s) to {FRAMES_DIR}/")


def main() -> None:
    if CONVERSATION_URL:
        url, conv_id = CONVERSATION_URL, CONVERSATION_ID
        if not conv_id:
            sys.exit("CONVERSATION_URL was given without CONVERSATION_ID.")
    else:
        url, conv_id = create_conversation()
        print("\n=== Open this URL in your browser to talk to the persona ===")
        print(url)
        print("============================================================\n")

    # Verify the docs server is reachable before joining.
    try:
        h = httpx.get(f"{DOCS_SERVER_URL}/health", timeout=5).json()
        print(f"[bridge] docs server: {h}")
    except Exception as e:
        sys.exit(f"Docs server not reachable at {DOCS_SERVER_URL} ({e}). Start server.py first.")

    Daily.init()
    handler = Bridge(conv_id)
    client = CallClient(event_handler=handler)
    handler.client = client
    client.join(url)
    print(f"[bridge] joined conversation {conv_id}; listening for '{TOOL_NAME}' tool calls.")

    stop = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    stop.wait()

    print("\n[bridge] leaving conversation.")
    client.leave()
    Daily.deinit()


if __name__ == "__main__":
    main()
