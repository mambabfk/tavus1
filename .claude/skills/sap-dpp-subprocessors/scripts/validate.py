#!/usr/bin/env python3
"""Gate before anything is written to the workbook.

Exit 0 = safe to fill. Exit 1 = do not proceed.
Checks:
  1. Every dropdown value is a literal member of the form's validation list.
  2. Every researched (Bucket A) value has a source_url, or is "Not known".
  3. Every Bucket C value has a human name in signed_off_by.
  4. Bucket B config has no nulls.
  5. Scope is confirmed and fits the column count.
"""
import json, sys, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = json.load(open(os.path.join(ROOT, "reference/form_spec.json")))
ALLOWED = {r["id"]: r["allowed_values"] for r in SPEC["rows"] if r["allowed_values"]}

BUCKET_C = {"1.1.3", "1.7", "2.1", "2.2", "2.3", "3.1.5"}
BUCKET_B = {"1.1.4", "1.2", "1.3", "1.3.1", "1.3.2", "1.4", "1.4.1",
            "1.5", "1.5.1", "1.5.2", "1.5.3", "1.5.4",
            "1.6", "1.6.1", "1.6.2", "1.6.3", "1.6.4", "3.2.2"}

errors, warnings = [], []


def check_scope():
    try:
        import yaml
        cfg = yaml.safe_load(open(os.path.join(ROOT, "config/scope.yaml")))
    except Exception as e:
        errors.append(f"scope.yaml unreadable: {e}")
        return []
    subs = cfg.get("subprocessors") or []
    if not cfg.get("confirmed"):
        errors.append("scope.yaml: confirmed is not true. A human must sign off on which "
                      "sub-processors are in scope before any research is submitted.")
    n_cols = len(SPEC["vendor_columns"])
    if len(subs) > n_cols and not cfg.get("overflow_handling"):
        errors.append(f"scope.yaml lists {len(subs)} sub-processors but the form has "
                      f"{n_cols} columns and overflow_handling is unset. Ask SAP.")
    return subs


def check_program_answers():
    try:
        import yaml
        cfg = yaml.safe_load(open(os.path.join(ROOT, "config/tavus_program_answers.yaml")))
    except Exception as e:
        errors.append(f"tavus_program_answers.yaml unreadable: {e}")
        return
    for k, v in (cfg or {}).items():
        if v in (None, ""):
            errors.append(f"tavus_program_answers.yaml: '{k}' is blank. "
                          "The agent will not guess Bucket B answers.")


def check_vendor(path):
    slug = os.path.splitext(os.path.basename(path))[0]
    try:
        d = json.load(open(path))
    except Exception as e:
        errors.append(f"{slug}: unparseable JSON ({e})")
        return
    for fid, f in (d.get("fields") or {}).items():
        if not isinstance(f, dict):
            errors.append(f"{slug}/{fid}: field must be an object with value+source_url")
            continue
        val = f.get("value")
        if val in (None, ""):
            warnings.append(f"{slug}/{fid}: empty, will be left blank")
            continue

        if fid in ALLOWED and val not in ALLOWED[fid] and val != "Not known":
            errors.append(f"{slug}/{fid}: '{val}' is not an allowed dropdown value. "
                          f"Allowed: {ALLOWED[fid]}")

        if fid in BUCKET_B:
            errors.append(f"{slug}/{fid}: Bucket B field populated by researcher. "
                          "These come from config only. Strip it.")
        elif fid in BUCKET_C or any(fid.startswith(c + ".") for c in BUCKET_C):
            if not f.get("signed_off_by"):
                errors.append(f"{slug}/{fid}: Bucket C field needs signed_off_by "
                              "(a human name). Refusing to submit a judgment call as fact.")
        else:  # Bucket A
            if val != "Not known" and not f.get("source_url"):
                errors.append(f"{slug}/{fid}: value '{val}' has no source_url. "
                              "Unsourced values must be 'Not known'.")
            if f.get("confidence") == "high" and not f.get("source_url"):
                errors.append(f"{slug}/{fid}: confidence 'high' without a source.")

    verdicts = d.get("verification", {}).get("verdicts", {})
    if not verdicts:
        warnings.append(f"{slug}: no verification pass recorded. Run agents/verifier.md.")
    for fid, v in verdicts.items():
        if v in ("disputed", "unsupported", "unverifiable"):
            errors.append(f"{slug}/{fid}: verifier said '{v}' and the value was not "
                          "downgraded to 'Not known'.")


def main():
    check_scope()
    check_program_answers()
    files = sorted(glob.glob(os.path.join(ROOT, "data/verified/*.json"))) or \
            sorted(glob.glob(os.path.join(ROOT, "data/vendors/*.json")))
    if not files:
        errors.append("No vendor JSON files found. Run the researcher first.")
    for p in files:
        check_vendor(p)

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"FAIL  {e}")
    print(f"\n{len(files)} vendor file(s), {len(errors)} blocking error(s), "
          f"{len(warnings)} warning(s).")
    if errors:
        print("Do not fill the workbook until these are resolved.")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
