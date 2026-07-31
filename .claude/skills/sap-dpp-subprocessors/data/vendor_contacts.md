# Vendor privacy/security contacts — SAP DPP outreach

Compiled 2026-07-31 from public LinkedIn search results and each vendor's own
privacy/trust pages. **For outreach only** (sending the `open_questions_for_vendor`
lists) — these are NOT form values; field 1.1.2 takes only primary-source DPO info.

Caveat: the sandbox proxy blocked many direct page fetches, so several emails were
extracted from search snippets of the vendors' own pages (sources cited per item in
the group sections below). Worth a quick live confirmation before sending. No
addresses were pattern-guessed.

## Quick reference — who to contact first

| Vendor | Primary channel | Named person (LinkedIn-sourced) |
|---|---|---|
| Google Cloud | Cloud Data Protection Team form: support.google.com/cloud/contact/dpo | — (form only) |
| AWS | aws-EU-privacy@amazon.com (EMEA DPO) + your AWS account team | — |
| Cerebrium | security@cerebrium.ai (no DPO appointed) | Michael Louis, CEO |
| Replicate | privacy@replicate.com — note: acquired by Cloudflare (Nov 2025); escalate via dpo@cloudflare.com | Andreas Jansson, co-founder |
| Fal | trust.fal.ai contact flow; support@fal.ai (unverified) | Burkay Gur (CEO), Gorkem Yurtseven |
| ElevenLabs | legal@elevenlabs.io (named DPO contact) | Alex Haskell (GC); Moussa Ismail (privacy-certified legal) |
| Cartesia | security@cartesia.ai (per their privacy policy) | Michael Le, GC (uncertain) |
| InWorld | privacy@inworld.ai | Oliver Louie (title unconfirmed) |
| Deepgram | security@deepgram.com → routes to outsourced DPO (name not published) | — |
| Daily | help@daily.co (their GDPR/DPA contact) | Mark Backman, Data Privacy Manager |
| Mux | privacy@mux.com; trust.mux.com | — (founders as fallback) |
| Cerebras | privacy@cerebras.net; trust.cerebras.ai | Naor Penso, CISO |
| Meta (Llama API) | DPO form facebook.com/help/contact/540977946302970 + Llama API managed-account channel | — |
| OpenAI | dpo@openai.com; trust.openai.com for SOC 2/ISO evidence | — |
| Groq | legal@groq.com; security@groq.com (security.txt) | Claire Hart, CLO (no verified LinkedIn) |
| Slack | dpo@slack.com / privacy@slack.com | — |
| Pylon | security@usepylon.com (no privacy email published) | Aashish Kapur (security, uncertain); Marty Kausas, CEO |
| Salesforce | privacy@salesforce.com + privacy-request form | Lindsey Finch, EVP Global Privacy |
| Stripe | dpo@stripe.com | — |
| Orb | privacy@withorb.com / security@withorb.com | Alvaro Morales (CEO), Kshitij Grover (CTO) |

---

# Outreach contacts — Group 1 (GCP, AWS, Cerebrium, Replicate, Fal)

Researched 2026-07-31 for Tavus sub-processor due-diligence outreach.
Method: web search (LinkedIn snippets + exact-quote email searches) and fetched vendor pages
(Google Cloud DPA/GDPR/Trust Center fetched in full; several vendor sites were blocked by the
network gateway, so those items rely on search-result snippets — marked accordingly).
No email addresses were guessed; every item lists its source.

## Google Cloud Platform

Individual DPO outreach is not realistic at Google's scale; Google routes processor/DPO
questions through a dedicated Cloud Data Protection Team form.

| Name | Title / role | LinkedIn | Source |
|---|---|---|---|
| — (no individual identified; Google does not publish a named DPO for Cloud) | Cloud Data Protection Team (official team channel) | n/a | Google Cloud Data Processing Addendum, https://cloud.google.com/terms/data-processing-addendum (fetched in full) |

**Official channel:**
- **Cloud Data Protection Team contact form: https://support.google.com/cloud/contact/dpo** — the CDPA states verbatim: "Cloud Data Protection Team. The Data Protection Team for Google Cloud Platform can be contacted at https://support.google.com/cloud/contact/dpo". Source: https://cloud.google.com/terms/data-processing-addendum (page fetched; same link also appears on https://cloud.google.com/privacy/gdpr).
- Google's general Data Protection Office (controller-side) is reachable via web form per the Google Privacy Policy; postal: Google LLC, Attn: Data Protection, 1600 Amphitheatre Pkwy, Mountain View CA 94043. Sources: https://policies.google.com/privacy, https://support.google.com/policies/answer/9581826, https://www.datarequests.org/company/google/ (search snippets). The email `data-protection-office@google.com` appears only in third-party correspondence (https://brave.com/static-assets/files/Part-B.pdf) — it is a reply address for the form, **not a published intake address; do not cold-email it**.
- Trust/compliance background: Google Cloud Trust Center, https://cloud.google.com/trust-center (fetched; no direct email published there).
- Sub-processor list (relevant to the questionnaire): https://cloud.google.com/terms/subprocessors (referenced in the CDPA).

**Contact first:** the Cloud Data Protection Team form at https://support.google.com/cloud/contact/dpo — it is the channel Google's own DPA designates for exactly this kind of data-protection inquiry.

## Amazon Web Services (AWS)

Same situation as Google — no realistic individual DPO target; AWS publishes a DPO email for
its EMEA entity.

| Name | Title / role | LinkedIn | Source |
|---|---|---|---|
| — (AWS does not publicly name its DPO) | Data Protection Officer, Amazon Web Services EMEA SARL | n/a | AWS Privacy Notice, https://aws.amazon.com/privacy/ (via search snippets; page itself blocked by our network gateway) |

**Official channel:**
- **Email: aws-EU-privacy@amazon.com** — per the AWS Privacy Notice, "the data protection officer for Amazon Web Services EMEA SARL can be contacted at aws-EU-privacy@amazon.com". Sources: https://aws.amazon.com/privacy/ (search snippet; direct fetch blocked), corroborated by https://www.datarequests.org/company/amazon-aws/ and archived notice versions (e.g. https://aws.amazon.com/privacy/aws-privacy-prior-20250909/).
- Postal: Amazon Web Services EMEA SARL, Attn: Data Protection, 38 Avenue John F. Kennedy, 1855 Luxembourg, Luxembourg (same sources).
- GDPR/compliance background: https://aws.amazon.com/compliance/gdpr-center/ and https://aws.amazon.com/compliance/data-privacy/ (fetch blocked; URLs confirmed via search results). The AWS DPA is incorporated into the AWS Service Terms; enterprise customers can also route questions via their AWS account team / support case.
- *Caveat:* the aws-EU-privacy@ address is framed for EU/EEA privacy concerns; for a US B2B vendor questionnaire the fastest route may be an AWS support case or account manager, with this email as the formal DPO channel.

**Contact first:** aws-EU-privacy@amazon.com (the published DPO channel), in parallel with Tavus's AWS account manager or a support case for the questionnaire itself.

## Cerebrium (cerebrium.ai)

Small YC startup (W22); no dedicated privacy/security hire found — founders are the right people.
Cerebrium's privacy policy states it has **not appointed a DPO** ("not obliged by US privacy laws
to appoint a data protection officer and have not voluntarily appointed one at this time" — per
https://cerebrium.ai/privacy, search snippet).

| Name | Title | LinkedIn | Source |
|---|---|---|---|
| Michael Louis | Co-Founder & CEO, Cerebrium (YC W22) | https://www.linkedin.com/in/michael-louis-94104a113/ (also https://uk.linkedin.com/in/michael-louis-83948723a) | LinkedIn search snippet (posts about Cerebrium's SOC 2 Type 2 audit) |
| Jono Irwin | Co-Founder & CTO, Cerebrium (YC W22) | https://www.linkedin.com/in/jono-irwin/ | LinkedIn search snippet (posts on security/compliance topics) |

**Official channel:**
- **security@cerebrium.ai** — listed for security/compliance information on Cerebrium's Security & Data Privacy page, https://cerebrium.ai/docs/security (search snippet; direct fetch blocked).
- **compliance@cerebrium.ai** — listed for initiating the HIPAA BAA process, same source (https://cerebrium.ai/docs/security / https://docs.cerebrium.ai/security, search snippet).
- **support@cerebrium.ai** — data/privacy inquiries per the Privacy Policy, https://cerebrium.ai/privacy (search snippet). Postal: 251 Little Falls Drive, Wilmington, DE 19808, USA (Cerebrium Inc. is the data controller, same source).
- Compliance posture (for the questionnaire): SOC 2 (Type I per docs page; Type 2 audit completion claimed in CEO's LinkedIn posts), HIPAA, GDPR, ISO claims — per https://cerebrium.ai/docs/security (snippet). No security.txt confirmed (site fetch blocked).

**Contact first:** security@cerebrium.ai (their designated security/compliance channel), CC support@cerebrium.ai; escalate to CEO Michael Louis on LinkedIn if no reply.

## Replicate (replicate.com)

**Important context: Cloudflare announced its acquisition of Replicate on 2025-11-17** (press
release: https://www.cloudflare.com/press/press-releases/2025/cloudflare-to-acquire-replicate-to-build-the-most-seamless-ai-cloud-for-developers/ ;
Replicate's own post: https://replicate.com/blog/replicate-cloudflare). Replicate continues as a
distinct brand, but privacy/compliance escalation may now run through Cloudflare.

| Name | Title | LinkedIn | Source |
|---|---|---|---|
| Andreas Jansson | Co-founder, Replicate ("acquired by …" per profile headline — likely now under Cloudflare; exact current title uncertain) | https://se.linkedin.com/in/janssonandreas | LinkedIn search snippet |
| Ben Firshman | Co-founder of Replicate — **appears to have left**: profile headline now reads "Member of Technical Staff at Anthropic". Not a suitable outreach target. | https://www.linkedin.com/in/bfirsh | LinkedIn search snippet |

No Replicate-specific security/privacy/legal staffer surfaced in LinkedIn searches.

**Official channel:**
- **privacy@replicate.com** — designated in Replicate's Privacy Policy for privacy questions/requests, https://replicate.com/privacy (search snippet; direct fetch blocked by gateway). legal@replicate.com and support@replicate.com were suggested by a search summary but **not confirmed by a direct snippet — treat as unverified**.
- Escalation via parent company: Cloudflare DPO **dpo@cloudflare.com** and privacy team **privacyquestions@cloudflare.com**, per the Cloudflare Privacy Policy, https://www.cloudflare.com/privacypolicy/ (search snippets; also mirrored at https://github.com/cloudflare/Cloudflare-Policies/blob/master/privacy-policy.md).
- security.txt / security@replicate.com: not confirmed (searches found nothing; site fetch blocked).

**Contact first:** privacy@replicate.com; if unresponsive post-acquisition, escalate to privacyquestions@cloudflare.com / dpo@cloudflare.com citing Replicate as a Cloudflare company.

## Fal (fal.ai — "fal — Features & Labels Inc.")

Small startup; no privacy/security/legal named role surfaced on LinkedIn — founders are the
fallback contacts. (Note: LinkedIn results for "Che Shap — CEO at FAL" and "Maxim Plastinin —
CFO, FAL company" are a **different company** named FAL, not fal.ai — excluded.)

| Name | Title | LinkedIn | Source |
|---|---|---|---|
| Burkay Gur | Co-Founder, fal.ai | https://www.linkedin.com/in/burkaygur/ | LinkedIn search snippet |
| Gorkem Yurtseven | Co-Founder, fal (CTO per search summary — title from snippet is just "fal"; exact title uncertain) | https://www.linkedin.com/in/gorkemy | LinkedIn search snippet |

**Official channel:**
- **support@fal.ai** — the only email surfaced in connection with fal's Privacy Policy (policy of "fal — Features & Labels Inc.", last updated 2025-04-20). Source: search snippets around https://www.fal.ai/legal/privacy-policy (direct fetch blocked). *Marked uncertain — verify the address on the policy page before mailing; no dedicated privacy@/legal@ address was found.*
- Privacy policy: https://www.fal.ai/legal/privacy-policy ; legal center: https://www.fal.ai/legal (search results).
- Trust center: **https://trust.fal.ai** (referenced from https://fal.ai/enterprise, search snippet) — trust centers of this kind typically include a document-request/contact flow; use it to request SOC 2 / DPA docs.
- security.txt / security@fal.ai: not confirmed (searches found nothing).

**Contact first:** the trust center at https://trust.fal.ai (request compliance docs / contact), with support@fal.ai as the email route; escalate to co-founder Burkay Gur on LinkedIn if no reply.

---

### Verification caveats (applies to all sections)
- Network gateway blocked direct fetches of aws.amazon.com, replicate.com, fal.ai, cerebrium.ai and datarequests.org during this session; items from those domains rest on search-result snippets and are labeled as such. Google Cloud pages (DPA, GDPR, Trust Center) were fetched in full and quoted directly.
- LinkedIn profile data comes from search-result snippets only (profiles are login-walled); titles may lag reality — the Replicate entries in particular are post-acquisition and volatile.
- No email address in this file was pattern-guessed; where none was published, the form/trust-center URL is given instead.
# Outreach contacts — Group 2 (ElevenLabs, Cartesia, InWorld, Deepgram, Daily)

Researched 2026-07-31 for Tavus sub-processor due-diligence outreach.

**Method / caveat:** direct page fetches were blocked by the environment's egress proxy
(403 on CONNECT to vendor domains), so all "official channel" emails below were extracted
from web-search result snippets of the vendors' **own** privacy/GDPR pages (source URL given
per item). Verify the address on the live page before sending. No email addresses were
guessed; anything not stated in a snippet is marked "not published / not found".

---

## ElevenLabs (elevenlabs.io)

| Name | Title (per search snippet) | LinkedIn URL | Source |
|---|---|---|---|
| Alex Haskell | General Counsel & Head of Global Affairs (snippet: "Legal and Global Affairs at ElevenLabs"; GC title corroborated by speaker-bio snippet) | https://www.linkedin.com/in/alex-haskell-87255746 | Google results for `"Alex Haskell" ElevenLabs legal general counsel` (allamericanspeakers.com, zoominfo.com, linkedin.com snippets) |
| Moussa Ismail | Legal at ElevenLabs — AIGP, CIPP/US (privacy certifications, per profile snippet) | https://www.linkedin.com/in/moussaismail/ | `site:linkedin.com/in "ElevenLabs" privacy OR security OR legal` search snippet |
| Dan Jasnow | Legal @ ElevenLabs (snippet notes he works under Alex Haskell, who leads the legal team) | https://www.linkedin.com/in/dan-jasnow/ | same LinkedIn site-search snippet |

**Official channel:** `legal@elevenlabs.io` — named as the Data Protection Officer contact in ElevenLabs' privacy documents (source snippets from https://elevenlabs.io/privacy-policy and https://elevenlabs.io/eu-us-data-privacy-framework-policy). Additional: legal contact form https://elevenlabs.io/contact-legal ; DPA page https://elevenlabs.io/dpa ; trust center https://compliance.elevenlabs.io/ .

**Contact first:** email `legal@elevenlabs.io` (published DPO channel); in parallel, LinkedIn message to Moussa Ismail (privacy-certified legal team member).

---

## Cartesia (cartesia.ai)

| Name | Title (per search snippet) | LinkedIn URL | Source |
|---|---|---|---|
| Michael Le | General Counsel at Cartesia — *uncertain: snippet says only "General Counsel at Cartesia"; another unrelated "Cartesia, Inc." exists, so confirm he is at the voice-AI Cartesia before outreach* | https://www.linkedin.com/in/michael-le-79858621/ | `site:linkedin.com/in "Cartesia" ...` and `"Michael Le" Cartesia general counsel` search snippets |
| Karan Goel | Founder / CEO @ Cartesia (fallback) | https://www.linkedin.com/in/krandiash | LinkedIn site-search snippet |
| Arjun Desai | Cofounder @ Cartesia (fallback) | https://www.linkedin.com/in/arjun-desai-4a731ba4/ | LinkedIn site-search snippet |
| Brandon Yang | Cofounder @ Cartesia (fallback) | https://www.linkedin.com/in/bcyang/ | LinkedIn site-search snippet |

**Official channel:** `security@cartesia.ai` — given for privacy-practice / Privacy Policy questions per snippet of Cartesia's own privacy policy (https://cartesia.ai/legal/privacy.html / https://www.cartesia.ai/legal/privacy). Additional: `support@cartesia.ai` (support / AI-safety inquiries, per https://www.cartesia.ai/legal/safety/ snippet); trust center https://trust.cartesia.ai/ ; contact form https://www.cartesia.ai/contact .

**Contact first:** email `security@cartesia.ai` (the privacy-policy contact) and LinkedIn message Michael Le (GC) after confirming his Cartesia is the right one.

---

## InWorld (inworld.ai)

| Name | Title (per search snippet) | LinkedIn URL | Source |
|---|---|---|---|
| Oliver Louie | Inworld AI — profile snippet discusses SaaS contract governance, data protection, and regulatory compliance; *exact title not stated in snippet — uncertain* | https://www.linkedin.com/in/oliverlouie/ | `site:linkedin.com/in "Inworld" legal OR compliance` search snippet |
| Kylan Gibbs | Co-Founder & CEO, Inworld AI (fallback) | https://www.linkedin.com/in/kylangibbs/ | `Inworld AI founders` search snippets (lsvp.com, crunchbase, LinkedIn) |
| Ilya Gelfenbeyn | Co-Founder & CSO, Inworld AI (fallback) | https://www.linkedin.com/in/gelfenbeyn/ | same search snippets |

**Official channel:** `privacy@inworld.ai` — privacy questions, per snippet of https://inworld.ai/privacy . Additional: `legal@inworld.ai` (disputes/legal, per Terms snippet at https://inworld.ai/terms), `support@inworld.ai` (general support), security overview page https://inworld.ai/security .

**Contact first:** email `privacy@inworld.ai`; fallback LinkedIn message to Oliver Louie (legal/compliance-adjacent) or CEO Kylan Gibbs.

---

## Deepgram (deepgram.com)

| Name | Title (per search snippet) | LinkedIn URL | Source |
|---|---|---|---|
| — | No privacy/security/legal-titled Deepgram employee surfaced in LinkedIn site-search snippets. Deepgram's docs state it "retains an independent Data Protection Officer" (outsourced; name/email not published in snippets). | — | https://developers.deepgram.com/trust-security/information-security-privacy (via search snippet) |
| Scott Stephenson | Co-Founder & CEO, Deepgram (fallback) | https://www.linkedin.com/in/scott-stephenson- | LinkedIn site-search snippet |

**Official channel:** `security@deepgram.com` — given in Deepgram's Privacy Notice for privacy inquiries (snippet of https://deepgram.com/privacy) and in its security docs for security matters. Additional: `support@deepgram.com` (account/deletion requests, per docs snippet); subprocessor list https://deepgram.com/privacy/subprocessors ; security & privacy statement https://developers.deepgram.com/trust-security/information-security-privacy .

**Contact first:** email `security@deepgram.com` asking to be routed to their (independent) DPO; no named individual to target on LinkedIn — CEO only as last resort.

---

## Daily (daily.co)

| Name | Title (per search snippet) | LinkedIn URL | Source |
|---|---|---|---|
| Mark Backman | Named "Data Privacy Manager" on Daily's GDPR compliance page; LinkedIn/The Org list him as VP, Product at Daily — *role currency uncertain, but he is the only privacy-named individual Daily publishes* | https://www.linkedin.com/in/mark-backman/ | https://www.daily.co/security/gdpr-compliance/ (via search snippet); https://theorg.com/org/daily-co/org-chart/mark-backman |
| Kwindla Hultman Kramer | Co-Founder & CEO, Daily (fallback) | https://www.linkedin.com/in/kwkramer/ | `"Kwindla Hultman Kramer" Daily.co CEO linkedin` search snippets (theorg.com, crunchbase, LinkedIn) |

**Official channel:** `help@daily.co` — Daily's GDPR page directs DPA/privacy-policy questions there (snippet of https://www.daily.co/security/gdpr-compliance/ and the privacy policy at https://www.daily.co/legal/privacy/). No privacy@/dpo@ address published in snippets. Additional: responsible-disclosure policy https://www.daily.co/legal/disclosure/ ; data-protection overview https://www.daily.co/security/data-protection/ .

**Contact first:** email `help@daily.co` marked "Attn: Data Privacy Manager / DPA question"; in parallel LinkedIn message Mark Backman.
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
# Group 4 — Vendor outreach contacts (sub-processor due diligence)

Researched 2026-07-31. Method note: slack.com, salesforce.com, stripe.com, usepylon.com,
withorb.com, and docs.usepylon.com all refused direct page fetches from this environment
(bot protection / egress-proxy 403s), so items below come from web-search result snippets
of those vendors' own pages. Each item carries the page it was quoted from; anything
snippet-only or ambiguous is flagged. No email addresses were guessed — every address
below appeared verbatim in a snippet of the cited page.

---

## Slack (slack.com — Salesforce subsidiary)

| Name | Title | LinkedIn URL | Source |
|---|---|---|---|
| — (individual hunt intentionally skipped for large vendor; official DPO route below) | | | |

**Official channel:**
- General privacy contact: **privacy@slack.com** — per Slack Privacy Policy, https://slack.com/trust/privacy/privacy-policy (via search snippet; page blocked direct fetch)
- Data Protection Officer: **dpo@slack.com** — "To communicate with Slack's Data Protection Officer, please email dpo@slack.com" — same policy page; also referenced on Slack's GDPR page https://slack.com/trust/compliance/gdpr and Privacy FAQs https://slack.com/trust/privacy/privacy-faq (search snippets)
- Mailing (US/Canada customers): Slack Technologies, LLC, 50 Fremont Street, San Francisco, CA 94105 (privacy policy snippet)
- Slack is a Salesforce subsidiary — the Salesforce channels below are a valid escalation path.

**Recommendation:** Email **dpo@slack.com** (cc **privacy@slack.com**) — the published DPO route is the correct front door for sub-processor due-diligence questions.

---

## Pylon (usepylon.com — Pylon Labs, Inc.)

| Name | Title | LinkedIn URL | Source |
|---|---|---|---|
| Aashish Kapur | "Security @ Pylon" per LinkedIn search snippet (ZoomInfo lists him as Software Engineer at Pylon; prior security-software role at Opal) — title UNCERTAIN | https://www.linkedin.com/in/aashishkapur/ | LinkedIn search snippet; ZoomInfo https://www.zoominfo.com/p/Aashish-Kapur/-1976491604; hire confirmed at usepylon by co-founder post https://www.linkedin.com/posts/advith_im-super-excited-to-welcome-aashish-to-the-activity-7231321556902100992-7Sx6 |
| Marty Kausas | Co-Founder & CEO (fallback) | https://www.linkedin.com/in/martykausas | LinkedIn search snippet; YC profile https://www.ycombinator.com/companies/pylon-2 |
| Advith Chelikani | Co-Founder (fallback) | https://www.linkedin.com/in/advith/ | LinkedIn search snippet; Crunchbase https://www.crunchbase.com/person/advith-chelikani-4788 |
| Robert Eng | Co-Founder (fallback) | https://www.linkedin.com/in/robert-eng | LinkedIn search snippet; YC profile https://www.ycombinator.com/companies/pylon-2 |

**Official channel:**
- Security questions: **security@usepylon.com** — per Pylon docs Security Overview, https://docs.usepylon.com/pylon-docs/security/security-overview (search snippet; page blocked direct fetch)
- Vulnerability reports: **vulnerability-disclosure@usepylon.com** — Vulnerability Disclosure Policy, https://www.usepylon.com/vulnerability-disclosure-policy (search snippet)
- Privacy policy (https://www.usepylon.com/legal/privacy) publishes **no privacy email** in the snippets found — only a mailing contact: "Pylon Labs, Inc. ATTN: General Counsel, 690 5th St., San Francisco, CA 94107 USA" (search snippet). If an email is required, use security@usepylon.com or the trust center.
- Trust center: **https://trust.usepylon.com/** (SOC 2, ISO 27001:2022, ISO/IEC 42001, GDPR, HIPAA docs; Vanta-monitored) — per search snippets of trust.usepylon.com and usepylon.com/security.

**Recommendation:** Email **security@usepylon.com** first (published security contact); fallback: LinkedIn message to CEO Marty Kausas.

---

## Salesforce (salesforce.com)

| Name | Title | LinkedIn URL | Source |
|---|---|---|---|
| Lindsey Finch | EVP, Global Privacy, Product (& AI) Legal; identified as Salesforce's Data Protection Officer in a Salesforce news Q&A — exact current title UNCERTAIN (snippet truncated) | https://www.linkedin.com/in/lindseycfinch/ | LinkedIn search snippet; Salesforce news story "Q&A: Salesforce's Data Protection Officer…" https://www.salesforce.com/news/stories/qa-salesforces-data-protection-officer-on-trust-gdpr-and-how-privacy-found-her/ |

**Official channel:**
- **privacy@salesforce.com** or **datasubjectrequest@salesforce.com**; phone +1-855-938-3410; or write to "Salesforce Data Protection Officer (Salesforce Privacy Team)" — per Salesforce Privacy Statement, https://www.salesforce.com/company/privacy/ (search snippet; page blocked direct fetch)
- Privacy request web form: https://www.salesforce.com/form/other/privacy-request/ (search result)

**Recommendation:** Email **privacy@salesforce.com** addressed to the Salesforce Data Protection Officer / Privacy Team — B2B due-diligence questions belong on the published privacy route, not an individual.

---

## Stripe (stripe.com)

| Name | Title | LinkedIn URL | Source |
|---|---|---|---|
| Todd Williams | Search summary associates him with a Privacy Counsel position at Stripe; snippet headline reads "Global Head of Privacy, IP, and …" — role/currency UNCERTAIN, verify before using | https://www.linkedin.com/in/twilliams1167/ | LinkedIn search snippet only |

**Official channel:**
- Data Protection Officer: **dpo@stripe.com** — per Stripe Privacy Policy (https://stripe.com/privacy) and Stripe support article "Contact Stripe's Data Protection Officer (DPO)", https://support.stripe.com/questions/contact-stripes-data-protection-officer-(dpo) (search snippets; pages blocked direct fetch)
- General privacy inquiries: **privacy@stripe.com**, or write to Stripe, Inc., 354 Oyster Point Boulevard, South San Francisco, CA 94080, Attn: Stripe Legal — Stripe Privacy Policy snippet, https://stripe.com/privacy
- Stripe Privacy Center referenced for data-protection rights: https://stripe.com/privacy-center/legal (referenced in policy snippet; not fetched — UNCERTAIN exact URL)

**Recommendation:** Email **dpo@stripe.com** (cc **privacy@stripe.com**) — Stripe publishes an explicit DPO contact route for exactly this kind of inquiry.

---

## Orb (withorb.com — Orb, Inc.)

| Name | Title | LinkedIn URL | Source |
|---|---|---|---|
| Alvaro Morales | Co-founder & CEO (fallback) | https://www.linkedin.com/in/alvaro-morales (snippet headline "Co-founder & CEO at Orb"; a second profile /in/alvmorales/ also surfaced — slight URL uncertainty) | LinkedIn search snippets; Forbes Tech Council https://www.forbes.com/councils/forbestechcouncil/people/alvaromorales/ |
| Kshitij Grover | Co-Founder and CTO (fallback; most likely owner of security/compliance topics at a startup this size) | https://www.linkedin.com/in/kshitij-grover-7754a456/ | LinkedIn search snippet |

No dedicated security/privacy/legal individual for Orb (withorb) surfaced in LinkedIn search results.

**Official channel:**
- Privacy requests: **privacy@withorb.com** — "You may submit privacy requests by email to privacy@withorb.com", Orb Privacy Policy, https://www.withorb.com/privacy-policy (search snippet; page blocked direct fetch)
- Security questions / vulnerability disclosure: **security@withorb.com** — "Please reach out to security@withorb.com for vulnerability reports, disclosures, and any questions about our security practices", https://www.withorb.com/security (search snippet)
- Trust center: **https://security.withorb.com/** (SafeBase; SOC 1 & SOC 2 Type II per https://www.withorb.com/blog/orb-achieves-soc-2-type-ii-compliance)
- Contact form: https://www.withorb.com/contact-us

**Recommendation:** Email **privacy@withorb.com** (cc **security@withorb.com**) first; fallback: LinkedIn message to CTO Kshitij Grover.
