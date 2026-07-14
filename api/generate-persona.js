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
- Write in second person ("You are…"). Aim for 250–500 words: complete but tight — every line must earn its place in a live call.

Return ONLY the persona system prompt text. No preamble, no explanation, no code fences.`;

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
    "mustCover": "Key points, one per line",
    "avoid": "Things it must not do, one per line"
  },
  "objectives": ["Goal 1 in plain English", "Goal 2", "..."],
  "guardrails": ["Rule 1 in plain English", "..."],
  "visionVibe": "One or two sentences on what the AI should notice on camera / in tone, or empty string if vision adds nothing here",
  "canvasPlaybook": "Plain-English direction for when to show interactive cards (question/chart/scheduling...), or empty string"
}

Rules: 3-5 objectives in conversation order; 2-4 guardrails; every string speaks specifically to the described use case; greetings and page copy are warm and concise; no markdown anywhere.`;

function briefToPrompt(brief, context) {
  const lines = ["Write a Tavus persona system prompt for this demo:"];
  const add = (label, v) => { if (v && String(v).trim()) lines.push(`${label}: ${String(v).trim()}`); };

  add("Product / company", brief.product);
  add("Audience (who the persona talks to)", brief.audience);
  add("Goal of the conversation", brief.goal);
  add("Tone / personality", brief.tone);
  add("Must cover", brief.mustCover);
  add("Must avoid", brief.avoid);

  add("Brand name on the demo page", context.brand);
  if (context.objectives) lines.push(`The PAL has structured objectives attached (one per line, in order):\n${context.objectives}`);
  if (context.guardrails) lines.push(`The PAL has guardrails attached (one per line):\n${context.guardrails}`);
  if (context.presentation) lines.push("The PAL has a presentation deck attached and can screen-share slides.");
  if (context.canvasPlaybook) lines.push(`Magic Canvas playbook for this demo:\n${context.canvasPlaybook}`);
  else if (context.canvas) lines.push("Magic Canvas is enabled — the PAL can show interactive cards beside the video.");

  return lines.join("\n\n");
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

  const { brief = {}, context = {}, kind = "persona", vibe = "" } = req.body ?? {};

  let system;
  let userPrompt;
  if (kind === "demo") {
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
