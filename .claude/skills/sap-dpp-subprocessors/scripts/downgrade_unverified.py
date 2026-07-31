#!/usr/bin/env python3
"""Apply the verifier's resolution rule to data/verified/*.json.

For every field whose verdict is disputed/unsupported/unverifiable:
  - downgrade value to "Not known" (original value + URL preserved in notes)
  - mark the verdict "downgraded_to_not_known" so validate.py sees it resolved

The un-downgraded originals always remain in data/vendors/ — re-run the
verifier from an unrestricted network to recover values whose sources were
merely unreachable, then re-run this script.
"""
import json, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAD = ("disputed", "unsupported", "unverifiable")

changed = 0
for path in sorted(glob.glob(os.path.join(ROOT, "data/verified/*.json"))):
    d = json.load(open(path))
    verdicts = d.get("verification", {}).get("verdicts", {})
    dirty = False
    for fid, v in verdicts.items():
        if v not in BAD:
            continue
        f = (d.get("fields") or {}).get(fid)
        if isinstance(f, dict) and f.get("value") not in (None, "", "Not known"):
            note = f.get("notes") or ""
            f["notes"] = (f"downgraded from '{f['value']}' "
                          f"(source: {f.get('source_url')}; verdict: {v}). " + note).strip()
            f["value"] = "Not known"
            f["source_url"] = None
            f["confidence"] = "none"
        verdicts[fid] = "downgraded_to_not_known"
        dirty = True
        changed += 1
    if dirty:
        json.dump(d, open(path, "w"), indent=1)

print(f"resolved {changed} flagged verdicts across verified files")
