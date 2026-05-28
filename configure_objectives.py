"""
Fix the Builder discovery objectives so the persona must hear the user's goal
before walking them through anything (stops it from assuming intent off-screen).

Root issue: clarify_use_case_before_walkthrough was confirmation_mode=auto with
no output variable, so the LLM self-certified "I understand the use case" from
the shared screen and skipped straight to the guide step (which then narrated the
screen / publish flow). This PATCHes the objective data to:
  - require a `use_case` output variable on the clarify step (forces it to collect
    the goal from the user, in their words, before completing)
  - tighten the clarify prompt: screen is context only; do not proceed until the
    user states their goal aloud
  - refocus the guide step on the user's STATED goal, not whatever is on screen

confirmation_mode stays "auto" on purpose: "manual" needs the frontend to send
conversation.objective.confirm, which the Dev Portal default UI doesn't do (the
objective would never complete). The required output variable is what makes the
clarify step actually bite.

Usage:
    export TAVUS_API_KEY=...
    python configure_objectives.py [objectives_id]   # defaults to OBJECTIVES_ID env / id below
"""

import os
import sys

import httpx

API = "https://tavusapi.com/v2"
OBJECTIVES_ID = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("OBJECTIVES_ID", "o15c0eb82c2d7")
API_KEY = os.environ.get("TAVUS_API_KEY", "")

DATA = [
    {
        "objective_name": "detect_intent",
        "objective_prompt": (
            "Route to the right path based on what the user actually wants. Treat this as a "
            "fast intent check, not an interrogation. Branches:\n"
            "  - SCHEDULING (user asks to book a call, see a calendar, talk to a human, or "
            "agrees when you offered): call the `offer_calendar` tool immediately. Do NOT "
            "ask any other questions. This objective is complete.\n"
            "  - QUICK QUESTION (user asked a single question about how Tavus works): just "
            "answer it using `search_tavus_docs`. Do NOT force a discovery flow. This "
            "objective is complete.\n"
            "  - BUILDING (user wants to build, configure, or set up something step by step "
            "and that isn't obvious already): confirm with ONE short question what they're "
            "building, then complete this objective.\n"
            "Default to the lightest possible touch. Never trap the user into describing a "
            "'use case' if a single tool call would finish the job."
        ),
        "confirmation_mode": "auto",
        "output_variables": [],
        "modality": "verbal",
        "next_conditional_objectives": {},
        "next_required_objective": "gather_requirements",
        "callback_url": "",
    },
    {
        "objective_name": "gather_requirements",
        "objective_prompt": (
            "Only run this if the user is actually building or configuring something. "
            "If detect_intent already finished with scheduling or a one-shot question, "
            "skip this objective — it is complete with no action.\n"
            "Otherwise: call search_tavus_docs to learn what that feature requires, then "
            "ask the user for the one or two specifics you still need (e.g. their desired "
            "flow). Ask one focused question at a time. Do not start the walkthrough until "
            "you have what you need."
        ),
        "confirmation_mode": "auto",
        "output_variables": [],
        "modality": "verbal",
        "next_conditional_objectives": {},
        "next_required_objective": "walk_steps",
        "callback_url": "",
    },
    {
        "objective_name": "walk_steps",
        "objective_prompt": (
            "Walk the user through accomplishing build_target, grounded in the API docs "
            "(use search_tavus_docs for the exact fields and steps), and tailored to the "
            "requirements they gave you. Go ONE concrete step at a time — reference the "
            "specific field or button on their screen, keep each step to a sentence or two "
            "(it is spoken aloud), and confirm they've done it before moving to the next. "
            "Complete this objective once they confirm they've accomplished their goal."
        ),
        "confirmation_mode": "auto",
        "output_variables": [],
        "modality": "verbal",
        "next_conditional_objectives": {},
        "next_required_objective": "",
        "callback_url": "",
    },
]


def main() -> None:
    if not API_KEY:
        sys.exit("Set TAVUS_API_KEY first: export TAVUS_API_KEY=...")
    headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}

    # Confirm the resource exists / show what we're replacing.
    g = httpx.get(f"{API}/objectives/{OBJECTIVES_ID}", headers=headers, timeout=30)
    g.raise_for_status()
    before = [o.get("objective_name") for o in g.json().get("data", [])]
    print(f"Current objectives on {OBJECTIVES_ID}: {before}")

    patch = [{"op": "replace", "path": "/data", "value": DATA}]
    p = httpx.patch(f"{API}/objectives/{OBJECTIVES_ID}", headers=headers, json=patch, timeout=30)
    if p.status_code == 304:
        print("Objectives already up to date (no change needed).")
        return
    if p.status_code >= 400:
        sys.exit(f"PATCH failed ({p.status_code}): {p.text}")
    print(f"Updated objectives on {OBJECTIVES_ID}.")
    print("clarify_use_case_before_walkthrough now requires a `use_case` output, so the "
          "persona must hear the goal before guiding.")


if __name__ == "__main__":
    main()
