# Sub-processor DPP outreach contacts — Group 3

Researched 2026-07-31. Method note: direct page fetches (groq.com, cerebras.ai, mux.com, openai.com) were
blocked by the sandbox egress proxy (HTTP 403 at CONNECT), so all items below come from web-search result
snippets quoting the vendors' own pages, with the source URL recorded per item. Nothing is pattern-guessed;
anything not directly stated in a snippet is marked uncertain.

## Mux (mux.com)

| Name | Title | LinkedIn URL | Source / notes |
|---|---|---|---|
| Jon Dahl | Co-founder, Mux, Inc. (widely reported as CEO; exact current title not confirmed in snippet) | https://www.linkedin.com/in/zencoder/ | LinkedIn search snippet ("Jon Dahl - Mux, Inc.") |
| Matthew McClure | Co-founder, Mux Inc | https://www.linkedin.com/in/mmcc22/ | LinkedIn search snippet ("One of Mux's founders") |

No named privacy/security lead surfaced in LinkedIn search snippets (searched security / compliance / GC / privacy variants).

**Official channel:** `privacy@mux.com` — stated in Mux's Privacy Policy (https://www.mux.com/privacy, quoted in search snippet).
Also:
- Trust Center (Conveyor): https://trust.mux.com/
- DPA (PDF, updated Apr 1 2025): https://www.mux.com/files/mux-dpa.pdf
- Security page / vulnerability reporting: https://www.mux.com/security and HackerOne https://hackerone.com/mux (security reports only, not DPP outreach)

**Contact first:** `privacy@mux.com`, referencing the DPA; escalate via Jon Dahl (LinkedIn) if no reply.

## Cerebras (cerebras.ai)

| Name | Title | LinkedIn URL | Source / notes |
|---|---|---|---|
| Naor Penso | Chief Information Security Officer, Cerebras | https://www.linkedin.com/in/naorpenso/ | LinkedIn search snippet; CISO appointment also in Businesswire (https://markets.financialcontent.com/custercountychief/article/bizwire-2025-3-5-cerebras-bolsters-leadership-team-with-appointment-of-new-ciso-evp-of-worldwide-sales-and-svp-of-ai-cloud-and-inference) |
| Andrew Feldman | Founder and CEO, Cerebras Systems | https://www.linkedin.com/in/andrewdfeldman | LinkedIn search snippet (fallback contact) |
| Andy Hock | Chief Strategy Officer, Cerebras Systems | https://www.linkedin.com/in/andyhock/ | LinkedIn search snippet (secondary fallback) |

**Official channel:** `privacy@cerebras.net` — quoted in search snippet of the Cerebras privacy policy
(https://www.cerebras.ai/privacy-policy); postal: Cerebras Systems Inc., 1237 E Arques Ave, Sunnyvale, CA 94085.
Also:
- Trust Center (SafeBase): https://trust.cerebras.ai/ — security-documentation requests
- `support@cerebras.ai` — Terms-of-Service questions per https://www.cerebras.ai/terms-of-service (snippet)
- No security.txt / security@ address found in search results.

**Contact first:** `privacy@cerebras.net`; in parallel request docs via https://trust.cerebras.ai/ and message CISO Naor Penso on LinkedIn.

## Meta (Llama API / Meta Platforms)

Individual hunt intentionally skipped (per brief) — official routes:

| Channel | Detail | Source |
|---|---|---|
| DPO contact form | https://www.facebook.com/help/contact/540977946302970 ("Contact the data protection officer (DPO)") | facebook.com help page (search result) |
| EU entity address | Meta Platforms Ireland Limited, 4 Grand Canal Square, Grand Canal Harbour, Dublin 2, Ireland | search snippets (third-party summaries of Meta policy) |
| Llama API privacy route | Llama API ToS: developers inform Meta of Privacy-Rights requests "through their Managed Account"; Llama API data stored separately from other Meta product data | https://llama.developer.meta.com/legal/terms-of-service (snippet) |
| `privacy@meta.com` | UNVERIFIED — reported only by third-party sites (https://request-gdpr.com/companies/meta/), not confirmed from a Meta page; treat as uncertain | request-gdpr.com |

**Contact first:** the DPO contact form (facebook.com/help/contact/540977946302970) plus the Llama API
Managed Account channel (Tavus's account team) for API-specific sub-processor questions.

## OpenAI (openai.com)

Individual hunt intentionally skipped (per brief) — official routes:

| Channel | Detail | Source |
|---|---|---|
| DPO email | `dpo@openai.com` — "contact OpenAI's Data Protection Officer... in matters related to Personal Data processing" | https://openai.com/policies/eu-privacy-policy/ (snippet) |
| DSAR email / portal | `dsar@openai.com`; privacy portal https://privacy.openai.com | https://openai.com/policies/row-privacy-policy/ (snippet) |
| Trust Portal (SafeBase) | https://trust.openai.com/ — SOC 2 Type 2, ISO 27001/27017/27018/27701 docs; account required for reports | trust.openai.com + https://openai.com/security-and-privacy/ (snippets) |
| `privacy@openai.com` | Reported via third-party directory (https://www.datarequests.org/company/openai/); plausible but not confirmed from an openai.com snippet — uncertain | datarequests.org |
| Mailing address | OpenAI, L.L.C., Attn: Data Protection, 3180 18th St, San Francisco, CA 94110 | datarequests.org (third-party — uncertain) |

**Contact first:** `dpo@openai.com` for the questionnaire; pull compliance evidence from https://trust.openai.com/ in parallel.

## Groq (groq.com)

| Name | Title | LinkedIn URL | Source / notes |
|---|---|---|---|
| Claire Hart | Chief Legal Officer (ZoomInfo lists "COO & Chief Legal Officer"), Groq — joined late July 2024 | Not confirmed — LinkedIn search returned same-name profiles at other companies; do not use an unverified URL | Law.com (https://www.law.com/corpcounsel/2024/08/07/upstart-nvidia-rival-hires-clo-after-gigantic-funding-round/), ZoomInfo (https://www.zoominfo.com/p/Claire-Hart/1720123024) |
| Sheryl Savage | FORMER General Counsel & head of compliance — left Groq Dec 2024, now GC at Positron AI. Do NOT contact for Groq | https://www.linkedin.com/in/sheryl-savage-17531b7/ | Vanguard Law Magazine (https://www.vanguardlawmag.com/case-studies/sheryl-savage-positron-ai/) |

No current CISO/DPO surfaced in LinkedIn search snippets.

**Official channel:** `legal@groq.com` — primary privacy-policy contact per snippet of https://groq.com/privacy-policy
(postal: Groq LLC, P.O. Box 1778, Mountain View, CA 94042, USA).
Also:
- `privacy@groq.com` — stated in the KSA-specific privacy policy (https://console.groq.com/docs/privacy-policy-ksa/); likely monitored generally but only confirmed for the KSA policy
- Trust Center: https://trust.groq.com/ (SOC 2 Type II, GDPR, HIPAA claims; resources at https://trust.groq.com/resources)
- DPA: https://console.groq.com/docs/legal/customer-data-processing-addendum
- security.txt: https://groq.com/.well-known/security.txt → `security@groq.com` (vulnerability reports only; policy at https://groq.com/security)

**Contact first:** `legal@groq.com` (CC `privacy@groq.com`), referencing the GroqCloud DPA; request security docs via https://trust.groq.com/. Person-level escalation: CLO Claire Hart (via Law.com-confirmed role; verify LinkedIn before messaging).
