"""
Add the `search_tavus_docs` tool to a Tavus persona's LLM layer.

Fetches the persona, merges the tool into any existing layers.llm.tools (without
clobbering others), and PATCHes it back. Idempotent — running twice is a no-op.

Usage:
    pip install httpx          # (already in requirements.txt)
    export TAVUS_API_KEY=...
    python add_tool.py [persona_id]      # defaults to PERSONA_ID env or the id below
"""

import os
import sys

import httpx

API = "https://tavusapi.com/v2"
PERSONA_ID = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PERSONA_ID", "p4c0064ebf72"))
API_KEY = os.environ.get("TAVUS_API_KEY", "")

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_tavus_docs",
            "description": (
                "Look up Tavus documentation to answer questions about CVI, personas, "
                "replicas, conversations, the API, and integrations. Call this before "
                "answering any question about how Tavus works."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The user's question about Tavus, in natural language.",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "offer_calendar",
            "description": (
                "Use this ONLY AFTER the user has explicitly agreed or confirmed that "
                "they want to schedule time with a human (e.g. they said 'yes', 'sure', "
                "'please do', 'send me your calendar'). Do NOT call this proactively or "
                "just because the user is stuck — first ASK them out loud: 'Want me to "
                "pull up my calendar so you can grab time?' and only call this tool once "
                "they affirm. The reason field captures what they want to discuss."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "What the user wants to discuss with a human.",
                    }
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tutor_step",
            "description": (
                "BUILD TUTOR MODE ONLY. Call this at the START of each step of the "
                "5-step tutor flow so the UI panel can light up the current step. Pass "
                "the step number (1 through 5) and a short title. Do NOT call this in "
                "Solutions Engineer mode."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "n": {
                        "type": "integer",
                        "description": "Step number, 1 through 5.",
                    },
                    "title": {
                        "type": "string",
                        "description": "Short title for this step (e.g. 'Pick a replica').",
                    },
                },
                "required": ["n", "title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_persona_for_me",
            "description": (
                "BUILD TUTOR MODE ONLY. Call AFTER the user has completed all 5 tutor "
                "steps. Creates a real Tavus persona reflecting the user's choices via "
                "the Tavus API. Do NOT call this in Solutions Engineer mode and do NOT "
                "call it before step 5 is complete."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "persona_name": {
                        "type": "string",
                        "description": "Name for the new persona (the user's choice or a sensible default).",
                    },
                    "system_prompt": {
                        "type": "string",
                        "description": "The 3-sentence system prompt the user wrote with your help.",
                    },
                    "default_replica_id": {
                        "type": "string",
                        "description": "Stock replica id the user picked (e.g. r90bbd427f71). Optional.",
                    },
                },
                "required": ["persona_name", "system_prompt"],
            },
        },
    },
]


def main() -> None:
    if not API_KEY:
        sys.exit("Set TAVUS_API_KEY first: export TAVUS_API_KEY=...")
    headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}

    r = httpx.get(f"{API}/personas/{PERSONA_ID}", headers=headers, timeout=30)
    r.raise_for_status()
    persona = r.json()

    layers = persona.get("layers", {}) or {}
    llm = layers.get("llm", {}) or {}
    tools = list(llm.get("tools", []) or [])

    names = {t.get("function", {}).get("name") for t in tools if isinstance(t, dict)}
    if "search_tavus_docs" in names:
        print(f"Persona {PERSONA_ID} already has search_tavus_docs. Nothing to do.")
        return
    tools.append(TOOL)

    if "llm" not in layers:
        patch = [{"op": "add", "path": "/layers/llm", "value": {"tools": tools}}]
    elif "tools" in llm:
        patch = [{"op": "replace", "path": "/layers/llm/tools", "value": tools}]
    else:
        patch = [{"op": "add", "path": "/layers/llm/tools", "value": tools}]

    p = httpx.patch(f"{API}/personas/{PERSONA_ID}", headers=headers, json=patch, timeout=30)
    if p.status_code == 304:
        print(f"Tool already up to date on persona {PERSONA_ID} (no change needed).")
        return
    if p.status_code >= 400:
        sys.exit(f"PATCH failed ({p.status_code}): {p.text}")
    print(f"Added search_tavus_docs to persona {PERSONA_ID}. Tool count is now {len(tools)}.")
    print("Tip: also add to the persona's system prompt: "
          "'When asked about Tavus, call search_tavus_docs before answering.'")


if __name__ == "__main__":
    main()
