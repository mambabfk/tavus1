# Vendor contacts — SAP DPP outreach

Compiled 2026-07-31, updated 2026-08-03: privacy/legal contacts, CTO/engineering
leaders, and security leaders for all 17 in-scope vendors. Sources: public
LinkedIn search results, vendor pages, dated press — full sourcing in the
sections below the table. No email addresses guessed; all published verbatim
by the vendors.

## Quick reference — 17 in-scope vendors

| Vendor | Primary channel | Privacy/legal | CTO / engineering | Security leader |
|---|---|---|---|---|
| Google Cloud | DPO form: support.google.com/cloud/contact/dpo | — (form only) | Will Grannis, VP & CTO Google Cloud | Chris Betz, CISO Google Cloud (ex-AWS CISO, named ~Jun 2026) |
| AWS | aws-EU-privacy@amazon.com + account team | — | Werner Vogels, VP & CTO Amazon | Amy Herzog, VP & CISO AWS (since Jun 2025) |
| Cerebrium | security@cerebrium.ai | Michael Louis, CEO | Jono Irwin, Co-founder & CTO | No security hire — security@cerebrium.ai; Vanta-monitored |
| Fal | trust.fal.ai; support@fal.ai | Burkay Gur, CEO | Gorkem Yurtseven, co-founder | No infosec hire (Security Compliance Lead role open); Sean Bonawitz leads Trust & Safety (content, not infosec) |
| ElevenLabs | legal@elevenlabs.io (DPO contact) | Alex Haskell, GC; Moussa Ismail, legal (privacy-certified) | — | No named CISO — security-assurance@elevenlabs.io |
| Cartesia | security@cartesia.ai | Michael Le, GC (uncertain) | Karan Goel, CEO/co-founder | Divyang Desai, consulting CISO (LOW confidence — verify) |
| Deepgram | security@deepgram.com → outsourced DPO | — | Adam Sypniewski, Co-founder & CTO | Ehab El-Ali, Director of Information Security |
| Daily | help@daily.co | Mark Backman, Data Privacy Manager | Kwindla Hultman Kramer, CEO | No named security lead |
| Mux | privacy@mux.com | — | Adam Brown, Co-founder & CTO | Jacqui Manzi, AppSec Lead / Sr Eng Manager |
| Cerebras | privacy@cerebras.net | — | Andrew Feldman, CEO; Andy Hock, CSO (product) | Naor Penso, CISO (verified current Dec 2025) |
| OpenAI | dpo@openai.com | — | Jakub Pachocki, Chief Scientist; Vijaye Raji, CTO Applications; Uday Ruddarraju, CTO Compute | Dane Stuckey, CISO |
| Groq | legal@groq.com; security@groq.com | Claire Hart, CLO | — | Tony Watson, CISO (verify LinkedIn before outreach) |
| Slack | dpo@slack.com | — | Parker Harris, CTO of Slack | No division CISO — escalate to Salesforce CSO Iain Mulholland |
| Pylon | security@usepylon.com | — | Advith Chelikani / Robert Eng, technical co-founders | Aashish Kapur, Security (engineer; confirmed via Forbes Mar 2026) |
| Salesforce | privacy@salesforce.com | Lindsey Finch, EVP Global Privacy | — | Iain Mulholland, Chief Security Officer (since Feb 2026; Brad Arkin departed Jan 2026) |
| Stripe | dpo@stripe.com | — | CTO seat vacant (Rahul Patil left Oct 2025) | Matthew Kemelhar, Head of Security (Joe Camilleri holds a "CISO" title, possibly Europe-entity-scoped) |
| Orb | privacy@withorb.com / security@withorb.com | Alvaro Morales, CEO | Kshitij Grover, Co-founder & CTO | No security hire — security@withorb.com; CTO is fallback |

Out of scope (removed 2026-08-03, research retained below): Replicate, Meta, InWorld.

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
# Top technical executives — Group 1 (Google Cloud, AWS, Meta, OpenAI)

Researched via web search on 2026-08-03. LinkedIn URLs come from search-result
snippets only (profiles are login-walled); every role claim carries a dated
source. No email addresses were researched or guessed.

## Google Cloud (division of Alphabet/Google)

| Field | Value |
|---|---|
| Name | Will Grannis |
| Exact title | VP and CTO, Google Cloud |
| LinkedIn | https://www.linkedin.com/in/wgrannis (snippet title: "Will Grannis - VP and CTO, Google Cloud") |
| Confirming source 1 | Google Cloud press corner bio: https://www.googlecloudpresscorner.com/Will-Grannis |
| Confirming source 2 | SiliconANGLE interview, 2026-05-20: https://siliconangle.com/2026/05/20/enterprise-agentic-ai-focus-google-cloud-googlecloudnext/ ; Cloud Wars interview, 2026-04-13: https://cloudwars.com/ai/google-clouds-will-grannis-on-culture-metrics-and-winning-the-ai-economy/ |
| As of | May 2026 (most recent dated source found) |

**Confidence: High.** Division-level CTO exists and is current — multiple 2026
interviews identify him as Google Cloud CTO (role held since 2020). Note:
Google/Alphabet has no corporate-parent CTO; Grannis is the relevant tech
executive for the Cloud division.

## Amazon Web Services (AWS)

| Field | Value |
|---|---|
| Name | Dr. Werner Vogels |
| Exact title | VP and Chief Technology Officer, Amazon.com (corporate parent — AWS has **no division-level CTO**) |
| LinkedIn | https://www.linkedin.com/in/wernervogels/ (snippet title: "Werner Vogels - Amazon.com") |
| Confirming source 1 | Fortune, 2026-07-09 ("Amazon's CTO on how developers can ride out the AI-powered coding wave"): https://fortune.com/2026/07/09/amazons-cto-on-how-developers-can-ride-out-the-ai-powered-coding-wave/ |
| Confirming source 2 | AboutAmazon / AWS Executive Insights, 2026 predictions (published ~Nov 2025): https://www.aboutamazon.com/news/aws/werner-vogels-amazon-cto-predictions-2026 |
| As of | July 2026 |

**Confidence: High** for Vogels being current Amazon CTO (Fortune feature dated
2026-07-09). **Structural note:** AWS the division does not have its own CTO
title; Vogels (Amazon corporate CTO since 2005) is the closest and most
public-facing technical executive and is strongly AWS-associated. Secondary
division-level contact: **Peter DeSantis**, long-time SVP of AWS Utility
Computing, who in an early-2026 restructure by CEO Andy Jassy now leads a new
unified org for AI models (Nova), custom silicon (Trainium/Graviton/Nitro),
and quantum computing — sources: https://www.aboutamazon.com/news/company-news/andy-jassy-peter-desantis-amazon-leadership-update
and https://www.ciodive.com/news/amazon-ai-chief-exits-leadership-shakeup/808189/ (2026);
LinkedIn: https://www.linkedin.com/in/peterdesantis/ (snippet gives no title —
title from press sources, not the LinkedIn snippet).

## Meta Platforms

| Field | Value |
|---|---|
| Name | Andrew "Boz" Bosworth |
| Exact title | Chief Technology Officer, Meta (also Head of Reality Labs) |
| LinkedIn | https://www.linkedin.com/in/andrew-bosworth-8247a01/ (snippet shows "Palo Alto, California"; matching /posts/andrew-bosworth-8247a01_ activity appears in results — high but not absolute certainty this is the Meta CTO's profile, as the snippet itself did not state the title) |
| Confirming source 1 | Meta leadership page (current): https://www.meta.com/about/leadership/andrew-boz-bosworth/ |
| Confirming source 2 | Fortune, 2026-04-24: https://fortune.com/2026/04/24/meta-cto-andrew-bosworth-only-stressed-5-times-a-year-actually-useful-signal/ ; PYMNTS 2026: https://www.pymnts.com/meta/2026/meta-cto-leads-efforts-to-equip-workforce-with-ai-tools/ |
| As of | April 2026+ |

**Confidence: High** on name/title (CTO since 2022, multiple 2026 sources).
**Medium** on the LinkedIn URL — flagged above; Bosworth is not very active on
LinkedIn and the snippet did not carry his title.

## OpenAI

**No single company-wide CTO exists.** Mira Murati (the last company-wide CTO)
departed in September 2024 (https://techcrunch.com/2024/09/25/openais-chief-research-officer-has-left).
OpenAI has since split the role into divisional CTOs; the top research/technical
executive is the Chief Scientist.

| Field | Value |
|---|---|
| Name (top technical/research exec) | Jakub Pachocki |
| Exact title | Chief Scientist, OpenAI (since May 2024, succeeding Ilya Sutskever) |
| LinkedIn | https://www.linkedin.com/in/jakub-pachocki/ (snippet title: "Jakub Pachocki - OpenAI") |
| Confirming source 1 | OpenAI announcement: https://openai.com/index/jakub-pachocki-announced-as-chief-scientist/ (May 2024) |
| Confirming source 2 | MIT Technology Review, 2026-03-20 (identifies him leading OpenAI research direction): https://www.technologyreview.com/2026/03/20/1134438/openai-is-throwing-everything-into-building-a-fully-automated-researcher/ |
| As of | March 2026 |

Divisional CTOs (both current, both plausible B2B outreach targets):

| Name | Exact title | LinkedIn | Confirming source | As of |
|---|---|---|---|---|
| Vijaye Raji | CTO of Applications (product engineering for ChatGPT and Codex; reports to Fidji Simo) | https://www.linkedin.com/in/vijaye (inferred from his LinkedIn posts URL slug `/posts/vijaye_...` — flagged as inferred, not from a direct profile snippet) | OpenAI announcement, Sept 2025: https://openai.com/index/vijaye-raji-to-become-cto-of-applications-with-acquisition-of-statsig/ ; Reuters via TradingView, 2025 | Sept 2025 (no contradicting newer results) |
| Uday Ruddarraju | CTO, Compute (promoted July 2026; ex-xAI Head of Infrastructure Engineering) | https://www.linkedin.com/in/udaykumarraju/ (snippet title: "Uday Ruddarraju - OpenAI") | DataCenterDynamics: https://www.datacenterdynamics.com/en/news/uday-ruddarraju-named-openais-cto-of-compute/ ; American Bazaar, 2026-07-20: https://americanbazaaronline.com/2026/07/20/openal-elevates-uday-ruddaraju-to-cto-484824/ | July 2026 |

**Confidence: High** on the structure (no single CTO) and on Pachocki and
Ruddarraju; **Medium** on Raji's exact LinkedIn URL (inferred from posts slug).
Also relevant: Mark Chen, Chief Research Officer (per MIT Tech Review
2026-03-20); Greg Brockman, President/co-founder.
# Top technical executives — Group 2 (Deepgram, Mux, Slack, Stripe)

Researched via web search on 2026-08-03. LinkedIn URLs come from search-result
snippets only (profiles are login-walled); every role claim carries a dated
source. No email addresses were researched or guessed.

## Deepgram (deepgram.com — speech-to-text)

| Field | Value |
|---|---|
| Name | Adam Sypniewski |
| Exact title | Co-founder & Chief Technology Officer, Deepgram |
| LinkedIn | https://www.linkedin.com/in/adam-sypniewski-32a25982/ (snippet title: "Adam Sypniewski - CTO at Deepgram") |
| Confirming source 1 | Deepgram's own X/Twitter account, 2025-08 ("Deepgram CTO, Adam Sypniewski, breaks down why sub-second latency…"): https://x.com/DeepgramAI/status/1957492842169090552 |
| Confirming source 2 | Crunchbase person profile ("Adam Sypniewski - CTO @ Deepgram"): https://www.crunchbase.com/person/adam-sypniewski ; Deepgram author page: https://deepgram.com/authors/adam-sypniewski |
| As of | Aug 2025 (most recent dated source found; no contradicting newer result) |

**Confidence: High.** Technical co-founder (founded 2015 with CEO Scott
Stephenson and Noah Shutty) who holds the CTO title; Deepgram's own channel
called him CTO in Aug 2025 and nothing newer contradicts it. Minor flag: no
2026-dated source was found — freshest confirmation is ~12 months old.

## Mux (mux.com — video infrastructure)

| Field | Value |
|---|---|
| Name | Adam Brown |
| Exact title | Co-founder & CTO (Mux team page / The Org); Crunchbase lists it as "Co-founder, Head of Technology and Architecture" — see note |
| LinkedIn | https://www.linkedin.com/in/adam-brown-7452b03a/ (snippet title: "Adam Brown - Mux"; snippet did not state a title) |
| Confirming source 1 | Mux team page ("Blog posts by Adam Brown", listed as Co-Founder, CTO per search snippet): https://www.mux.com/team/adam-brown |
| Confirming source 2 | The Org ("Adam Brown - Co-Founder & CTO at Mux"): https://theorg.com/org/mux/org-chart/adam-brown ; Crunchbase ("Co-founder, Head of Technology and Architecture @ Mux"): https://www.crunchbase.com/person/adam-brown-7 |
| As of | 2026-08-03 search date; underlying sources are undated aggregator/company pages |

**Confidence: Medium-High** that Adam Brown is the top technical executive
(technical co-founder alongside CEO Jon Dahl). **Title uncertainty flagged:**
sources split between "Co-Founder & CTO" (Mux site, The Org, RocketReach)
and "Co-founder, Head of Technology and Architecture" (Crunchbase) — the
latter may reflect a re-titling; none of the sources carry a 2025/2026 date.
No departure or replacement was found in any search result. LinkedIn snippet
itself did not confirm the title — do not cite LinkedIn alone for Mux.

## Slack (slack.com — Salesforce subsidiary)

| Field | Value |
|---|---|
| Name | Parker Harris |
| Exact title | Chief Technology Officer, Slack (also Co-founder of Salesforce; Salesforce board member) |
| LinkedIn | https://www.linkedin.com/in/parker-harris-451040211/ (snippet title: "Parker Harris - CTO Salesforce" — snippet wording lags his Slack move; see note) |
| Confirming source 1 | Salesforce official bio ("Parker Harris, Co-Founder, Salesforce & Chief Technology Officer, Slack"): https://www.salesforce.com/company/parker-harris-bio/ (headshot/news page: https://www.salesforce.com/news/parker-harris-headshot-2017/) |
| Confirming source 2 | diginomica, 2026 (post-TDX 2026, ~Apr 2026): "Slack CTO Parker Harris gets personal about a game-changing overhaul": https://diginomica.com/slackbot-re-born-agentic-enterprise-slack-cto-parker-harris-gets-personal-about-game-changing ; TDX 2026 coverage: https://salesforcetrail.com/tdx-2026-slack-front-door-agentic-enterprise/ |
| As of | ~April 2026 (TDX 2026 press coverage) |

**Confidence: High.** Harris (Salesforce co-founder) took over as Slack's
technology chief in Jan/Feb 2024 after co-founder Cal Henderson stepped down
(Yahoo Finance/Fortune exclusive: https://finance.yahoo.com/news/exclusive-slack-cto-cal-henderson-170000293.html).
Do **not** contact Cal Henderson — he departed in 2024. Flags: (a) the original
Jan 2024 announcement used "Slack Chief Engineering Officer"
(https://www.salesforceben.com/parker-harris-to-become-slack-chief-engineering-officer-after-co-founder-leaves/),
but 2026 sources consistently say "CTO, Slack"; (b) his LinkedIn snippet still
reads "CTO Salesforce" — prefer the Salesforce bio + 2026 press for the title.

## Stripe (stripe.com — payments)

| Field | Value |
|---|---|
| Name | **Role vacant / successor not publicly announced** — do not list a current CTO |
| Exact title | n/a (last holder: Rahul Patil, CTO Aug 2024 – Oct 2025, departed) |
| LinkedIn | n/a |
| Confirming source 1 | Anthropic newsroom, 2025-10: "Rahul Patil joins Anthropic as Chief Technology Officer" (he "most recently served as CTO of Stripe"): https://www.anthropic.com/news/rahul-patil-joins-anthropic |
| Confirming source 2 | TechCrunch, 2025-10-02: https://techcrunch.com/2025/10/02/anthropic-hires-new-cto-with-focus-on-ai-infrastructure/ ; prior succession context (Singleton → Patil, Sep 2024): https://www.financemagnates.com/executives/stripe-promotes-rahul-patil-to-chief-technology-officer-david-singleton-departs/ |
| As of | 2026-08-03 (searches covering Oct 2025 – Aug 2026 found no successor announcement) |

**Confidence: High that the seat is publicly unfilled; low visibility on who
runs engineering day-to-day.** Timeline: David Singleton (CTO 7 yrs) stepped
down Aug/Sep 2024 → Rahul Patil promoted from Deputy CTO → Patil left for
Anthropic Oct 2025. Multiple searches ("Stripe new CTO", newsroom queries,
Nov 2025–2026 windows) surfaced **no** announced replacement; Stripe's 2026
newsroom items cover other roles (Eileen O'Mara vice chair, Tyler Bryson CRO:
https://stripe.com/newsroom/news/eileen-omara-named-vice-chair-of-stripe-tyler-bryson-appointed-chief-revenue-officer).
Note: Rajeev Rajan (ex-Atlassian CTO) joined Stripe in Apr 2026 but as
"Business Lead, Revenue and Financial Automation" — **not** CTO
(https://hrtoday.in/rajeev-rajan-joins-stripe-as-business-lead-for-revenue-and-financial-automation-rfa-division/).
For outreach, no individual can be named as Stripe's current top engineering
executive from public sources; engineering leads found are regional/divisional
only (e.g., Felix Fung, Head of Engineering, Business Network — Stripe
Sessions 2026: https://stripe.com/sessions/2026/opening-remarks-and-product).
# CISO / Head of Security — Group 1

Research date: 2026-08-03. Method: WebSearch (LinkedIn-targeted + press/newsroom queries). LinkedIn URLs are taken only from search-result snippets (profiles are login-walled); "not found in snippets" means no URL is asserted rather than guessed. No emails included.

## Google Cloud

| Field | Value |
|---|---|
| Name | Chris Betz |
| Title | CISO, Google Cloud |
| LinkedIn | https://www.linkedin.com/in/chris-betz-903b739b (search snippet title: "Chris Betz - CISO, Google Cloud") |
| Sources | Infosecurity Magazine interview "Google Cloud's New CISO Chris Betz on Integrating AI in Cyber Defenses" — https://www.infosecurity-magazine.com/interviews/google-cloud-new-ciso-chris-betz/ ; Google Cloud blog "Cloud CISO Perspectives: The 4 lessons that guided AI Threat Defense" (byline Chris Betz, ~June 2026) — https://cloud.google.com/blog/products/identity-security/cloud-ciso-perspectives-the-4-lessons-that-guided-ai-threat-defense ; Cloud Security Podcast by Google EP283 "How Google Cloud CISO Chris Betz…" — https://open.spotify.com/episode/1Z72zJ8wHmIEpJw624alQp |
| As of | June 2026 (named Google Cloud CISO; per search results he joined Google in 2025 as VP infrastructure security and was formally titled CISO ~June 2026) |

Confidence: **High** — multiple mid-2026 sources; note this is the same Chris Betz who was AWS CISO until mid-2025. Prior holder Phil Venables stepped down March 2025 (announced on X/LinkedIn, March 2025; now strategic security advisor + Ballistic Ventures venture partner — https://www.securityweek.com/former-google-cloud-ciso-phil-venables-joins-ballistic-ventures/). Do NOT contact Venables as Google Cloud CISO.

## Amazon Web Services (AWS)

| Field | Value |
|---|---|
| Name | Amy Herzog |
| Title | Vice President and Chief Information Security Officer (CISO), AWS |
| LinkedIn | https://www.linkedin.com/in/amy-herzog-98bb6 (slug derived from her LinkedIn post URL linkedin.com/posts/amy-herzog-98bb6_… in search snippets) |
| Sources | The Stack, "Amy Herzog replaces Chris Betz as new AWS CISO" (June 2025) — https://www.thestack.technology/amy-herzog-new-aws-ciso/ ; Help Net Security interview describing her as AWS VP & CISO (2025-08-13) — https://www.helpnetsecurity.com/2025/08/13/amy-herzog-aws-scale-cloud-native-security/ |
| As of | August 2025 (appointed June 2025; no later contradicting result found as of Aug 2026) |

Confidence: **High** — clear June 2025 appointment coverage; predecessor Chris Betz's move to Google Cloud independently corroborates the change. Corporate note: Amazon-wide CSO remains Steve Schmidt per long-standing structure (not re-verified here; AWS-division contact is Herzog).

## OpenAI

| Field | Value |
|---|---|
| Name | Dane Stuckey |
| Title | Chief Information Security Officer (was co-CISO alongside Matt Knight until Knight's Jan 2026 resignation) |
| LinkedIn | Not found in search snippets — do not guess. (Bloomberg exec profile: https://www.bloomberg.com/profile/person/24250712) |
| Sources | SecurityWeek "Dane Stuckey Joins OpenAI as CISO" (Oct 2024) — https://www.securityweek.com/dane-stuckey-joins-openai-as-ciso/ ; Simon Willison, "Dane Stuckey (OpenAI CISO) on prompt injection risks for ChatGPT Atlas" (2025-10-22) — https://simonwillison.net/2025/Oct/22/openai-ciso-on-atlas/ ; Matt Knight resignation coverage (Jan 2026), incl. LinkedIn snippet "Matthew Knight - Former CISO and VP at OpenAI" — https://www.linkedin.com/in/matthewfknight |
| As of | October 2025 explicitly titled "OpenAI CISO"; still referenced in 2026 security commentary. |

Confidence: **Medium-high** — Stuckey clearly CISO through late 2025; co-CISO Matt Knight resigned Jan 2026 (flag: post-departure OpenAI security org may have been restructured; no announcement found naming anyone other than Stuckey). Do NOT contact Matt Knight — departed.

## Groq

| Field | Value |
|---|---|
| Name | Paul "Tony" Watson |
| Title | Chief Information Security Officer (CISO), Groq |
| LinkedIn | Not confidently identified in snippets — a "Paul Watson" profile (linkedin.com/in/pawatson) appeared but could not be verified as the same person; do not use without checking. RocketReach corroborating listing: https://rocketreach.co/paul-tony-watson-email_37268891 |
| Sources | Black Hat MEA speaker page "Tony Watson" (bio: joined Groq as CISO in 2020 after 17 years at Google; listed for Black Hat MEA 2025) — https://blackhatmea.com/speaker/tony-watson ; Black Hat MEA video "Meet Tony Watson, Chief Information Security Officer at Groq" — https://www.facebook.com/Blackhatmea/videos/945567027623215/ |
| As of | Black Hat MEA 2025 speaker listing (conference bio) |

Confidence: **Medium** — no press-release trail (Groq has never announced the role in its newsroom); identity rests on conference bios. Verify LinkedIn manually before outreach. No evidence of departure found.

## Cerebras Systems

| Field | Value |
|---|---|
| Name | Naor Penso |
| Title | Chief Information Security Officer (CISO) |
| LinkedIn | https://www.linkedin.com/in/naorpenso/ (search snippet: "Naor Penso - Cerebras Systems") |
| Sources | Business Wire / Cerebras press release, appointment announced 2025-03-05 — https://www.cerebras.ai/press-release/cerebras-bolsters-leadership-team-with-appointment-of-new-ciso-evp-of-worldwide-sales-and-svp-of-ai-cloud-and-inference ; Help Net Security interview identifying him as "CISO at Cerebras Systems" (2025-12-19) — https://www.helpnetsecurity.com/2025/12/19/naor-penso-cerebras-systems-threat-modeling-al-optimized-infrastructure/ |
| As of | December 2025 (verified still current; no contradicting 2026 result) |

Confidence: **High** — prior belief VERIFIED. Appointed March 2025 (ex-FICO VP & Head of Product Security), independently confirmed in role Dec 2025.

## Slack (Salesforce)

| Field | Value |
|---|---|
| Name | Brad Arkin (Salesforce-level; no current Slack-division security chief publicly named) |
| Title | EVP, Chief Trust Officer, Salesforce |
| LinkedIn | Not found in search snippets. Org-chart listing: https://theorg.com/org/salesforce/org-chart/brad-arkin |
| Sources | SecurityWeek "Brad Arkin is New Chief Trust Officer at Salesforce" (Jan/Feb 2024 appointment) — https://www.securityweek.com/brad-arkin-is-new-chief-trust-officer-at-salesforce/ ; Salesforce announcement — https://www.salesforce.com/news/stories/chief-trust-officer/ ; active Salesforce blog author page with 2025/2026 content — https://www.salesforce.com/blog/author/brad-arkin/ |
| As of | 2025/2026 (still publishing as Salesforce Chief Trust Officer) |

Confidence: **Medium-high** on Arkin; **explicit gap** on Slack division level. Slack's last announced CSO, Sean Catlett (appointed Oct 2020 — https://slack.com/blog/transformation/new-chief-security-officer-slack), **departed** and is now Chief Information & Trust Officer at Bumble (Bumble/conference bios, e.g. https://aifortherestofus.live/london-2025/speakers/sean-catlett) — do NOT use him for Slack. No dated 2025/2026 source names a successor Slack CSO/CISO; searches surfaced only pre-2021 material (e.g. Larkin Ryder "interim CISO" is a 2020 artifact, not current). Recommend targeting Arkin's Salesforce Trust org, or manually confirming a Slack security lead on LinkedIn before outreach.
# CISO / Head of Security — Group 2

Research date: 2026-08-03. Method: WebSearch (LinkedIn-targeted `site:linkedin.com/in` + press/team-page/trust-center queries). LinkedIn URLs are taken only from search-result snippets (profiles are login-walled); "not found in snippets" means no URL is asserted rather than guessed. No emails guessed — any email listed is verbatim from the company's own published page.

## ElevenLabs (elevenlabs.io)

| Field | Value |
|---|---|
| Name | **No publicly named CISO / Head of Security found** |
| Title | n/a — security team exists (job postings reference "the ElevenLabs Security team") but no security-titled leader surfaced in any snippet |
| LinkedIn | n/a |
| Sources | Careers: "Infrastructure Security Engineer" posting referencing the ElevenLabs Security team — https://elevenlabs.io/careers/687394d7-fbf8-49ed-822e-c0690191330c/infrastructure-security-engineer (open as of Aug 2026 searches); Trust Center — https://compliance.elevenlabs.io/ (SOC 2 Type II, ISO 27001, PCI DSS L1); DPA page publishes security contact `security-assurance@elevenlabs.io` (stated on https://elevenlabs.io/dpa, retrieved via search 2026-08-03) |
| As of | 2026-08-03 (searches) |

Confidence: **Medium** (on the negative finding). Multiple query shapes (CISO / Head of Security / VP Security / Director of Security, LinkedIn-scoped and press-scoped) returned no named security leader; exec sources (CB Insights, websets exa directory) list only CEO Mati Staniszewski and CTO Piotr Dąbkowski among named executives. False lead to avoid: search-engine summaries repeatedly suggested David Hannigan "joined ElevenLabs" — follow-up shows Hannigan is Field CISO at **Halcyon** (Aphinia CISO Wire appointment note; LinkedIn headline "Strategic Advisor @ Halcyon" — https://www.linkedin.com/in/david-hannigan-8ab2a1/); no source ties him to ElevenLabs. Do not use. Closest named adjacent role: Aleksandra Pedraszewska leads **AI Safety** (not infosec) per TechCrunch author bio — https://techcrunch.com/author/aleksandra-pedraszewska. Practical route: `security-assurance@elevenlabs.io` (published) or CTO Piotr Dąbkowski (https://www.linkedin.com/in/piotr-dabkowski-50222bba/) as senior technical owner — the latter is inference from org shape, not a sourced security-ownership claim.

## Cartesia (cartesia.ai)

| Field | Value |
|---|---|
| Name | Divyang Desai — **unverified, low confidence** (see note) |
| Title | "Consulting CISO and Data Protection" at Cartesia (per RocketReach listing title; LinkedIn snippet confirms current company "Cartesia") |
| LinkedIn | https://www.linkedin.com/in/divyangkdesai/ (snippet title: "Divyang Desai - Cartesia \| LinkedIn") |
| Sources | RocketReach profile "Divyang Desai … Cartesia Consuting CISO and Data Ptotection" — https://rocketreach.co/divyang-desai-email_5495454 (undated aggregator; typos in listing verbatim); LinkedIn snippet via search 2026-08-03; background per snippets: KlearNow, eBay, View Inc., PayPal; based in California |
| As of | 2026-08-03 (aggregator snippets only — no dated primary source) |

Confidence: **Low**. Two unresolved risks: (1) ambiguity whether his "Cartesia" is the voice-AI company (cartesia.ai, SF) or an unrelated firm — his California/SF location fits, but no snippet says "cartesia.ai" or "voice"; (2) RocketReach data is frequently stale, and a *consulting* (fractional) CISO may have ended. Cartesia's own org listings (The Org — https://theorg.com/org/cartesia) show **no security-titled employee**: leadership is Karan Goel (Founder/CEO), co-founders Brandon Yang and Arjun Desai, Israel Shalom (Head of Product). Compliance posture is real (SOC 2 Type II, HIPAA, PCI-DSS, GDPR announced Sept 2025 — https://www.cartesia.ai/blog/gdpr-compliance; safety page https://www.cartesia.ai/legal/safety/) but no page names a security owner. Treat as: no confirmed dedicated security hire; verify Desai on LinkedIn before any outreach; fallback is the founding team (CEO Karan Goel).

## Deepgram (deepgram.com)

| Field | Value |
|---|---|
| Name | Ehab El-Ali |
| Title | Director of Information Security |
| LinkedIn | https://www.linkedin.com/in/ehab-el-ali-7868643/ (snippet title: "Ehab El-Ali - Deepgram \| LinkedIn") |
| Sources | Deepgram's own author page — https://deepgram.com/authors/ehab-el-ali (bio: 15+ yrs InfoSec/SysEng; ran HIPAA, HITRUST, SOC-2, GDPR, CCPA, PCI DSS programs; previously Information Security Principal & Compliance Engineer at Verato); The Org, Deepgram IT team: "Ehab El-Ali as Director Of Information Security" — https://theorg.com/org/deepgram/teams/information-technology-team; ZoomInfo: "Director, Information Security at Deepgram" — https://www.zoominfo.com/p/Ehab-El-ali/1855560858 |
| As of | 2026-08-03 (searches; still listed by Deepgram's own site + two aggregators; no departure signal found) |

Confidence: **High** for name+title (company's own author page corroborated by two independent aggregators). Caveats: no 2025/2026-dated announcement pinning tenure start; Deepgram's security docs also mention "a security advisor for Information Security, Risk Management, and Compliance" (https://developers.deepgram.com/trust-security/information-security-privacy) — likely the same function, possibly stale boilerplate. Org context: CTO Adam Sypniewski; Nik King, Head of Infrastructure & SRE (both per The Org IT-team page). El-Ali is the correct security contact.

## Daily (daily.co)

| Field | Value |
|---|---|
| Name | **No publicly named security lead found — no evidence of a dedicated security hire** |
| Title | n/a |
| LinkedIn | n/a |
| Sources | Security & compliance page (SOC 2 Type II — Security & Confidentiality TSC; EU-US/Swiss-US Data Privacy Framework; AWS SOC1/SOC2/ISO 27001 data centers) — https://www.daily.co/products/security-at-daily/ (retrieved via search 2026-08-03) — page describes controls, names no person; leadership searches surface only Kwindla Hultman Kramer, Co-founder & CEO — https://www.linkedin.com/in/kwkramer/ , https://theorg.com/org/daily-co/org-chart/kwindla-hultman-kramer |
| As of | 2026-08-03 (searches) |

Confidence: **Medium** (negative finding). LinkedIn-scoped searches for Daily + security titles returned only false positives from **DailyPay** (John Abel, CISO at DailyPay — different company, do not use). No source names who owns security at Daily, so per rules no owner is asserted; the only sourced senior contact is CEO/co-founder Kwindla Hultman Kramer. Note for the Tavus context: Daily is Tavus's WebRTC substrate, so an existing commercial channel likely beats cold security outreach here.

## Mux (mux.com)

| Field | Value |
|---|---|
| Name | Jacqueline "Jacqui" Manzi |
| Title | Senior Engineering Manager & Application Security Lead (Mux's team page wording) |
| LinkedIn | https://www.linkedin.com/in/jacquelinemanzi/ (snippet title: "Jacqueline Manzi - Mux \| LinkedIn") |
| Sources | Mux team page (title "Senior Engineering Manager & Application Security Lead" appears in mux.com/team search snippet, 2026-08-03) — https://www.mux.com/team and https://www.mux.com/team/jacqui-manzi ; The Org: "Jacqueline Manzi - Senior Engineering Manager & Application Security Lead at Mux" — https://theorg.com/org/mux/org-chart/jacqueline-manzi ; Bloomberg exec profile — https://www.bloomberg.com/profile/person/23237454 |
| As of | 2026-08-03 (title from Mux's own live team page via search snippet) |

Confidence: **Medium-high**. She is the highest security-titled person findable at Mux — no CISO / Head of Security / VP Security surfaced in any query. Title conflict to flag: her LinkedIn snippet headline reads "Senior Manager: Engineering" (managing Platform Experience: security, APIs, notifications, billing, web-client) — i.e., security is part of a broader platform-eng remit, not a dedicated security org. Treat outreach as "security-titled engineering leader," not CISO.

## Cerebrium (cerebrium.ai)

| Field | Value |
|---|---|
| Name | **No dedicated security hire — none found** |
| Title | n/a — security/compliance run by the founding eng team ("Compliance is continually monitored through Vanta and a dedicated team" per their docs; no person named) |
| LinkedIn | n/a for security; co-founder & CTO: Jono Irwin — https://www.linkedin.com/in/jono-irwin/ (snippet: "Jono Irwin - Co-founder & CTO @ Cerebrium (YC W22)") |
| Sources | Security & Data Privacy docs (SOC 2, HIPAA, GDPR; publishes contact `security@cerebrium.ai`) — https://cerebrium.ai/docs/security (retrieved via search 2026-08-03); SOC 2 Type II announcement, dated 2026-07-15 per search result — https://cerebrium.ai/blog/cerebrium-achieves-soc-2-type-ii-compliance-for-secure-production-ai-infrastructure ; founder Michael Louis — https://www.linkedin.com/in/michael-louis-94104a113/ |
| As of | 2026-08-03 (searches; SOC 2 Type II post dated 2026-07-15) |

Confidence: **Medium-high** (negative finding — very small YC W22 startup; no security-titled person in any LinkedIn or press snippet). Security ownership is not explicitly attributed by any source; the sourced senior technical leader is co-founder/CTO Jono Irwin, and the company's own published security contact is `security@cerebrium.ai` (verbatim from their docs page, not guessed). Fresh signal: SOC 2 Type II completed July 2026, so compliance function is active.
# CISO / Head of Security — Group 3

Researched via WebSearch (LinkedIn snippets + press). All "as of" dates = date the confirming snippet was retrieved (2026-08-03) unless a source carries its own date. No emails guessed.

## Salesforce (corporate CSO/CISO)

| Name | Title | LinkedIn | Source | As of |
|---|---|---|---|---|
| Iain Mulholland | Chief Security Officer (The Org lists "EVP, CISO") | https://www.linkedin.com/in/iainmulholland/ | CIO.com, "Salesforce lays off staffers as executive leadership churn continues" — https://www.cio.com/article/4130028/salesforce-lays-off-staffers-as-executive-leadership-churn-continues.html (2026); The Org — https://theorg.com/org/salesforce/org-chart/iain-mulholland ; The Org LinkedIn post "Salesforce Names Iain Mulholland Chief Security Officer" (Feb 2026) — https://www.linkedin.com/posts/theorg_executive-moves-you-should-know-about-february-activity-7430254300301500417-tYW7 | 2026-08-03 |

**Confidence: High.** Mulholland joined from Google (was Deputy CISO, Google Cloud & Technical Infrastructure) in Feb 2026, replacing Brad Arkin. **Departure noted:** Brad Arkin (Chief Trust Officer since Feb 2024) left Salesforce on 2026-01-30 (per Salesforce Ben, https://www.salesforceben.com/3-senior-salesforce-executives-leave-within-3-months/) — do NOT contact Arkin as current. Minor title variance: press says "Chief Security Officer", The Org says "EVP, CISO".

## Stripe (stripe.com)

| Name | Title | LinkedIn | Source | As of |
|---|---|---|---|---|
| Matthew Kemelhar | Head of Security | https://www.linkedin.com/in/matthew-kemelhar-69058723 | LinkedIn headline "Head of Security at Stripe" (search snippet); ZoomInfo concurs — https://www.zoominfo.com/p/Matthew-Kemelhar/2465708474 | 2026-08-03 |
| Joe Camilleri | CISO (title per LinkedIn headline) | https://www.linkedin.com/in/joe-camilleri-4392a24/ | LinkedIn headline "CISO at Stripe" (search snippet); Crunchbase — https://www.crunchbase.com/person/joe-camilleri (CISO since Dec 2021); several aggregators also list him as Non-Executive Director, Stripe Technology Europe (board, since Mar 2023) — https://muraena.ai/profile/joe_camilleri_306d682c | 2026-08-03 |

**Confidence: Medium — conflicting titles, flagged.** Two people carry current top-security-sounding LinkedIn headlines: Kemelhar ("Head of Security", 6+ yrs at Stripe, ex-Microsoft IR / ex-NSA; snippet says he oversees security infrastructure, regulatory compliance, detection and privacy engineering) and Camilleri ("CISO", GRC background ex-Twitter/Morgan Stanley, plus a board seat at Stripe's regulated Irish entity — his CISO title may be entity/GRC-scoped). Recommend Kemelhar as primary outreach, Camilleri as alternate. **Conflicts/departures:** (1) Jonathan Kaltwasser is listed as "CISO at Stripe" only by Comparably (https://www.comparably.com/companies/stripe/jonathan-kaltwasser — undated aggregator); RocketReach (https://rocketreach.co/jonathan-kaltwasser-email_13051504) shows Stripe as a PAST role, current "SVP at Stealth Startup" — treat Kaltwasser as departed, not current. (2) Niels Provos, Head of Security 2018–2022, long gone (LinkedIn headline "ex-Google/Stripe", https://www.linkedin.com/in/nielsprovos/) — stale, do not use.

## Pylon (usepylon.com)

| Name | Title | LinkedIn | Source | As of |
|---|---|---|---|---|
| Aashish Kapur | Security @ Pylon (LinkedIn headline); security engineer — no CISO title | https://www.linkedin.com/in/aashishkapur/ | LinkedIn headline "Security @ Pylon" (search snippet); Forbes, 2026-03-18, quotes "Aashish Kapur, an engineer at Pylon" on Pylon's security tooling — https://www.forbes.com/sites/thomasbrewster/2026/03/18/corridor-200-million-ai-cyber-startup/ | 2026-08-03 (Forbes 2026-03-18) |

**Confidence: Medium-high — lead resolved.** The ZoomInfo "Software Engineer" (https://www.zoominfo.com/p/Aashish-Kapur/-1976491604) vs LinkedIn "Security @ Pylon" conflict is consistent, not contradictory: Kapur is a security-focused software engineer (prior: Senior SWE in security software at Opal; Samsara; AWS — per LinkedIn/aggregator snippets), and Pylon posts a "Software Engineer, Security" role (https://jobs.ashbyhq.com/pylon-labs/8763ee7a-3f07-4a88-8b75-76700bf02511). He is Pylon's security-titled person and the right outreach contact; he is NOT a founder. No public CISO name: Pylon's security page (https://www.usepylon.com/security) says to contact them "to get in touch with their CISO" without naming one; trust center https://trust.usepylon.com/ (SOC 2 Type II, ISO 27001:2022, ISO 42001).

## Orb (withorb.com)

| Name | Title | LinkedIn | Source | As of |
|---|---|---|---|---|
| — no dedicated security hire found — | — | — | Trust center https://security.withorb.com/ (SafeBase); security page https://www.withorb.com/security lists security@withorb.com as the security contact; no security-titled person surfaced in any LinkedIn/press search | 2026-08-03 |
| Kshitij Grover (fallback owner) | Co-Founder & CTO — leads technical strategy and the engineering org | https://www.linkedin.com/in/kshithappens/ | Crunchbase https://www.crunchbase.com/person/kshitij-grover ; The Org https://theorg.com/org/withorb/org-chart/kshitij-grover | 2026-08-03 |

**Confidence: Medium.** Explicit negative: searches for Orb + CISO / head of security / security engineer returned no named person. Orb is SOC 1 / SOC 2 Type II certified with a SafeBase trust center, so security is program-run but engineering-owned; no source explicitly states Grover "owns security" — he is cited only as Co-Founder/CTO leading engineering, so use security@withorb.com or Grover as best-available contact, clearly labeled as inference.

## fal (fal.ai)

| Name | Title | LinkedIn | Source | As of |
|---|---|---|---|---|
| — no CISO / Head of (info)Security found — | — | — | fal was publicly hiring a "Security Compliance Lead" (LinkedIn job https://www.linkedin.com/jobs/view/security-compliance-lead-at-fal-4303107795 ; fal careers https://fal.ai/careers/4019490009) — implies no incumbent at posting time. Trust center: https://trust.fal.ai/ (SOC 2, pursuing HIPAA/GDPR/ISO 27001) | 2026-08-03 |
| Sean Bonawitz (adjacent, NOT infosec) | Head of Trust & Safety (fal's first; ex-YouTube/TikTok/Patreon/TextNow) | https://www.linkedin.com/in/seanbonawitz/ (note: search-index headline still showed "TextNow" — possibly stale index; fal role confirmed by fal's own blog) | fal blog "Building long-term trust in a world where creation moves at the speed of thought" — https://blog.fal.ai/building-long-term-trust-in-a-world-where-creation-moves-at-the-speed-of-thought/ ; https://fal.ai/legal/trust-and-safety (contact safety@fal.ai) | 2026-08-03 |

**Confidence: Medium.** Explicit negative on a security hire: no CISO/Head of Security surfaced, and the open Security Compliance Lead req suggests the function is being built. Bonawitz's remit is content trust & safety, not information security — closest named leader, flagged as such. No source names who owns infosec; founders are Burkay Gur (CEO) and Gorkem Yurtseven (CTO) (per Grokipedia/company profiles, https://grokipedia.com/page/Falai), but that ownership is unconfirmed inference.
