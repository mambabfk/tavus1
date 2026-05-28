"""
Configure the Raven perception layer on a Tavus persona for screen-share
troubleshooting (Levels 1-3).

Adds, via a safe GET-then-merge PATCH (preserves existing perception fields):
  - visual_awareness_queries     (continuous screen awareness, fed to the LLM)
  - perception_analysis_queries  (end-of-call summary of what was diagnosed)
  - audio_awareness_queries      (detect frustration/confusion -> empathetic tone)
  - visual_tool_prompt + visual_tools (capture_screen_issue: fires when an error
        is visible; bridge.py handles the event, looks up docs, injects a fix)
  - audio_tool_prompt + audio_tools  (escalate_to_human on sustained frustration)

These enrich the context the LLM already receives (no extra LLM round-trip for
awareness queries), so they don't add per-turn latency.

Usage:
    export TAVUS_API_KEY=...
    python configure_perception.py [persona_id]     # defaults to PERSONA_ID env / id below
"""

import os
import sys

import httpx

API = "https://tavusapi.com/v2"
PERSONA_ID = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PERSONA_ID", "p4c0064ebf72")
API_KEY = os.environ.get("TAVUS_API_KEY", "")

PERCEPTION = {
    "perception_model": "raven-1",
    "visual_awareness_queries": [
        "What page, form, or panel is currently visible on screen? Give its title or main heading.",
        "On the New Persona form (if visible): is the System Prompt field filled in? If yes, briefly summarize what it says. If empty, say 'empty'.",
        "On the New Persona form (if visible): which Replica is selected in the dropdown, and is the Persona Name field filled in?",
        "Has the user moved past the New Persona form — are they now in a live Tavus conversation room with their new agent?",
    ],
    "perception_analysis_queries": [
        "What problem or task was the user working on, based on what was shown on screen?",
        "Were any errors, failed requests, or misconfigurations visible during the call?",
    ],
    "audio_awareness_queries": [
        "Has the user explicitly asked to talk to a human, book a call, or see a calendar?",
        "Is the user expressing clear distress about the product (not just thinking out loud or pausing)?",
    ],
    "visual_tool_prompt": (
        "You have two tools. Call `describe_screen` whenever the user is actively looking at, "
        "working on, pointing to, or asking about something on their shared screen, so the "
        "system can read the screen precisely. Call `capture_screen_issue` specifically when an "
        "error, stack trace, failed request, or misconfiguration is visible."
    ),
    "visual_tools": [
        {
            "type": "function",
            "function": {
                "name": "describe_screen",
                "description": (
                    "Call whenever the user is engaging with their shared screen (working on it, "
                    "pointing at it, or asking what you see) so the system can read it precisely."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "focus": {
                            "type": "string",
                            "description": "What the user seems focused on right now.",
                            "maxLength": 1000,
                        }
                    },
                    "required": ["focus"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "capture_screen_issue",
                "description": (
                    "Call when an error, stack trace, failed request, or misconfiguration "
                    "is visible on the user's shared screen, so the system can look up a fix."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "summary": {
                            "type": "string",
                            "description": "Concise description of what looks wrong on screen.",
                            "maxLength": 1000,
                        }
                    },
                    "required": ["summary"],
                },
            },
        },
    ],
    "audio_tool_prompt": (
        "You have a tool named `escalate_to_human`. Call it ONLY when the user sounds "
        "genuinely stuck or distressed across multiple turns (not normal pauses, thinking "
        "out loud, or mild confusion). When you call it, it does NOT pull up a calendar — "
        "it simply nudges the persona to ASK the user whether they'd like to schedule a "
        "call with a human. Do not call it for every signal of confusion. When in doubt, "
        "do NOT call it."
    ),
    "audio_tools": [
        {
            "type": "function",
            "function": {
                "name": "escalate_to_human",
                "description": (
                    "Fires when the user sounds genuinely stuck so the persona can check "
                    "in. Does not surface a calendar — the persona must ask the user, and "
                    "only then call the `offer_calendar` tool if the user agrees."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {
                            "type": "string",
                            "description": "Why the user seems stuck.",
                            "maxLength": 1000,
                        }
                    },
                    "required": ["reason"],
                },
            },
        }
    ],
}


def main() -> None:
    if not API_KEY:
        sys.exit("Set TAVUS_API_KEY first: export TAVUS_API_KEY=...")
    headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}

    r = httpx.get(f"{API}/personas/{PERSONA_ID}", headers=headers, timeout=30)
    r.raise_for_status()
    persona = r.json()
    layers = persona.get("layers", {}) or {}

    # Merge over any existing perception config so we don't drop fields we don't set.
    merged = dict(layers.get("perception", {}) or {})
    merged.update(PERCEPTION)

    op = "replace" if "perception" in layers else "add"
    patch = [{"op": op, "path": "/layers/perception", "value": merged}]

    p = httpx.patch(f"{API}/personas/{PERSONA_ID}", headers=headers, json=patch, timeout=30)
    if p.status_code == 304:
        print(f"Perception already up to date on persona {PERSONA_ID} (no change needed).")
        return
    if p.status_code >= 400:
        sys.exit(f"PATCH failed ({p.status_code}): {p.text}")
    print(f"Configured perception (raven-1) on persona {PERSONA_ID}.")
    print("Screen share is on by default; awareness queries now feed the LLM each turn.")
    print("Run bridge.py to handle capture_screen_issue / escalate_to_human tool calls.")


if __name__ == "__main__":
    main()
