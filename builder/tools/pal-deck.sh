#!/usr/bin/env bash
# pal-deck.sh — attach a slide deck to a Tavus PAL without shell-escaping pain.
#
#   export TAVUS_API_KEY=…              (never hardcode it, never commit it)
#   ./pal-deck.sh docs                  list the Knowledge Base
#   ./pal-deck.sh skills <pal_id>       show what the PAL currently carries
#   ./pal-deck.sh attach <pal_id> <deck_doc_id> <talktrack.txt> [walk_the_deck|on_demand]
#   ./pal-deck.sh drop-canvas <pal_id>  detach Magic Canvas so it can't compete
#
# The talk track is read from a plain text FILE and turned into JSON by python3,
# so quotes and apostrophes in it are never touched by the shell.
#
# Skills persist on the PAL and take effect on the NEXT conversation — a call
# already in progress keeps the config it started with.
set -euo pipefail

API="https://tavusapi.com/v2"
: "${TAVUS_API_KEY:?TAVUS_API_KEY is not set — export it first (do not paste it into a file)}"

OUT=$(mktemp)
BODY=$(mktemp)
trap 'rm -f "$OUT" "$BODY"' EXIT

api() { # api METHOD PATH [json-body-file] -> response in $OUT, http code echoed
  local m=$1 p=$2 f=${3:-} code
  if [ -n "$f" ]; then
    code=$(curl -sS -o "$OUT" -w '%{http_code}' -X "$m" "$API$p" \
      -H "x-api-key: $TAVUS_API_KEY" -H "Content-Type: application/json" --data-binary "@$f")
  else
    code=$(curl -sS -o "$OUT" -w '%{http_code}' -X "$m" "$API$p" -H "x-api-key: $TAVUS_API_KEY")
  fi
  echo "HTTP $code" >&2
  case "$code" in 2*) return 0;; *) cat "$OUT" >&2; echo >&2; return 1;; esac
}

case "${1:-}" in
  docs)
    api GET "/documents?limit=100"
    OUT="$OUT" python3 <<'PY'
import json, os
d = json.load(open(os.environ["OUT"], encoding="utf-8"))
rows = d.get("data") or d.get("documents") or (d if isinstance(d, list) else [])
print(f"{len(rows)} document(s)\n")
for r in rows:
    print(f'{r.get("document_id",""):<16} {r.get("status",""):<12} {r.get("document_name","")}')
    print(f'{"":<16} {r.get("document_url","")}\n')
PY
    ;;

  skills)
    pal=${2:?usage: pal-deck.sh skills <pal_id>}
    api GET "/pals/$pal"
    OUT="$OUT" python3 <<'PY'
import json, os
p = json.load(open(os.environ["OUT"], encoding="utf-8"))
sk = p.get("skills") or []
print("PAL:", p.get("pal_id") or p.get("id"), "—", p.get("pal_name") or "")
print(f"skills attached: {len(sk)}")
for s in sk:
    if isinstance(s, dict):
        print(" -", s.get("skill_id") or s.get("id") or s.get("name"))
        if s.get("config"):
            print("   config:", json.dumps(s["config"])[:600])
    else:
        print(" -", s)
print("\nSkill changes apply to the NEXT conversation, not one already running.")
PY
    ;;

  attach)
    pal=${2:?usage: pal-deck.sh attach <pal_id> <deck_doc_id> <talktrack.txt> [trigger]}
    doc=${3:?missing deck document id — ONE deck doc, not the whole Knowledge Base}
    track=${4:?missing talk-track text file}
    trig=${5:-walk_the_deck}
    DOC="$doc" TRIG="$trig" TRACK="$track" BODY="$BODY" python3 <<'PY'
import json, os
cfg = {
    "document_ids": [os.environ["DOC"]],
    "slides_trigger": os.environ["TRIG"],
    "prompt": open(os.environ["TRACK"], encoding="utf-8").read().strip(),
}
json.dump({"config": cfg}, open(os.environ["BODY"], "w", encoding="utf-8"))
print(f'deck: 1 doc ({cfg["document_ids"][0]})  trigger: {cfg["slides_trigger"]}  prompt: {len(cfg["prompt"])} chars')
PY
    echo "PUT /pals/$pal/skills/presentation"
    api PUT "/pals/$pal/skills/presentation" "$BODY"
    cat "$OUT"; echo
    ;;

  drop-canvas)
    pal=${2:?usage: pal-deck.sh drop-canvas <pal_id>}
    echo "DELETE /pals/$pal/skills/magic_canvas"
    api DELETE "/pals/$pal/skills/magic_canvas"
    cat "$OUT"; echo
    ;;

  *)
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
