import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "./_auth.js";

/* Vercel serverless function: drafts a Tavus persona system prompt with Claude.
   The Anthropic key lives server-side (ANTHROPIC_API_KEY env var on Vercel) —
   it is never sent to the browser. The response streams back as plain text so
   the builder can render the draft as it's written. */

const GENERATOR_SYSTEM = `You write system prompts for Tavus PALs (personas) — AI humans that hold live, face-to-face video conversations as product demos.

Rules for the persona prompts you write:
- Voice-first: the persona SPEAKS. Short sentences, contractions, no markdown, no bullet lists, no stage directions. Nothing that sounds wrong read aloud.
- Structure the prompt in clear plain-text sections: who the persona is, who they're talking to, what the conversation is for, how they speak, what they know, what they must not do, and how the conversation should flow.
- One question at a time. The persona listens more than it talks — answers should usually be a few sentences, not a monologue.
- The persona never claims to be human, never invents pricing, features, or commitments, and gracefully redirects out-of-scope questions.
- If the demo config includes objectives, guardrails, a presentation deck, or Magic Canvas, reference how the persona should work with them (e.g. let objectives drive the flow, respect guardrails absolutely, show canvas cards when they beat speaking, hand off to slides when walking the deck).
- When a presentation deck is attached, write a dedicated presenting section: when the deck starts (walk-the-deck mode: soon after a short rapport beat, and it is the backbone of the call; on-demand mode: only when the visitor asks or the moment calls for it), pacing (one slide at a time, a couple of sentences per slide in its own voice, a check-in question every slide or two), interruptions (answer fully, then resume exactly where the deck left off), and the close (finish the deck cleanly before next steps). It speaks to the visible slide only — never reads it verbatim, never narrates that it is presenting.
- If an emotional vibe is provided, include a dedicated section on how the persona FEELS and expresses it: the baseline mood, how the energy moves across the call, what genuinely excites them, and how they shift when the user sounds frustrated, confused, or delighted (Tavus renders emotion through the voice and face automatically — write performable emotional direction, never stage directions or emotion tags). Keep it human-scale: warm and real, never cartoonish.
- Write in second person ("You are…"). Aim for 250–500 words: complete but tight — every line must earn its place in a live call.

Return ONLY the persona system prompt text. No preamble, no explanation, no code fences.`;

const REVISE_SYSTEM = `You revise the configuration of a Tavus PAL (persona) — an AI human that holds live, face-to-face video conversations as product demos.

You are given the CURRENT system prompt, the CURRENT objectives (the structured, ordered flow the conversation MUST follow — attached to the PAL separately from the prompt), the CURRENT guardrails, and the operator's feedback from watching a real call.

CRITICAL: objectives drive the conversation flow mechanically — the PAL works through them in order and won't move on until one completes. If the feedback describes flow problems (stuck repeating a step, looping, skipping ahead, pushing something at the wrong time), the fix lives in the OBJECTIVES list; editing prompt prose alone will not change the flow. When feedback implies a flow change, revise the objectives. When it's purely voice/knowledge/personality, leave objectives null.

When a CURRENT PRESENTATION SETUP is provided, the PAL presents a slide deck via a separate skill: the skill shares the slides, but the PROMPT drives when the deck starts, the pacing (one slide at a time, check-in questions), how interruptions resume, and how the deck closes. Feedback about presenting/slides lands in the prompt's presenting section (create one if missing), and the prompt must stay consistent with the setup's trigger mode and talk track. If the flow never reaches the deck, that's an objectives problem too — mirror the deck walk in the objectives.

Apply the feedback precisely and return ONLY valid JSON (no code fences, no commentary):
{
  "prompt": "the complete revised system prompt",
  "objectives": ["Goal 1 in plain English", "Goal 2", "..."] or null when unchanged,
  "guardrails": ["Rule 1 in plain English", "..."] or null when unchanged,
  "note": "One short sentence: what changed and where (prompt / goals / rules)"
}

Rules:
- Change exactly what the feedback asks for; keep everything else as close to the original as possible. This is an edit, not a rewrite.
- Prompt: voice-first spoken style (short sentences, contractions, no markdown, no stage directions), second person, one question at a time, never claims to be human, never invents pricing/features/commitments, 250–500 words.
- Objectives: plain English, one goal per line-item, in conversation order (they chain top to bottom).
- Keep the prompt and objectives CONSISTENT with each other — if the flow changes in one, mirror it in the other.`;

const VISION_SYSTEM = `You configure the vision layer ("perception", model raven-1) of a Tavus PAL — an AI human on a live video call that can continuously watch the user's camera/screen and listen to their tone.

From the user's plain-English description of what the PAL should notice, write awareness queries:
- VISUAL queries: short present-tense observations Raven continuously checks in the video/screen stream (e.g. "Is more than one person visible?", "Is the user showing a document to the camera?"). Write 3-6.
- AUDIO queries: tone/emotion/explicit-request checks from the audio stream (e.g. "Is the user expressing frustration?", "Has the user asked to speak to a human?"). Write 0-3, only when the description calls for them.

Each query must be a single, concretely checkable question — no compound questions, no instructions to act (the PAL's prompt handles reactions).

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

const TALKTRACK_SYSTEM = `You write slide-by-slide talk tracks for an AI human presenting a deck on a live video call.

Given the demo's use case (and optionally what's on the slides), write speaker notes for each slide: what to SAY and what to ask. Spoken style — short sentences, contractions, no markdown. Each slide gets 1-3 sentences plus, where natural, one engaging question to keep it a conversation rather than a lecture.

Return EXACTLY this format, one line per slide, nothing else:
1: <talk track for slide 1>
2: <talk track for slide 2>
...`;

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
  "visionVibe": "One or two sentences on what the AI should notice on camera / in tone, or empty string if vision adds nothing here",
  "canvasPlaybook": "Plain-English direction for when to show interactive cards (question/chart/scheduling...), or empty string"
}

Rules: 3-5 objectives in conversation order; 2-4 guardrails; every string speaks specifically to the described use case; greetings and page copy are warm and concise; no markdown anywhere.
Company names: when the idea names or implies a REAL company (by name or website), use that exact real name everywhere — NEVER substitute an invented brand ("StrideLab" for Nike is a failure). Only invent a fictional brand when the idea is explicitly hypothetical or names no company at all. For real companies, don't fabricate specific product claims or statistics — stay in their actual public positioning, general where unsure.`;

function briefToPrompt(brief, context) {
  const lines = ["Write a Tavus persona system prompt for this demo:"];
  const add = (label, v) => { if (v && String(v).trim()) lines.push(`${label}: ${String(v).trim()}`); };

  add("Product / company", brief.product);
  add("Audience (who the persona talks to)", brief.audience);
  add("Goal of the conversation", brief.goal);
  add("Tone / personality", brief.tone);
  add("Emotional vibe (how it should feel and react)", brief.emotions);
  add("Must cover", brief.mustCover);
  add("Must avoid", brief.avoid);

  add("Brand name on the demo page", context.brand);
  if (context.objectives) lines.push(`The PAL has structured objectives attached (one per line, in order):\n${context.objectives}`);
  if (context.guardrails) lines.push(`The PAL has guardrails attached (one per line):\n${context.guardrails}`);
  lines.push(...presentationContextLines(context.presentation));
  if (context.canvasPlaybook) lines.push(`Magic Canvas playbook for this demo:\n${context.canvasPlaybook}`);
  else if (context.canvas) lines.push("Magic Canvas is enabled — the PAL can show interactive cards beside the video.");

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  if (!isAuthed(req)) {
    res.status(401).json({ error: "Not signed in — enter the access code first." });
    return;
  }

  const { brief = {}, context = {}, kind = "persona", vibe = "", draft = "" } = req.body ?? {};

  let system;
  let userPrompt;
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
    parts.push(`OPERATOR FEEDBACK — apply this:\n${String(vibe).trim().slice(0, 4000)}`);
    userPrompt = parts.join("\n\n");
  } else if (kind === "talktrack") {
    if (!String(vibe).trim()) {
      res.status(400).json({ error: "Describe the demo / deck first so Claude knows what to script." });
      return;
    }
    system = TALKTRACK_SYSTEM;
    userPrompt = `Write the talk track:\n${String(vibe).trim()}`;
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
    const hasInput = ["product", "audience", "goal", "tone", "mustCover", "avoid"]
      .some((k) => brief[k] && String(brief[k]).trim());
    if (!hasInput) {
      res.status(400).json({ error: "Describe the demo first — at least one brief field is required." });
      return;
    }
    system = GENERATOR_SYSTEM;
    userPrompt = briefToPrompt(brief, context);
  }

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
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: userPrompt }],
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
