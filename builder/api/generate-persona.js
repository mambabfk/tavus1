import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "./_auth.js";
import { kvAvailable, kvGet, kvIncr } from "./_kv.js";

/* Vercel serverless function: drafts a Tavus persona system prompt with Claude.
   The Anthropic key lives server-side (ANTHROPIC_API_KEY env var on Vercel) —
   it is never sent to the browser. The response streams back as plain text so
   the builder can render the draft as it's written. */

const GENERATOR_SYSTEM = `You write system prompts for Tavus PALs (personas) — AI humans that hold live, face-to-face video conversations as product demos.

Structure every prompt with EXACTLY these markdown section headers, in this order — the structure Tavus's own Prompting Guide prescribes. Headers organize the prompt; everything inside them is written for a persona that SPEAKS (short sentences, contractions, performable direction — nothing that sounds wrong read aloud).

## Identity & Role
Who they are (a name helps), who they're talking to, what this conversation is for, and why they're credible. Second person ("You are…").

## Personality & Conversational Style
- Base energy on a 1–10 scale, and when to dial it up or down (mirror the guide: "Base energy: 6/10 (warm but professional)…").
- How emotion shows across the call: baseline mood, what genuinely excites them, how they shift when the user sounds frustrated, confused, or delighted. Tavus renders emotion through the voice and face automatically — write performable emotional direction, never stage directions or emotion tags. Human-scale, never cartoonish.
- 2–3 SIGNATURE PHRASES that sound like this persona, and 2–3 NEVER USE phrases.

## Core Behaviors
Opening move, active listening (brief acknowledgment before answering), topic steering, clarification (one clear question at a time), off-topic handling with a redirect line, and the closing move.
IMPORTANT — when a SCRIPTED GREETING is provided in the config: that exact line is spoken automatically as the call's first words. The Opening move (and Conversation Flow) must CONTINUE from that line — never write a different self-introduction, never repeat what the greeting already said (name, role, purpose), and never contradict its tone.

## Response Style Rules
1–3 sentences per turn, contractions, no markdown or lists in speech, one question at a time, listen more than talk.

## Perception
What the PAL sees/hears through the camera or shared screen is private awareness, not conversation: never announce observing, watching, analyzing, or monitoring; never "I can see that…" or "I notice…"; never describe the user's appearance, surroundings, or mood unprompted. React to deliberately shared content by talking about the content itself ("Oh, Lisbon — great pick"), never the act of seeing it; silently ignore observations that don't help. When the config lists perception checks, reference how to use them naturally.

## Guardrails & Constraints
Says it's an AI when asked (never claims to be human), never invents pricing, features, statistics, or commitments, redirects out-of-scope questions with a concrete next step, and absolutely respects the attached guardrails — restate the important ones here in the persona's voice.

## Conversation Flow
ONLY include this section when the demo has a structured flow. When objectives are attached they drive step completion MECHANICALLY — describe the arc in one or two sentences and state that the attached objectives drive the steps; do NOT restate each objective as an instruction to ask (the prompt asking AND the objective driver asking produced the same question twice on live calls). When a presentation deck is attached, this is where presenting lives: when the deck starts (walk-the-deck: soon after a short rapport beat, and it is the backbone of the call; on-demand: only when the visitor asks or the moment calls for it), pacing (one slide at a time, a couple of sentences per slide in its own voice, a check-in question every slide or two), interruptions (answer fully, then resume exactly where the deck left off), and the close (finish the deck cleanly before next steps). Speaks to the visible slide only — never reads it verbatim, never narrates that it is presenting.

Additional integration rules:
- If Magic Canvas is enabled, note in Core Behaviors when a card beats speaking (capture a choice, show data, book time) — cards support the conversation, never replace it.
- If custom tools/integrations are listed, mention when to use them and what to collect first.
- If a knowledge base is attached, ground factual answers in it and say so when unsure instead of inventing.
- Aim for 300–600 words total: complete but tight — every line must earn its place in a live call.

Return ONLY the persona system prompt text. No preamble, no explanation, no code fences around the whole prompt.`;

const REVISE_SYSTEM = `You revise the configuration of a Tavus PAL (persona) — an AI human that holds live, face-to-face video conversations as product demos.

You are given the CURRENT system prompt, the CURRENT objectives (the structured, ordered flow the conversation MUST follow — attached to the PAL separately from the prompt), the CURRENT guardrails, and the operator's feedback from watching a real call.

CRITICAL: objectives drive the conversation flow mechanically — the PAL works through them in order and won't move on until one completes. If the feedback describes flow problems (stuck repeating a step, looping, skipping ahead, pushing something at the wrong time), the fix lives in the OBJECTIVES list; editing prompt prose alone will not change the flow. When feedback implies a flow change, revise the objectives. When it's purely voice/knowledge/personality, leave objectives null.

When a CURRENT PRESENTATION SETUP is provided, the PAL presents a slide deck via a separate skill: the skill shares the slides, but the PROMPT drives when the deck starts, the pacing (one slide at a time, check-in questions), how interruptions resume, and how the deck closes. Feedback about presenting/slides lands in the prompt's presenting section (create one if missing), and the prompt must stay consistent with the setup's trigger mode and talk track. If the flow never reaches the deck, that's an objectives problem too — mirror the deck walk in the objectives.

When a SCRIPTED GREETING is provided, that exact line plays automatically as the call's first words — the prompt's opening must continue from it. If the feedback changes how the call OPENS, revise the greeting too (return it in "greeting"); otherwise return greeting: null and keep the prompt consistent with the existing one.

Apply the feedback precisely and return ONLY valid JSON (no code fences, no commentary):
{
  "prompt": "the complete revised system prompt",
  "objectives": ["Goal 1 in plain English", "Goal 2", "..."] or null when unchanged,
  "guardrails": ["Rule 1 in plain English", "..."] or null when unchanged,
  "greeting": "the revised scripted first line" or null when unchanged,
  "note": "One short sentence: what changed and where (prompt / goals / rules / greeting)"
}

Rules:
- Change exactly what the feedback asks for; keep everything else as close to the original as possible. This is an edit, not a rewrite.
- Apply the feedback's implications, not just its words: "make this handle troubleshooting too" means adding the mode AND scoping existing single-mode language ("the deck is the spine of the call" becomes "…of onboarding calls"). If the feedback conflicts with an existing rule or the brief, apply what you can and flag the conflict in "note".
- Feedback may include a REHEARSAL TRANSCRIPT — a simulated run of this config. Treat it as evidence of how the config plays (find WHERE in the prompt/objectives the flagged behavior comes from and fix the cause); never copy transcript lines into the prompt.
- Prompt: keep (or move it toward) the Tavus Prompting Guide structure — "## Identity & Role", "## Personality & Conversational Style", "## Core Behaviors", "## Response Style Rules", "## Perception", "## Guardrails & Constraints", "## Conversation Flow" — with voice-first spoken content (short sentences, contractions, no stage directions), second person, one question at a time, never claims to be human, never invents pricing/features/commitments, 300–600 words.
- Perception input (what the PAL sees on camera/screen) is private awareness, not conversation: the prompt must keep — or gain, if it's missing — a rule that the PAL never announces or describes its own observations ("I can see that…", "I'm noticing…"), and reacts to deliberately shared content by discussing the content itself, never the act of seeing it.
- Objectives: plain English, one objective per line-item, in conversation order (they chain top to bottom). Conditional branches are supported: a line-item starting with "if <condition> -> <detour objective>" placed right after its parent objective becomes an if/then branch that runs on the condition and then rejoins the main flow. Use branches when feedback describes routing ("if they already did X, skip to Y").
- Keep the prompt and objectives CONSISTENT with each other — if the flow changes in one, mirror it in the other.`;

const VISION_SYSTEM = `You configure the vision layer ("perception", model raven-1) of a Tavus PAL — an AI human on a live video call that can continuously watch the user's camera/screen and listen to their tone.

From the user's plain-English description of what the PAL should notice, write awareness queries:
- VISUAL queries: short present-tense observations Raven continuously checks in the video/screen stream (e.g. "Is more than one person visible?", "Is the user showing a document to the camera?"). Write 3-6.
- AUDIO queries: tone/emotion/explicit-request checks from the audio stream (e.g. "Is the user expressing frustration?", "Has the user asked to speak to a human?"). Write 0-3, only when the description calls for them.

Each query must be a single, concretely checkable question — no compound questions, no instructions to act (the PAL's prompt handles reactions).

Phrase every query as a NARROW yes/no check ("Is the user showing a destination page on their screen?"), never an open-ended prompt ("Describe what the user is browsing"). Open-ended queries make Raven produce essay-like observations that leak into the PAL's speech as awkward narration ("I'm observing that…"); tight yes/no checks keep perception silent and useful.

Return EXACTLY this format and nothing else:
VISUAL:
- <query>
- <query>
AUDIO:
- <query>`;

const CANVAS_SYSTEM = `You plan Tavus Magic Canvas usage — interactive cards shown beside an AI human on a live video call. Available cards: question (multiple choice), input (free text), calendar (date/slot picker), text (supporting copy), chart (live bar/line/pie), alert (notices), scheduling_embed (live Calendly booking).

Cards make conversations tactile, but they are easily overused — a great plan uses FEW, well-timed cards that beat speaking. Given a demo use case, return ONLY valid JSON:
{
  "style": "balanced" | "minimal" | "eager" | "on_request",
  "playbook": "2-4 plain sentences: the card choreography for this conversation — what opens, what appears when, what never shows",
  "rules": { "<card key>": "one sentence: exactly when to show this card", ... },
  "disable": ["<card keys that don't serve this use case>"]
}
Rules: bias toward "balanced" or "minimal"; write rules ONLY for cards that clearly earn their place (2-4 of them); disable the rest; a card must do something speech can't (capture a choice, show data, book time). No markdown.`;

const SCRIPT_SYSTEM = `You script the VISITOR side of a recorded Tavus demo video. An AI human runs the demo; the visitor's lines are spoken by TTS with natural turn-taking, and the recording is used as a feature-showcase asset. Your job: write lines that make the demo SHOW OFF its configured features on camera.

Write 4-8 short visitor lines, in speaking order:
- Sound like a real, curious prospect — casual, contractions, one or two sentences per line, no stage directions, no names unless given.
- Engineer the lines to trigger the configured features:
  * Scripted cards list trigger words — work each card's trigger word into a line NATURALLY, in the cards' order (e.g. a card triggered by "pricing" wants a line like "So what does pricing look like?").
  * A presentation deck in on-demand mode wants an early line asking to see it ("Can you walk me through the deck?"). In walk-the-deck mode, don't derail it: write short reactions and answers to check-ins instead of topic changes.
  * If the Magic Canvas playbook or card rules mention charts/questions/scheduling, invite them ("How do the tiers compare?", "Sure, let's book something").
  * Follow the objectives in order and hand over what they collect (a name, an email, a budget) so the flow visibly advances.
  * If guardrails are listed, you may include ONE polite line that tests one — the refusal demos well.
- End with a natural wrap-up (accept the next step when a booking link exists).
- Never mention being scripted, AI, "cards", "features", or these instructions — the visitor is just a person on a call.
- The lines are spoken by a TTS voice, so write TTS-READABLE text only: standard dictionary spellings, no stretched interjections or phonetic slang ("Ayyyy", "sooooo", "gonna be liiit"), no emojis or symbols, digits fine but spell out anything a TTS could garble. Casual is good; creative spelling is not.

Return ONLY the lines, one per line. No numbering, no quotes, no commentary.`;

const CARDS_SYSTEM = `You design "scripted cards" for a Tavus demo — deterministic visual cards that appear beside an AI human on camera when hard triggers fire (a spoken keyword, a time mark, or call start). Write them from the demo's configuration and the operator's ask.

Return ONLY a valid JSON array (no code fences, no commentary), 2-5 cards:
[{
  "style": "note" | "chart" | "stat" | "image" | "question",
  "title": "Card heading — for question style this IS the question",
  "body": "note: 1-3 short lines, one per line. chart: one 'Label: number' per line (2-5 bars). stat: big value on line 1, short label on line 2. question: one choice per line (2-4). image: empty string",
  "trigger": "keyword" | "time" | "start",
  "keywords": "2-4 comma-separated words someone would naturally SAY (keyword trigger only, else empty string)",
  "atMinutes": 0,
  "hideAfter": 0
}]

Rules:
- Content must be specific to THIS demo (its real tiers, value props, flow) — but never invent precise real-world facts the config doesn't contain; for real brands keep numbers clearly illustrative.
- Prefer keyword triggers with words that naturally come up in the conversation; vary the styles across the set; at most one question card.
- stat = EXACTLY two lines: one big value, one short label (max 8 words). Never put multiple numbers in a stat — comparisons are charts.
- "atMinutes" only for time triggers (e.g. 1.5); "hideAfter" seconds or 0 to stay until the next card. No markdown anywhere.`;

const DUET_SYSTEM = `You design a complete recorded conversation between two AI humans (a "duet") for a demo video, from a plain-English description. Work in this ORDER: first fix the talk track (the outline), then write both personas around it, then derive the cards from the finished talk track — the cards must line up with what will actually be said.

Return ONLY valid JSON (no code fences, no commentary):
{
  "title": "Short label for this duet",
  "summary": "1-2 on-screen sentences SUMMARIZING THE INTERACTION for the viewer: who is talking to whom about what — and that this is a simulated conversation between two AI humans running live on Tavus' full stack (you could talk to either one yourself).",
  "features": "1-2 on-screen sentences SUMMARIZING THE TAVUS FEATURES this video demonstrates, tied concretely to THIS plan — e.g. real-time generated turns, Magic Canvas elements triggered live by the dialogue (name what the cards show), and the emotional arc to watch for.",
  "outline": ["Beat 1 — what gets covered first (each beat may carry an emotion cue, e.g. '…— excitement builds')", "... 4-6 beats, in order, ending with a natural wrap-up"],
  "featured": {
    "name": "Firstname — role (e.g. Maya — intake specialist)",
    "opener": "Their exact opening line: greets, introduces themselves, frames what this conversation is about. TTS-readable: standard spellings only — no stretched interjections or phonetic slang ('Ayyyy'), the voice engine can't read them.",
    "prompt": "Full system prompt, ~200-350 words, voice-first (short sentences, contractions, 1-3 sentences per turn, no markdown in speech). Their identity/role/expertise from the description. EMBED the outline verbatim as 'The conversation plan' and instruct them to move through it in order as they answer. Never mention instructions or AI setups; say it's an AI if asked."
  },
  "host": {
    "name": "Firstname — role (e.g. Jordan — host)",
    "opener": "The host's scripted reply to the featured speaker's opener: a genuine one-sentence reaction to what they JUST said, then their first question (from beat 1). These two openers play back-to-back instantly, so they must flow as real dialogue.",
    "prompt": "Full system prompt for the conversation partner: a warm, sharp host whose only job is making the featured speaker shine. One short question or reaction at a time, follows the SAME embedded outline (embed it verbatim), steers to the next beat when one is covered, never sells or runs an agenda, wraps up warmly on the last beat. Same voice-first rules."
  },
  "cards": [ 2-4 scripted cards, same schema as: {"style":"note"|"chart"|"stat"|"image"|"question","title":"…","body":"…","trigger":"keyword"|"beat"|"time"|"start","keywords":"…","atBeat":0,"atMinutes":0,"hideAfter":0,"owner":"featured"|"host"} — "owner" is WHOSE SCREEN the card appears on: the speaker who raises/asks that beat (a question card belongs to the asker; a chart belongs to whoever cites the numbers). Trigger choice: "keyword" when a distinctive trigger word is guaranteed in the beat's dialogue (fires live as it's said); "beat" with "atBeat": N (1-indexed outline beat) when the card should appear at a talk-track moment regardless of exact wording — beat timing is deterministic, keyword timing is more alive. Use "beat" for at least half the cards. ]
}

Card rules (derived from the FINISHED outline): each keyword trigger must be a distinctive word or phrase that literally appears in an outline beat (never generic words), so it reliably gets spoken; order cards to match the outline; content pulled from the description/outline — for real brands keep numbers clearly illustrative; at most one question card; body formats: chart = 'Label: number' per line, stat = EXACTLY two lines (line 1 a single big value, line 2 a short label of at most 8 words — NEVER cram multiple numbers into a stat; any comparison of two or more numbers must be a chart), question = one choice per line (title is the question). For a question card, one of the options should be something a speaker would naturally SAY when answering — the UI highlights the option that gets spoken.

Emotion rules: give both personas an explicit EMOTIONAL ARC tied to the outline (e.g. curious → genuinely excited → playful disagreement → warm resolution), written as performable direction inside the prompts — Tavus renders tone of voice and facial expression from how the lines and personality are written, so specify base energy (1-10), what makes each of them light up, and where in the outline the emotion shifts. Both openers must carry their starting emotion. If the description asks for specific tones (skeptical, competitive, heated), honor them and let them ESCALATE across beats rather than staying flat.`;

const TALKTRACK_SYSTEM = `You write slide-by-slide talk tracks for an AI human presenting a deck on a live video call.

When slide IMAGES are provided you can see the actual slides — ground every note in what is visibly on that slide, in the order given, and never invent features, numbers, or UI elements not shown. Without images, write from the use case and keep notes general enough to survive contact with the real deck.

The <brief> (when present) defines the use case, audience, and goal — obey it completely. Use cases differ structurally, not cosmetically: a sales demo builds toward value and closes with a next step; onboarding sells nothing (they already bought) — its questions collect setup information and it closes with something done and something owed; troubleshooting/support notes say what to check and why; training explains the why behind each step with one comprehension check per major concept.

The presenter is an AI human: write every note as INSTRUCTIONS TO THE PRESENTER — never a verbatim script, never human stage directions ("point at", "pause here", "gesture"). Phrase visual references so they can only land in speech ("draw attention to the Type column"). Interactive moments are behavior: Ask: "…" — then stop, wait for the answer, and use it specifically for the rest of the walkthrough.

Structure: one note per slide, matching slide order; 2-4 conversational moments across the WHOLE deck, placed where the audience naturally has questions — never one per slide, never "any questions?"; every question forces them to map the content to their own situation; each note ends with the transition to the next slide, and the final note closes on the brief's goal. Respect the brief's must-avoid absolutely.

Return EXACTLY this format, one line per slide (spoken style — short sentences, contractions, no markdown). Append FLAGS lines only when something needs the operator's eyes (an unreadable slide, a claim you couldn't ground):
1: <talk track for slide 1>
2: <talk track for slide 2>
...
FLAGS:
- <anything the operator should review>`;

const DEMO_SYSTEM = `You design complete Tavus CVI demo templates. Given a plain-English idea for a demo, draft every configurable element so it reads coherently for THAT use case — never recycle wording from unrelated products.

Return ONLY valid JSON (no code fences, no commentary):
{
  "conversationName": "Short internal label for this demo",
  "brand": "Brand/company name to show on the page",
  "headline": "Hero headline for the demo page, in the brand's voice",
  "tagline": "One supporting sentence",
  "cta": "Button label to start the conversation (2-5 words)",
  "greeting": "The exact opening line the AI human speaks first",
  "personaBrief": {
    "product": "What is being demoed, 1-2 sentences",
    "audience": "Who the AI human talks to",
    "goal": "What the conversation should achieve",
    "tone": "Voice/personality in a few words",
    "emotions": "Emotional vibe: baseline mood, what excites it, how it reacts to a frustrated or delighted user — 1-3 sentences",
    "mustCover": "Key points, one per line",
    "avoid": "Things it must not do, one per line"
  },
  "objectives": ["Goal 1 in plain English", "Goal 2", "..."],
  "guardrails": ["Rule 1 in plain English", "..."],
  "visionVibe": "One or two sentences on what the AI should notice on camera / in tone — ONLY when vision is a selected feature, else empty string",
  "canvasPlaybook": "Plain-English direction for when to show interactive cards (question/chart/scheduling...) — ONLY when magic canvas is a selected feature, else empty string",
  "coach": null OR — ONLY when coach mode is a selected feature — {"title":"scenario title, character-forward","scene":"one tense connecting-screen line","talkHint":"3-6 word talk-meter nudge","criteria":["behavior label | optional, comma keywords", "5-7 total"]}
}

Rules: 3-5 objectives in conversation order (an objective entry may be a conditional branch written as "if <condition> -> <detour objective>", placed immediately after its parent objective — use one when the use case naturally routes, e.g. new vs. returning customers); when the use case spans more than one conversation type, the FIRST objective sorts which type this call is; escalation triggers (billing, legal, anger, asking for a human) go in guardrails, never as objectives — an objective only fires when the flow reaches it; anything that must be collected gets its own "capture X" objective with a "| var" suffix; the final objective converges every lane on the same close. 2-4 guardrails; every string speaks specifically to the described use case; greetings and page copy are warm and concise; no markdown anywhere.
FEATURES: the request lists FEATURES SELECTED. Fill a feature's field ONLY when it is selected; unselected features get "" / null. Never push card/vision/coach content into the persona brief or objectives when the feature is off.
DISCOVERY ANSWERS: the request carries labeled answers — treat each as authoritative over your own invention:
- THE CONVERSATION THIS DEMO REPLACES → the demo's whole frame: the persona plays the person who has this conversation today, and page copy speaks to whoever walks into it.
- HOW A GOOD ONE GOES TODAY → the objectives ARE these steps, in this order (branch where the description routes); audience, tone, and the closing outcome are read from it — the final objective lands the same ending the human version does, and the cta invites it.
- HUMAN HANDOFF → guardrails + behavior: each named moment becomes a guardrail AND the persona offers the hand-off gracefully ("let me get a specialist on this") instead of bluffing past it.
- GUARDRAILS BEYOND THE HANDOFF: draft 3-5 more that a careful operator in this industry would want (privacy, no invented pricing/claims, scope) — the operator prunes them afterwards, so err on including a rule they might kill over missing one they needed.
GREETING vs FLOW: the greeting must NOT ask the question the first objective covers — it plays automatically, then the objectives drive the steps; a greeting that pre-asks step one made the AI ask it twice. Open warm, at most a soft invitation ("tell me what brings you in" is step one's job, not the greeting's).
Company names: when the idea names or implies a REAL company (by name or website), use that exact real name everywhere — NEVER substitute an invented brand ("StrideLab" for Nike is a failure). Only invent a fictional brand when the idea is explicitly hypothetical or names no company at all. For real companies, don't fabricate specific product claims or statistics — stay in their actual public positioning, general where unsure.`;

function briefToPrompt(brief, context) {
  const lines = ["Write a Tavus persona system prompt for this demo:"];
  const add = (label, v) => { if (v && String(v).trim()) lines.push(`${label}: ${String(v).trim()}`); };

  add("The demo, in the operator's own words", brief.vibe);
  add("Product / company", brief.product);
  add("Audience (who the persona talks to)", brief.audience);
  add("Goal of the conversation", brief.goal);
  add("Tone / personality", brief.tone);
  add("Emotional vibe (how it should feel and react)", brief.emotions);
  add("Must cover", brief.mustCover);
  add("Must avoid", brief.avoid);

  add("Brand name on the demo page", context.brand);
  if (context.greeting) lines.push(`SCRIPTED GREETING — the call's first words, spoken automatically: "${String(context.greeting).slice(0, 400)}". The prompt's Opening move and Conversation Flow must continue from this exact line (no second self-introduction, no repeated name/role/purpose, no tonal clash).`);
  if (context.objectives) lines.push(`The PAL has structured objectives attached (one per line, in order; indented "if <condition> -> <detour>" lines are conditional branches):\n${context.objectives}`);
  if (context.guardrails) lines.push(`The PAL has guardrails attached (one per line):\n${context.guardrails}`);
  lines.push(...presentationContextLines(context.presentation));
  if (context.canvasPlaybook) lines.push(`Magic Canvas playbook for this demo:\n${context.canvasPlaybook}`);
  else if (context.canvas) lines.push("Magic Canvas is enabled — the PAL can show interactive cards beside the video.");
  if (context.vision) lines.push(`The PAL has a perception layer attached (raven-1) running these checks continuously:\n${String(context.vision).slice(0, 1500)}`);
  if (context.knowledge) lines.push("A knowledge base is attached — the PAL can ground factual answers in the uploaded documents.");
  if (context.tools) lines.push(`Custom tools/integrations the PAL can trigger mid-call: ${String(context.tools).slice(0, 500)}`);

  return lines.join("\n\n");
}

/* Presentation setup → prompt-context lines. Accepts the rich object the
   builder now sends ({slidesTrigger, prompt, slideCount, talkTrack}) and the
   legacy boolean older clients sent. */
function presentationContextLines(pres) {
  if (!pres) return [];
  if (typeof pres !== "object") {
    return ["The PAL has a presentation deck attached and can screen-share slides."];
  }
  const trigger = pres.slidesTrigger === "on_demand"
    ? "on demand — it presents a slide only when the visitor asks or the moment clearly calls for it"
    : "walk the deck — the deck is the backbone of the call and the persona is expected to present it end to end";
  const lines = [
    `The PAL has a presentation deck attached and can screen-share slides (trigger: ${trigger}${pres.slideCount ? `; ~${pres.slideCount} slides` : ""}).`,
  ];
  if (pres.prompt) lines.push(`Operator's presenting directions:\n${String(pres.prompt).slice(0, 2000)}`);
  if (pres.talkTrack) lines.push(`Slide-by-slide talk track (attached to the presentation skill — keep the persona's flow consistent with it):\n${String(pres.talkTrack).slice(0, 3000)}`);
  return lines;
}

/* Guided browser flow (browser_use skill): a walkthrough description →
   Tavus-shaped flow config, per their best practices. */
const BROWSERFLOW_SYSTEM = `You script a GUIDED BROWSER FLOW for Tavus's browser_use skill: a pre-authored walkthrough the AI human runs on a live cloud browser while narrating — participants watch the pages over screen share. The AI follows these steps exactly; it never free-browses.

Return ONLY JSON (no markdown fences):
{"name":"short descriptive flow name (the AI picks flows by name)",
 "description":"one line — what the flow covers",
 "start_url":"https://… (the page the browser lands on first)",
 "steps":[3-12 steps, each ONE of:
   {"prompt":"…"}  — speak-only: the AI says this, no browser action (use one as the intro),
   {"task":"one small single action in plain language","prompt":"1-2 sentences narrated while it happens","url":"https://… (optional checkpoint — only when the step lands on a stable, directly-addressable page)"}]}

Rules (Tavus's own best practices):
- SMALL single-action tasks: "Open the Pricing page", never "sign in, create a project and invite a user".
- NEVER INVENT URLS. A guessed deep link that 404s strands the whole walkthrough on an error page. start_url is the site's homepage (or a URL the operator explicitly gave); include a step "url" ONLY when that exact URL appears in the brief. Everything else: navigate the way a person would — click the named nav/footer link that real sites have ("Click 'Stores' / 'Pricing' in the menu"), then act on what's visibly there.
- FEWER steps beat granular steps: if two steps land on the same page, merge them into one with longer narration. 3-6 browser steps is the sweet spot. Avoid typing-into-search tasks when a visible link gets there — typing is slow; one extra click is fine.
- EVERY step gets a prompt of a sentence or two. The AI narrates after the action lands, and the browser plans the next step while it speaks — the narration IS the loading cover. Too-short prompts cause dead air; give heavier steps (navigation, page loads) the LONGEST narration.
- Tasks must name ONE concrete visible action ("Scroll to the address and opening hours"), never a vague outcome ("Show the address block") that makes the worker hunt around the page.
- SHOWMANSHIP: the demo's wow is watching the browser move — but open-ended hunting ("find the help link") burns minutes in look-think-scroll loops. Alternate: use a step url (when the brief provides one) to arrive somewhere instantly — the page load itself reads as live browsing — then spend the visible action on something deterministic and flashy: click a named tab in the top nav, type one query into a visible search box and submit, click the first item in a grid, scroll to the footer. Split "scroll down and click X" into "Scroll to the footer" + "Click the X link in the footer" — two quick certain moves beat one slow search.
- Start with a speak-only intro step framing what's about to be shown.
- Ground everything in the site/product described; never invent pages that weren't implied.
- Narration is spoken aloud: no URLs read out, no UI mechanics ("I'm clicking…") — talk about what the page MEANS.`;

/* Coach mode: a live roleplay scorecard beside the call — the human trainee
   talks to the AI character and behaviors tick off as they're demonstrated. */
const COACH_SYSTEM = `You design a LIVE ROLEPLAY SCORECARD for a Tavus demo: a human trainee talks to an AI character on video, and a coach panel beside the call ticks off behaviors the moment the trainee demonstrates them.

Return ONLY JSON (no markdown fences):
{"title":"scenario title, character-forward like a movie card — e.g. \\"The Storm-Chaser Shadow · Mark Whitaker\\"",
 "scene":"one tense scene-setting line shown while the call connects — e.g. \\"Mark Whitaker is about to open the door.\\"",
 "talkHint":"a 3-6 word coaching nudge under the talk/listen meter — e.g. \\"Keep them talking.\\"",
 "criteria":[5-7 of {"label":"short past-tense behavior, ≤10 words, judgeable from the transcript alone — e.g. \\"Asked what happened instead of pitching over it\\"","keywords":"comma-separated literal words that make it instantly tickable when the trainee says one — ONLY truly discriminative words (\\"inspection\\", \\"warranty\\"); empty string when no unambiguous words exist (a live judge handles those)"}]}

Rules:
- Criteria grade the HUMAN trainee's technique, never the AI character: acknowledging feelings, discovery questions before pitching, offering verifiable proof, killing specific fears, concrete next steps.
- Every label must be checkable from speech alone — no body language, no outcomes the transcript can't show.
- Most criteria should have keywords:"" — over-eager keyword ticks feel fake; reserve keywords for words that only occur when the behavior happens.`;

/* Score: the live judge — transcript so far + unmet criteria → which are now met. */
const SCORE_SYSTEM = `You are the live judge behind a roleplay scorecard. You get the transcript so far and the criteria not yet met. Decide which criteria the TRAINEE (the human, lines marked TRAINEE) has now clearly demonstrated.

Return ONLY JSON (no markdown fences): {"hit":[0-based indices of criteria now met]}

Be conservative: tick only when the transcript plainly shows the behavior. A near-miss stays unticked. No partial credit. An empty array is a common correct answer.`;

/* Rehearse: play BOTH sides of a short call against the current config so
   the operator can refine by giving notes on a transcript. Faithfulness over
   flattery — if the config would misbehave, the transcript must show it. */
const REHEARSE_SYSTEM = `You simulate a Tavus CVI call so a demo builder can see how their configuration would ACTUALLY play. You play both sides: the AI human (driven by the system prompt, scripted greeting, objectives, and guardrails provided) and a realistic visitor.

Return ONLY JSON (no markdown fences):
{"transcript":[{"role":"ai"|"visitor","text":"…"} — 12-18 turns, alternating, starting with the ai speaking the scripted greeting VERBATIM when one is provided]}

Rules:
- Play the config AS WRITTEN, not as it should be. If the objectives would make the AI re-ask something, show the re-ask. If the greeting pre-asks step one, show the awkward double question. If a guardrail is vague, show the AI wobbling. The transcript is a diagnostic, not a commercial.
- The visitor is a plausible member of the audience with real texture: one moment of friction (an off-script question, a hesitation, a pushback) and at least one question that tests a guardrail or the handoff.
- AI turns follow the prompt's style rules (1-3 sentences, contractions, one question at a time). Visitor turns are casual and human.
- Run the flow to its natural close (the final objective / handoff / booking) within the turn budget.`;

/* Flow: a plain-English (often dictated) scenario description → structured
   objectives DSL, revising any existing steps rather than clobbering them. */
const FLOW_SYSTEM = `You structure conversation flows for a Tavus PAL from plain-English descriptions — often rambly dictation. Return ONLY JSON (no markdown fences):

{"note":"one sentence on what the flow now does",
 "objectives":"the FULL updated flow — one step per line, in order; indent branch lines under their step as \\"if <condition> -> <detour objective>\\"; append \\"| var1, var2\\" to any step that must capture data",
 "guardrails":null|"FULL updated guardrails, one per line — ONLY when the description states rules (never-do's); otherwise null"}

Rules:
- If CURRENT OBJECTIVES exist, the description is a revision: keep unaffected steps word-for-word (the operator's text is sacred) and change only what the description reaches. If none exist, create the flow.
- Steps are goals the PAL drives toward, phrased as actions ("Ask which product they're evaluating") — not stage directions or paragraphs. 3-8 main steps.
- Branches are detours that automatically rejoin the main flow at the next step — never write a catch-all or "otherwise" line, one is added mechanically. Branch only where the description implies different handling.
- Data capture: when the description says to collect something (name, email, budget), add the "| var" suffix rather than a separate step — an explicit "| var" is what keeps the capture from being dropped.
- MODE DETECTION FIRST: when the description covers more than one conversation type (onboarding vs troubleshooting vs how-to), the first step after greeting determines which type this is — with the clarifying question written into the step — and branches route from there. Never assume every call is the same type.
- Escalation triggers (billing, security, legal, anger, asking for a human) are NOT steps — a step only fires when the flow reaches it. Put them in guardrails (guardrails fire at any point) and say so in "note".
- EVERY BRANCH EXITS: each detour states its end state — resolved, handed off with context, or back to the main flow. No branch trails off.
- Loops need a counter: any retry behavior gets an explicit limit in the step and what happens when it's hit.
- Converged close: the last main step summarizes next steps and confirms nothing is left unresolved, whichever lane got there.`;

/* Spin-up: a spoken brain-dump (rambly dictation transcript) → clean builder
   inputs. The frontend then auto-runs the prompt generator on top. */
const SPINUP_SYSTEM = `You turn a spoken brain-dump — a raw, rambly dictation transcript about a demo — into clean builder inputs. Return ONLY JSON (no markdown fences):

{"note":"one sentence on what you set up",
 "brief":"2-4 sentence cleaned description of the demo persona: who it is, who it talks to, what winning looks like, the personality — keep the operator's language and intent, drop the umms, false starts and repetition",
 "objectives":null|"conversation steps, one per line, in order; indent branches as \\"if <condition> -> <detour objective>\\" — ONLY when the dictation implies a flow",
 "guardrails":null|"rules, one per line; add [visual] for camera-enforced rules — ONLY rules the operator actually stated or clearly implied",
 "greeting":null|"a natural spoken first line, IF the dictation implies how it should open"}

Rules: never invent objectives or guardrails that weren't in the dictation — null beats padding. Preserve specific names, numbers, and product facts exactly as spoken. The brief feeds a prompt generator, so it should describe the persona, not read like marketing copy.`;

/* Chat-with-the-demo: one instruction → coordinated edits across every
   implicated piece. The operator's existing text is sacred — edit, never
   regenerate, and touch only what the instruction reaches. */
const EDIT_SYSTEM = `You are the live editor for a configured AI-human video demo. The operator gives ONE instruction; you edit only the pieces it implicates and return the complete new text for those pieces.

Return ONLY JSON (no markdown fences):
{"note":"one sentence — what you changed and why it satisfies the ask",
 "changes":{"prompt":null|"full updated system prompt","objectives":null|"updated objectives lines","guardrails":null|"updated guardrail lines","greeting":null|"updated spoken greeting","headline":null|"...","tagline":null|"...","cta":null|"...","canvasPlaybook":null|"..."}}

Rules:
- EDIT, never regenerate. Preserve the operator's existing wording, structure, and voice everywhere the instruction doesn't reach — their edits are sacred. If a piece needs no change, return null for it.
- Apply the instruction's implications, not just its words: adding a second conversation mode means scoping existing single-mode language too. If the instruction conflicts with an existing guardrail or the brief, apply what you can and flag the conflict in "note".
- Cross-piece consistency: a conversation-flow change belongs in objectives (they drive the flow mechanically — a prompt-only edit leaves the PAL looping on stale steps) AND in the prompt's Conversation Flow section. A new rule belongs in guardrails AND the prompt's constraints section when one exists. Tone/personality changes usually touch only the prompt (and maybe the greeting).
- Formats: objectives = one step per line, in order; branches indented as "if <condition> -> <detour objective>"; optional "| var" suffix. guardrails = one rule per line; [visual] marks camera-enforced rules. The prompt keeps its ## section structure.
- Page copy (headline/tagline/cta) changes only when the instruction is about the page.
- Never invent content for a piece that was provided as "(empty)" unless the instruction explicitly asks for it.`;


/* "Promote": one side of a scripted duet becomes a live demo persona a real
   human talks to — the sales handoff. Same character, no set dressing. */
const PROMOTE_SYSTEM = `You convert one side of a scripted AI-to-AI "duet" demo into a live demo persona that a REAL HUMAN prospect will talk to. This is the sales handoff: the prospect watched the duet video, and now they meet the same AI human for real.

Return ONLY JSON (no markdown fences): {"name": "...", "prompt": "...", "greeting": "...", "objectives": "..." | null}

- "name": short PAL name — the character's name plus role (e.g. "Maya — intake specialist"). Never the word "duet".
- "prompt": the live persona's system prompt. KEEP the character's identity, personality, product knowledge, signature phrases and emotional range from the duet persona — the prospect should recognize the person from the video. REMOVE everything that only made sense on a set: the co-host, the fixed talk-track order, turn counts, "recorded segment" framing, scripted openers, card trigger words. REWRITE ## Conversation Flow for a real visitor: greet warmly → learn who they are and what they care about → walk the same material adaptively (deck / live browser if noted) → answer objections honestly → close on a concrete next step. Keep the same section structure as the input prompt (## Identity & Role, ## Personality & Conversational Style, and so on), including the Perception anti-narration rules if present.
- "greeting": ONE natural spoken line welcoming a visitor who just joined — reference the topic, never the video production.
- "objectives": 3-6 plain-English lines (one per line, NO numbering or bullets) for the live demo's flow — discovery first, then the material, capture what the prospect cares about, land a next step. null only if the plan gives you nothing.

The prompt is the product — everything else supports it.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  if (!isAuthed(req)) {
    // One public-with-credential exception: live scorecard judging from a
    // shared demo — a real demo slug is the credential (the /api/experience
    // pattern), hourly rate-capped per slug.
    let ok = false;
    if (req.body?.kind === "score" && kvAvailable()) {
      const slug = String(req.body?.slug ?? "").trim().toLowerCase();
      if (/^[a-z0-9-]{3,48}$/.test(slug) && (await kvGet(`demo:${slug}`))) {
        const hour = new Date().toISOString().slice(0, 13);
        ok = (await kvIncr(`scorecap:${slug}:${hour}`, 3900)) <= 150;
      }
    }
    if (!ok) {
      res.status(401).json({ error: "Not signed in — enter the access code first." });
      return;
    }
  }

  const { brief = {}, context = {}, kind = "persona", vibe = "", draft = "" } = req.body ?? {};

  let system;
  let userPrompt;
  let slideImages = []; // kind:"talktrack" vision path
  if (kind === "revise") {
    if (!String(draft).trim()) {
      res.status(400).json({ error: "There's no persona prompt to revise yet — draft one first." });
      return;
    }
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Tell Claude what to change first." });
      return;
    }
    system = REVISE_SYSTEM;
    const parts = [`CURRENT SYSTEM PROMPT:\n${String(draft).trim().slice(0, 20000)}`];
    parts.push(`CURRENT OBJECTIVES (ordered flow; one per line):\n${String(context.objectives ?? "").trim().slice(0, 4000) || "(none configured)"}`);
    parts.push(`CURRENT GUARDRAILS (one per line):\n${String(context.guardrails ?? "").trim().slice(0, 4000) || "(none configured)"}`);
    const presLines = presentationContextLines(context.presentation);
    if (presLines.length) parts.push(`CURRENT PRESENTATION SETUP:\n${presLines.join("\n\n")}`);
    if (String(context.greeting ?? "").trim()) parts.push(`SCRIPTED GREETING (the call's automatic first words):\n"${String(context.greeting).trim().slice(0, 400)}"`);
    parts.push(`OPERATOR FEEDBACK — apply this:\n${String(vibe).trim().slice(0, 4000)}`);
    userPrompt = parts.join("\n\n");
  } else if (kind === "script") {
    system = SCRIPT_SYSTEM;
    const c = context || {};
    const parts = ["Write the visitor script for this demo:"];
    if (c.product) parts.push(`Product being demoed: ${String(c.product).slice(0, 500)}`);
    if (c.brand) parts.push(`Brand: ${c.brand}`);
    if (c.personaSummary) parts.push(`The AI human's persona (summary):\n${String(c.personaSummary).slice(0, 2000)}`);
    if (c.objectives) parts.push(`Objectives the AI works through, in order (indented "if" lines are branches):\n${String(c.objectives).slice(0, 2000)}`);
    if (c.guardrails) parts.push(`Guardrails (at most ONE line may politely test one):\n${String(c.guardrails).slice(0, 1000)}`);
    const presLines = presentationContextLines(c.presentation);
    if (presLines.length) parts.push(...presLines);
    if (c.canvasPlaybook) parts.push(`Magic Canvas playbook:\n${String(c.canvasPlaybook).slice(0, 1500)}`);
    if (c.canvasRules) parts.push(`Magic Canvas per-card rules:\n${String(c.canvasRules).slice(0, 1500)}`);
    if (Array.isArray(c.scriptedCards) && c.scriptedCards.length) {
      parts.push(`Scripted cards that appear ONLY when their trigger words are spoken — weave each trigger word into a line naturally, in this order:\n${c.scriptedCards
        .map((x, i) => `${i + 1}. [${x.style}] "${x.title || "card"}" — ${x.trigger === "keyword" ? `trigger words: ${x.keywords}` : `appears ${x.trigger === "time" ? "on a timer" : "at call start"} (no line needed)`}`)
        .join("\n")}`);
    }
    if (c.scheduling) parts.push("A booking link is configured — a good closing line accepts a follow-up meeting.");
    if (String(vibe).trim()) parts.push(`Operator's direction for this script: ${String(vibe).trim().slice(0, 1000)}`);
    userPrompt = parts.join("\n\n");
  } else if (kind === "duet") {
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Describe the conversation first — who talks to whom, about what." });
      return;
    }
    system = DUET_SYSTEM;
    const parts = [`Design the duet:\n${String(vibe).trim().slice(0, 2000)}`];
    if (context?.brand) parts.push(`Brand on the demo page: ${context.brand}`);
    userPrompt = parts.join("\n\n");
  } else if (kind === "browserflow") {
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Describe the walkthrough first — the site, what to show, in what order." });
      return;
    }
    system = BROWSERFLOW_SYSTEM;
    const parts = [`Script this walkthrough:\n${String(vibe).trim().slice(0, 4000)}`];
    if (context?.brand) parts.push(`Brand: ${String(context.brand).slice(0, 200)}`);
    if (context?.product) parts.push(`Product context: ${String(context.product).slice(0, 800)}`);
    userPrompt = parts.join("\n\n");
  } else if (kind === "rehearse") {
    const c = context || {};
    if (!String(c.personaSummary ?? "").trim()) {
      res.status(400).json({ error: "Rehearsal needs a persona prompt — draft the demo first." });
      return;
    }
    system = REHEARSE_SYSTEM;
    const parts = [`SYSTEM PROMPT the AI human runs on:\n${String(c.personaSummary).slice(0, 8000)}`];
    if (String(c.greeting ?? "").trim()) parts.push(`SCRIPTED GREETING (the ai's first turn, verbatim):\n"${String(c.greeting).trim().slice(0, 400)}"`);
    if (String(c.objectives ?? "").trim()) parts.push(`OBJECTIVES (drive the flow mechanically, in order; indented "if" lines are branches):\n${String(c.objectives).slice(0, 2500)}`);
    if (String(c.guardrails ?? "").trim()) parts.push(`GUARDRAILS:\n${String(c.guardrails).slice(0, 1500)}`);
    if (String(c.replacing ?? "").trim()) parts.push(`This demo replaces: ${String(c.replacing).slice(0, 300)} — the visitor is whoever walks into that conversation.`);
    userPrompt = parts.join("\n\n");
  } else if (kind === "coach") {
    system = COACH_SYSTEM;
    const c = context || {};
    const parts = [`Design the scorecard for this roleplay:\n${String(vibe).trim().slice(0, 2000) || "(derive it from the demo config below)"}`];
    if (c.personaSummary) parts.push(`The AI character (persona summary):\n${String(c.personaSummary).slice(0, 3000)}`);
    if (c.objectives) parts.push(`Conversation flow objectives:\n${String(c.objectives).slice(0, 1500)}`);
    if (c.brand) parts.push(`Brand: ${String(c.brand).slice(0, 200)}`);
    userPrompt = parts.join("\n\n");
  } else if (kind === "score") {
    const crit = (Array.isArray(context?.criteria) ? context.criteria : []).map((s) => String(s).slice(0, 200)).slice(0, 12);
    if (!crit.length || !String(vibe).trim()) {
      res.status(400).json({ error: "Scoring needs a transcript and unmet criteria." });
      return;
    }
    system = SCORE_SYSTEM;
    userPrompt = `CRITERIA NOT YET MET (0-based index):\n${crit.map((s, i) => `${i}. ${s}`).join("\n")}\n\nTRANSCRIPT SO FAR:\n${String(vibe).trim().slice(0, 12000)}`;
  } else if (kind === "flow") {
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Describe the flow first — the steps, and any if/then forks." });
      return;
    }
    system = FLOW_SYSTEM;
    const parts = [`FLOW DESCRIPTION (structure this):\n${String(vibe).trim().slice(0, 6000)}`];
    parts.push(`CURRENT OBJECTIVES:\n${String(context?.objectives ?? "").trim() || "(none yet)"}`);
    parts.push(`CURRENT GUARDRAILS:\n${String(context?.guardrails ?? "").trim() || "(none yet)"}`);
    if (context?.brand) parts.push(`Brand: ${String(context.brand).slice(0, 200)}`);
    if (context?.product) parts.push(`Product/demo context: ${String(context.product).slice(0, 500)}`);
    userPrompt = parts.join("\n\n");
  } else if (kind === "spinup") {
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Nothing to spin up — dictate or type your thoughts first." });
      return;
    }
    system = SPINUP_SYSTEM;
    const parts = [`DICTATION TRANSCRIPT:\n${String(vibe).trim().slice(0, 8000)}`];
    if (context?.brand) parts.push(`Brand: ${String(context.brand).slice(0, 200)}`);
    userPrompt = parts.join("\n\n");
  } else if (kind === "edit") {
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Tell the demo what to change first." });
      return;
    }
    system = EDIT_SYSTEM;
    const c = context || {};
    const piece = (label, v) => `${label}:\n${String(v ?? "").trim() || "(empty)"}`;
    userPrompt = [
      `OPERATOR'S INSTRUCTION — apply this and nothing else:\n${String(vibe).trim().slice(0, 2000)}`,
      piece("CURRENT SYSTEM PROMPT", String(c.prompt ?? "").slice(0, 20000)),
      piece("CURRENT OBJECTIVES (one per line; indented if-lines are branches)", String(c.objectives ?? "").slice(0, 4000)),
      piece("CURRENT GUARDRAILS (one per line)", String(c.guardrails ?? "").slice(0, 4000)),
      piece("CURRENT GREETING (spoken first line)", String(c.greeting ?? "").slice(0, 500)),
      piece("CURRENT PAGE HEADLINE", String(c.headline ?? "").slice(0, 200)),
      piece("CURRENT PAGE TAGLINE", String(c.tagline ?? "").slice(0, 300)),
      piece("CURRENT PAGE BUTTON LABEL", String(c.cta ?? "").slice(0, 100)),
      piece("CURRENT MAGIC CANVAS PLAYBOOK", String(c.canvasPlaybook ?? "").slice(0, 2000)),
      c.brand ? `Brand: ${String(c.brand).slice(0, 200)}` : "",
    ].filter(Boolean).join("\n\n");
  } else if (kind === "promote") {
    const plan = req.body?.plan || {};
    if (!String(plan?.prompt ?? "").trim()) {
      res.status(400).json({ error: "No duet persona to promote — plan a duet first." });
      return;
    }
    system = PROMOTE_SYSTEM;
    const parts = [`DUET PERSONA TO PROMOTE (the featured side):\n${String(plan.prompt).trim().slice(0, 20000)}`];
    if (plan.name) parts.push(`Character name: ${String(plan.name).slice(0, 200)}`);
    if (plan.title) parts.push(`The duet video was titled: ${String(plan.title).slice(0, 200)}`);
    if (Array.isArray(plan.outline) && plan.outline.length) {
      parts.push(`Material covered in the video (the prospect has already seen this — the live call goes deeper, it doesn't replay it):\n${plan.outline.map((b, i) => `${i + 1}. ${String(b).slice(0, 300)}`).join("\n")}`);
    }
    if (context?.brand) parts.push(`Brand: ${context.brand}`);
    if (context?.deck) parts.push("The live PAL has the same slide deck attached — the flow should present it when relevant.");
    if (context?.browser) parts.push("The live PAL has Browser Use — it can pull up live websites when useful.");
    userPrompt = parts.join("\n\n");
  } else if (kind === "cards") {
    system = CARDS_SYSTEM;
    const c = context || {};
    const parts = [`Design scripted cards for this demo. Operator's ask: ${String(vibe).trim().slice(0, 1000) || "cards that showcase this demo's strongest points"}`];
    if (c.product) parts.push(`Product being demoed: ${String(c.product).slice(0, 500)}`);
    if (c.brand) parts.push(`Brand: ${c.brand}`);
    if (c.personaSummary) parts.push(`The AI human's persona (summary):\n${String(c.personaSummary).slice(0, 1500)}`);
    if (c.objectives) parts.push(`Conversation objectives, in order:\n${String(c.objectives).slice(0, 1500)}`);
    if (c.canvasPlaybook) parts.push(`Magic Canvas playbook (avoid duplicating what the AI already shows):\n${String(c.canvasPlaybook).slice(0, 1000)}`);
    const presLines = presentationContextLines(c.presentation);
    if (presLines.length) parts.push(...presLines);
    userPrompt = parts.join("\n\n");
  } else if (kind === "talktrack") {
    // Vision path: the frontend sends the actual slide images (base64) so
    // notes are grounded in what's on each slide, not guessed from the
    // use case. Text-only stays as the fallback when no images are uploaded.
    slideImages = (Array.isArray(req.body?.images) ? req.body.images : [])
      .slice(0, 20)
      .map((im) => ({
        media_type: ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(im?.media_type) ? im.media_type : null,
        data: typeof im?.data === "string" && im.data.length <= 1_500_000 && /^[A-Za-z0-9+/=]+$/.test(im.data.slice(0, 200)) ? im.data : null,
      }))
      .filter((im) => im.media_type && im.data);
    if (!String(vibe).trim() && !slideImages.length) {
      res.status(400).json({ error: "Describe the demo / deck (or upload slide images) so Claude knows what to script." });
      return;
    }
    system = TALKTRACK_SYSTEM;
    userPrompt = `Write the talk track.${String(vibe).trim() ? `\n${String(vibe).trim()}` : ""}`;
  } else if (kind === "canvas") {
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Describe the demo's use case first (New Demo or Persona step)." });
      return;
    }
    system = CANVAS_SYSTEM;
    userPrompt = `Plan Magic Canvas for this demo:\n${String(vibe).trim()}`;
  } else if (kind === "demo") {
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Describe the demo you want first." });
      return;
    }
    system = DEMO_SYSTEM;
    userPrompt = `Design a demo template for this idea:\n${String(vibe).trim()}`;
  } else if (kind === "vision") {
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Describe what the PAL should watch for first." });
      return;
    }
    system = VISION_SYSTEM;
    const parts = [`What the PAL should notice on the call:\n${String(vibe).trim()}`];
    if (context.product) parts.push(`Product being demoed: ${context.product}`);
    if (context.brand) parts.push(`Brand: ${context.brand}`);
    userPrompt = parts.join("\n\n");
  } else {
    const hasInput = ["vibe", "product", "audience", "goal", "tone", "mustCover", "avoid"]
      .some((k) => brief[k] && String(brief[k]).trim());
    if (!hasInput) {
      res.status(400).json({ error: "Describe the demo first — at least one brief field is required." });
      return;
    }
    system = GENERATOR_SYSTEM;
    userPrompt = briefToPrompt(brief, context);
  }

  // "The Brief" (portal AI spec): the frontend compiles one <brief> block
  // from the intake state and sends it on every AI call — generation never
  // happens blind. Prepended to the USER message, never the system prompt.
  // kind:"demo" builds the brief itself and "score" is the latency-critical
  // live judge — both skip it.
  const briefCtx = String(context?.brief ?? "").trim();
  if (briefCtx && kind !== "demo" && kind !== "score") {
    userPrompt = `${briefCtx.slice(0, 1600)}\n\n${userPrompt}`;
  }

  // Slide images become vision content blocks, one per slide, in order.
  const content = slideImages.length
    ? [
        { type: "text", text: `${userPrompt}\n\nThe slides follow in order:` },
        ...slideImages.flatMap((im, i) => [
          { type: "text", text: `Slide ${i + 1}:` },
          { type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } },
        ]),
        { type: "text", text: "Write the talk track. Follow the output format exactly." },
      ]
    : userPrompt;

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server. Add it in the Vercel project's environment variables." });
    return;
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  try {
    // Reads ANTHROPIC_API_KEY from the environment; constructed per-request so a
    // missing key surfaces as the clean 500 above, not an import-time crash.
    const client = new Anthropic();
    // Live scoring fires every ~25s mid-call — latency and cost matter more
    // than depth there, so it runs on Haiku with no extended thinking.
    const isScore = kind === "score";
    const stream = client.messages.stream({
      model: isScore ? "claude-haiku-4-5-20251001" : "claude-opus-4-8",
      max_tokens: isScore ? 300 : 16000,
      ...(isScore ? {} : { thinking: { type: "adaptive" } }),
      system,
      messages: [{ role: "user", content }],
    });

    stream.on("text", (text) => res.write(text));
    await stream.finalMessage();
    res.end();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      if (!res.headersSent) res.status(500);
      res.end("[error] ANTHROPIC_API_KEY is missing or invalid on the server. Set it in the Vercel project settings.");
    } else if (e instanceof Anthropic.RateLimitError) {
      if (!res.headersSent) res.status(429);
      res.end("[error] Rate limited by the Anthropic API — try again in a minute.");
    } else if (e instanceof Anthropic.APIError) {
      if (!res.headersSent) res.status(502);
      res.end(`[error] Anthropic API error: ${e.message}`);
    } else {
      if (!res.headersSent) res.status(500);
      res.end(`[error] ${e.message || "generation failed"}`);
    }
  }
}
