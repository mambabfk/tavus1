"""
Set the persona's LLM model (default: tavus-claude-haiku-4.5).

Docs flag tavus-claude-haiku-4.5 as "grounded, fewer hallucinations" — a better
fit than the default tavus-gpt-oss for a persona that must reason about user
state and call tools reliably (tutor mode, screen perception, etc.).

Usage:
    export TAVUS_API_KEY=...
    python set_model.py [persona_id]                 # uses default model
    LLM_MODEL=tavus-gemini-2.5-flash python set_model.py     # override
"""

import os
import sys

import httpx

API = "https://tavusapi.com/v2"
PERSONA_ID = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PERSONA_ID", "p4c0064ebf72")
API_KEY = os.environ.get("TAVUS_API_KEY", "")
MODEL = os.environ.get("LLM_MODEL", "tavus-claude-haiku-4.5")


def main() -> None:
    if not API_KEY:
        sys.exit("Set TAVUS_API_KEY first: export TAVUS_API_KEY=...")
    headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}

    r = httpx.get(f"{API}/personas/{PERSONA_ID}", headers=headers, timeout=30)
    r.raise_for_status()
    persona = r.json()
    layers = persona.get("layers", {}) or {}
    llm = layers.get("llm", {}) or {}
    current = llm.get("model")
    if current == MODEL:
        print(f"Persona {PERSONA_ID} already uses {MODEL}.")
        return

    if "llm" not in layers:
        patch = [{"op": "add", "path": "/layers/llm", "value": {"model": MODEL}}]
    elif "model" in llm:
        patch = [{"op": "replace", "path": "/layers/llm/model", "value": MODEL}]
    else:
        patch = [{"op": "add", "path": "/layers/llm/model", "value": MODEL}]

    p = httpx.patch(f"{API}/personas/{PERSONA_ID}", headers=headers, json=patch, timeout=30)
    if p.status_code == 304:
        print(f"Persona {PERSONA_ID} model already up to date.")
        return
    if p.status_code >= 400:
        sys.exit(f"PATCH failed ({p.status_code}): {p.text}")
    print(f"Set persona {PERSONA_ID} LLM model to {MODEL} (was {current!r}).")


if __name__ == "__main__":
    main()
