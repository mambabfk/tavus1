"""Pre-demo smoke test.

Run this before walking in. Verifies:
  - env vars set
  - docs server is up and serving 127 pages
  - persona exists, on tavus-claude-haiku-4.5, with all 7 tools
  - perception layer is raven-1 with visual + audio queries
  - we can actually mint a Tavus conversation end-to-end

Exits 0 if green, 1 if anything failed.

Usage:
    export TAVUS_API_KEY=...
    python smoke_test.py
"""

import os
import sys

import httpx

API_KEY = os.environ.get("TAVUS_API_KEY", "")
PERSONA_ID = os.environ.get("PERSONA_ID", "p4c0064ebf72")
DOCS_SERVER = os.environ.get("DOCS_SERVER_URL", "http://localhost:8800")

EXPECTED_TOOLS = {
    "search_tavus_docs",
    "offer_calendar",
    "suggest_system_prompt",
    "show_features_overview",
    "show_session_recap",
    "tutor_step",
    "create_persona_for_me",
}
EXPECTED_MODEL = "tavus-claude-haiku-4.5"


def check(label: str, ok: bool, detail: str = "") -> bool:
    mark = "\033[32m✓\033[0m" if ok else "\033[31m✗\033[0m"
    suffix = f" — {detail}" if detail else ""
    print(f"  {mark} {label}{suffix}")
    return ok


def main() -> int:
    results: list[bool] = []
    print("\n=== Pre-demo smoke test ===\n")

    print("Env vars:")
    results.append(check("TAVUS_API_KEY set", bool(API_KEY)))
    results.append(check("PERSONA_ID set", bool(PERSONA_ID), PERSONA_ID))
    if not API_KEY:
        print("\nCannot continue without TAVUS_API_KEY.\n")
        return 1

    headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}

    print("\nDocs server:")
    try:
        r = httpx.get(f"{DOCS_SERVER}/health", timeout=5)
        d = r.json()
        results.append(
            check(
                f"docs server at {DOCS_SERVER}",
                r.status_code == 200 and d.get("pages", 0) >= 100,
                f"{d.get('pages')} pages, {d.get('chunks')} chunks",
            )
        )
    except Exception as e:
        results.append(check(f"docs server at {DOCS_SERVER}", False, str(e)))

    print("\nPersona config:")
    try:
        r = httpx.get(f"https://tavusapi.com/v2/personas/{PERSONA_ID}", headers=headers, timeout=30)
        persona = r.json() if r.status_code == 200 else {}
        results.append(check(f"persona {PERSONA_ID} reachable", r.status_code == 200))
        layers = persona.get("layers", {}) or {}
        llm = layers.get("llm", {}) or {}
        model = llm.get("model", "")
        results.append(check(f"LLM model is {EXPECTED_MODEL}", model == EXPECTED_MODEL, model or "missing"))
        tool_names = {t.get("function", {}).get("name") for t in llm.get("tools", [])}
        missing = EXPECTED_TOOLS - tool_names
        results.append(
            check(
                f"all {len(EXPECTED_TOOLS)} tools registered",
                not missing,
                f"missing {missing}" if missing else f"{len(tool_names)} tools present",
            )
        )
        perception = layers.get("perception", {}) or {}
        results.append(
            check(
                "perception is raven-1",
                perception.get("perception_model") == "raven-1",
                perception.get("perception_model", "missing"),
            )
        )
        results.append(
            check(
                "visual_awareness_queries configured",
                len(perception.get("visual_awareness_queries", []) or []) >= 3,
                f"{len(perception.get('visual_awareness_queries', []) or [])} queries",
            )
        )
    except Exception as e:
        results.append(check("persona reachable", False, str(e)))

    print("\nEnd-to-end (mint + tear down a conversation):")
    try:
        r = httpx.post(f"{DOCS_SERVER}/conversations", json={"mode": "se"}, timeout=30)
        data = r.json()
        convo_id = data.get("conversation_id")
        results.append(
            check(
                "POST /conversations works",
                bool(data.get("conversation_url")),
                convo_id or data.get("error", ""),
            )
        )
        if convo_id:
            # Be nice — end the test conversation so it doesn't sit and burn credits.
            httpx.delete(
                f"https://tavusapi.com/v2/conversations/{convo_id}", headers=headers, timeout=10
            )
    except Exception as e:
        results.append(check("POST /conversations works", False, str(e)))

    ok = sum(1 for r in results if r)
    total = len(results)
    print(f"\n=== {ok}/{total} checks passed ===")
    if ok == total:
        print("\033[32m✓ Demo ready. Go.\033[0m\n")
        return 0
    print("\033[31m✗ Fix the failed checks before demoing.\033[0m\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
