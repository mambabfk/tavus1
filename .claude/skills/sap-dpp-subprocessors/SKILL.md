---
name: sap-dpp-subprocessors
description: Fill out the SAP DPP Subprocessors Details questionnaire (or any per-subprocessor data-protection questionnaire) for Tavus. Researches vendor-specific facts from primary sources, independently verifies them, and writes only validated values into the real Excel form. Triggers on "SAP DPP", "subprocessor questionnaire", "DPP form", "subprocessor details", or a request to fill a per-vendor privacy/security spreadsheet.
---

# SAP DPP Subprocessor Questionnaire Agent

## The one rule that matters

This form is a legal attestation to SAP. A plausible-but-unsourced answer is worse
than "Not known". You will be tempted to write "AES-256" because every cloud vendor
uses AES-256. Do not, unless you have a URL that says so for that vendor.

Every researched value carries a source URL. No source, no value.

## Three buckets

Fields are pre-classified in `reference/field_playbook.md`. Never mix them up.

- **Bucket A — Researchable.** Vendor legal entity, address, privacy/DPO contact,
  encryption standards, EU region availability, certifications held. Public on the
  vendor's trust center, DPA, or sub-processor page. The researcher agent handles these.
- **Bucket B — Tavus program answers.** Rows 1.2 through 1.6: do we sign mirror DPAs,
  do we audit, gaps, remediation, incidents. These describe Tavus, not the vendor, so
  the same answer repeats across every column. Read them from
  `config/tavus_program_answers.yaml`. Never invent them. If the config is blank, stop
  and ask the human.
- **Bucket C — Human sign-off required.** Section 2 (special and regular categories of
  personal data), 2.3 (clear-text access), 1.7 (TIA alternatives), 1.1.3 (processing
  operations description). Propose a value with written reasoning, set
  `requires_signoff: true`, and stop. `fill_workbook.py` refuses to write these until
  a human name appears in `signed_off_by`.

## Workflow

1. **Scope.** Read `config/scope.yaml`. The form has exactly 10 vendor columns and
   Tavus lists 20 authorized sub-processors, so scope is a decision the human makes,
   not one you make. If `scope.yaml` has more than 10 entries or is unconfirmed, stop
   and surface the conflict.
2. **Research.** For each vendor in scope, run the `agents/researcher.md` prompt.
   One vendor per subagent, parallel where available. Output:
   `data/vendors/<slug>.json`.
3. **Verify.** For each completed vendor file, run `agents/verifier.md` as a *separate*
   pass with no access to the researcher's reasoning. It re-fetches each source URL and
   confirms or disputes each value. Disputes go to `data/review_queue.md`. Never resolve
   a dispute by preferring the researcher — downgrade to "Not known" or escalate.
4. **Validate.** `python scripts/validate.py` — checks every dropdown value against the
   literal allowed strings extracted from the form, every researched value for a source
   URL, and every Bucket C value for sign-off. Exit non-zero means do not proceed.
5. **Fill.** `python scripts/fill_workbook.py --out output/SAP_DPP_filled.xlsx`
   Writes into a copy of the original form. Preserves the dropdowns.
6. **Report.** Print the gap list: every cell left as "Not known", every unresolved
   dispute, every Bucket C item awaiting sign-off. This list is the human's to-do,
   and it is the deliverable that matters more than the filled cells.

## Research discipline

Acceptable sources, in order: the vendor's own trust center or security portal, their
DPA or sub-processor page, their published SOC 2 / ISO scope statement, their official
docs. A blog post about the vendor is not a source. Another AI's summary is not a
source. If the only hit is a marketing page saying "enterprise-grade encryption",
that is "Not known".

For encryption-at-rest and in-transit, prefer the vendor's security documentation over
their compliance marketing, and record the exact standard string. If a vendor documents
"AES-256-GCM", the form's allowed value is `AES-256` — map it, and note the original in
the notes field.

Some vendors on the list are GPU/inference providers (Cerebrium, Replicate, Fal, Groq,
Cerebras) with thinner public documentation than the hyperscalers. Expect "Not known"
here and do not pad it. Those gaps are a genuine finding: they tell the human which
vendors need a direct email before submission.

## What to hand back

Never claim the form is done. Say which cells are filled with sourced values, which are
"Not known" and why, and which need sign-off. The human submits; you do not.
