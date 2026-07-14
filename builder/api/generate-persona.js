import Anthropic from "@anthropic-ai/sdk";

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

  const { brief = {}, context = {} } = req.body ?? {};
  const hasInput = ["product", "audience", "goal", "tone", "mustCover", "avoid"]
    .some((k) => brief[k] && String(brief[k]).trim());
  if (!hasInput) {
    res.status(400).json({ error: "Describe the demo first — at least one brief field is required." });
    return;
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
      system: GENERATOR_SYSTEM,
      messages: [{ role: "user", content: briefToPrompt(brief, context) }],
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
