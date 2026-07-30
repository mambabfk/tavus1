# SAP DPP Subprocessor Agent

Fills the SAP DPP Subprocessors Details questionnaire without lying to SAP.

## Run order

```bash
# 0. Decide scope. Edit config/scope.yaml, set confirmed: true.
#    The form has 10 columns; Tavus lists 20 sub-processors. This is a real decision.

# 1. Answer the Tavus-side questions once. Edit config/tavus_program_answers.yaml.
#    Row 1.6 (incidents in the last year) needs security/counsel, not vibes.

# 2. Research. In Claude Code:
#    "Use the sap-dpp-subprocessors skill. Research every vendor in scope."
#    -> data/vendors/<slug>.json

# 3. Verify, as a separate pass:
#    "Run the verifier over every file in data/vendors."
#    -> data/verified/<slug>.json + data/review_queue.md

# 4. Gate
python3 scripts/validate.py

# 5. Fill
python3 scripts/fill_workbook.py --out output/SAP_DPP_filled.xlsx
#    -> output/gap_report.md  <- read this, it's the actual deliverable

# Confirm the safety rails still work after you edit anything:
bash tests/run_selftest.sh
```

## Design, in one paragraph

Three buckets. Bucket A is researchable from vendor primary sources and every value
must carry a URL — no URL means the cell says "Not known", full stop. Bucket B describes
Tavus rather than the vendors, so it comes from a config file the agent will not
invent; blank config halts the run. Bucket C is judgment (which categories of personal
data each vendor processes, whether alternatives to US transfers exist) and the filler
refuses to write it without a human name in `signed_off_by`. Research and verification
are separate passes so the verifier is checking claims and URLs rather than agreeing
with its own reasoning. `validate.py` is the choke point: dropdown values are checked
against the literal validation strings pulled out of the real spreadsheet, so
"TLS 1.2+" fails where "TLS 1.2" passes.

## What this does not do

It does not make the form correct. It makes the form's *unknowns visible*, which is the
part humans skip. Expect a lot of "Not known" from the GPU and inference vendors
(Cerebrium, Replicate, Fal, Groq, Cerebras) — their public security documentation is
thin compared to AWS and GCP. Those gaps are a finding: they're the list of vendors you
need to email before submission, and the agent generates that list in
`open_questions_for_vendor`.

It also cannot check your entity names against the TOM questionnaire #8.3 you already
sent SAP unless you drop that file in this folder. Do that. A mismatched legal entity
name gets the whole package bounced.
