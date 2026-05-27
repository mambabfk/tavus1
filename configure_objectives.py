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
        "objective_name": "clarify_use_case_before_walkthrough",
        "objective_prompt": (
            "When the developer shares their screen and asks for help or a walkthrough, "
            "FIRST ask what they are trying to build or accomplish, in their own words, "
            "before describing anything you see. For example: 'Before I walk you through "
            "this — what are you building this persona for?' The screen is CONTEXT ONLY; it "
            "does NOT tell you their goal. Do NOT describe what is on screen, give any "
            "instructions, or move on until the user has stated their goal out loud. Capture "
            "their stated goal as use_case."
        ),
        "confirmation_mode": "auto",
        "output_variables": ["use_case"],
        "modality": "verbal",
        "next_conditional_objectives": {},
        "next_required_objective": "guide_through_screen",
        "callback_url": "",
    },
    {
        "objective_name": "guide_through_screen",
        "objective_prompt": (
            "Using the use_case the developer just described, guide them toward THAT goal "
            "one concrete step at a time. Reference specific elements on their shared screen "
            "only when relevant to their stated goal — do not narrate the page or walk "
            "through whatever happens to be open. Use search_tavus_docs if you need to look "
            "up how a feature works. After each step, check whether they're ready to continue "
            "or stuck. Complete this objective once the developer confirms they have what they "
            "need."
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
