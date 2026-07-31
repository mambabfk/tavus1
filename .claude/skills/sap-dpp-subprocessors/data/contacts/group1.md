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
