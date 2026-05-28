# Demo script — verbatim

## Opening hook (30 sec)

> "Most new Tavus developers don't read the docs. They sign up, build the wrong thing — skip perception, swap in some other LLM, ignore objectives — ship something laggy, and then we're reactive to bad implementations they could have avoided.
>
> The fix isn't more docs. It's a Tavus Solutions Engineer talking to every new dev in their first ten minutes — and watching their screen while they build."
>
> *(Hit "I'm brand new — 10-min tutor" button.)*

---

## During the demo

Let the agent run. Two beats *you* land while it's running:

- **After the prompt card appears:** "And that card you just saw? That was a tool call — agent fired a function, server rendered live UI in the panel."
- **After the wedge moment (search_tavus_docs fires live):** *(don't talk over it — let the agent's line land. Just nod.)*

---

## Overlap pre-empt (90-sec mark, after Step 1 features tour)

> "I want to address something head-on. [Lead engineer's name] built a fucking great persona builder — that's a tool for people who already get Tavus.
>
> This is the layer *in front of* that. New devs land here first. They learn what Tavus *is*. *Then* they use the builder. Different funnel stage, same artifact at the end."

---

## Closing (last 30 sec, on the recap card)

> "What you're looking at is the same architecture for the front door of tavus.io.
>
> One backend service. Browser-bridge means unlimited concurrent visitors. The docs are local — milliseconds, no hallucination, version-controlled. And the agent doesn't just *talk* about Tavus — it watches the user, calls the API live, hands off to a human if needed.
>
> Today, devs ship the wrong thing because they didn't read the docs. With this on tavus.io, the docs read themselves *to* them."

---

## Q&A pre-loaded answers

**"Isn't this what [lead engineer] built?"**
> "Theirs is a builder for people who get it. Mine gets people *to* the point where they get it. Different funnel stage — both ship."

**"Why an agent and not better docs?"**
> "Because no one reads docs. We've been writing them for two years. Devs still build the wrong thing. An agent that *watches them build* and grounds answers in those same docs is the lift, not the docs themselves."

**"How does this scale on tavus.io?"**
> "In-browser bridge. The tool-call listener lives in the viewer page itself — one backend service handles every concurrent visitor. No per-session worker. Hosted FastAPI with the docs index in memory; ~5ms per lookup."

**"What's the ROI?"**
> "Every new dev today either takes 30 minutes of an SE's time on a call, or churns. This compresses that 30 minutes into 10, with no human in the loop until the dev actually wants one — and *then* it books the Calendly. We're trading SE hours for an agent that ships."

**"What if the agent gets something wrong?"**
> "Answers are grounded in live local docs, not training data. If the docs are right, the agent's right. If the docs are wrong, fix the docs — and the agent updates the same day."
