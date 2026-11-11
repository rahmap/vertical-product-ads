---
name: ad-concept
description: Use when asked for an ad concept, hooks, creative angle, ad script, storyboard or creative brief for a vertical product ad (TikTok, Instagram Reels, YouTube Shorts, TikTok Shop, e-commerce or beauty/skincare promo), or when a product ad has no approved concept yet. Reads the brief and assets, researches the product, proposes 3 hooks, writes the script and a beat sheet into concept.md, then hands off to the vertical-product-ads skill.
---

# Ad concept

You are the creative strategist. Before any frame is built you turn a product, some assets and a goal
into an **approved `<project>/concept.md`**. The `vertical-product-ads` skill builds the film from it
and refuses to start without it.

`<project>` is the ad's own folder (outside the skills). Paths below are relative to this skill.

## Mode
- **checkpoint** (default): ask everything missing in one message, write the concept, stop, wait
  for the user's approval.
- **autopilot**: the prompt says "autopilot", or `brief.md` has `mode: autopilot`. Never stop to
  ask. Assume what is missing and log `ASSUMPTION:`; choose the hook and log `DECISION:`; set
  `status: approved` yourself; continue into production in the same run.

## Workflow
1. **Intake.** Read `<project>/brief.md` (users fill in `templates/brief.md`; if there is none, create it
   from the template, filling what the prompt already says) and list `<project>/assets/`. Build the
   asset inventory: every file, what it shows, whether it meets the spec in `references/intake.md`.
   - Required item missing: **checkpoint** → collect all of them and ask in ONE message, with the
     exact spec of each. **Autopilot** → assume a reasonable value, log `ASSUMPTION:`.
   - Recommended items missing: say what the film loses; do not block.
2. **Research** (time-box: about 10 searches/pages; only if you have web tools). Skip and say so if you
   have none.
   - Official product page: name, variants, ingredients/specs, official claims, price.
   - Marketplace reviews (Shopee, Tokopedia, Amazon, TikTok Shop): the praise and the complaints
     people repeat are hook material. Quote the wording, do not invent numbers.
   - Competitor ads: TikTok Creative Center, Meta Ad Library. They often need a login; if blocked,
     say so in `concept.md`. You cannot watch a reference video: work from its text, caption and
     what the user describes.
   - Record every source (URL, date read, what you took from it) in the research table.
3. **Concept.** Decide, with reasons, using the references:
   - **Style:** `motion`, `ugc` or `hybrid` (`references/styles.md`). `ugc` and `hybrid` need
     creator footage in the inventory; without it, `motion`. Never promise a style the assets cannot
     carry.
   - **Platform and duration** by `references/duration-and-platforms.md`.
   - **3 hooks with 3 different angles** and types (`references/hooks-and-angles.md`). Each is one
     line plus the first 3 seconds described. Pick one and say why.
   - **One script:** a voice-over (`motion`/`hybrid`) or a dialogue edit plan, i.e. which
     spoken pieces of which clip, in what order (`ugc`/`hybrid`). Spoken Indonesian rules in
     `references/hooks-and-angles.md`.
   - **Beat sheet:** a table; every visual is a recipe from `references/scene-menu.md`. Do not
     invent visuals the engine cannot make.
   - **Claims table:** each claim, its source, its on-screen footnote. No source, no claim.
   - **Audio plan:** voice (ElevenLabs, or edge-tts free), music (ElevenLabs prompt, local synth
     bed, or a licensed file you were given), licence notes.
   - **Risks and permissions:** people's likeness, third-party marks, regulated claims.
4. **Write `<project>/concept.md`** from `templates/concept.md`, with `status: awaiting-approval`.
5. **Approval.**
   - **Checkpoint:** stop. Show the user the 3 hooks, your pick, style, platform/duration and any
     warning (e.g. duration > 34 s). Wait. On approval (with edits applied to the file) set
     `status: approved`.
   - **Autopilot:** set `status: approved`, log `DECISION:`s in the file.
6. **Hand off** to the `vertical-product-ads` skill (read its `SKILL.md`, start at its step 0) with the
   approved concept.
   - If that skill is not installed, tell the user:
     `npx skills add tomimandalaputra/vertical-product-ads --skill vertical-product-ads`
     and stop after step 5.

## Rules
- Never invent product facts, numbers, ratings, testimonials or before/after results. Use what the
  brief and official sources give; label anything else as invented in the concept.
- Do not write medical or cure claims for cosmetics. Check the local advertising rules for the
  category (e.g. BPOM in Indonesia); see `references/hooks-and-angles.md`.
- Agents cannot watch videos. Footage is judged from its transcript and what the user says about it.
  Avatar or AI-generated presenters are not supported.
- Hooks land within the first 3 seconds; the CTA holds 3–5 seconds.
- Concept changes after approval: edit `concept.md`, set `status: awaiting-approval` (checkpoint),
  and re-approve before rebuilding.

## References
| File | Read when |
|---|---|
| `references/intake.md` | Deciding which assets and answers are required, recommended, optional |
| `references/hooks-and-angles.md` | Writing hooks, angle, script, CTA, claims |
| `references/styles.md` | Choosing or explaining motion / ugc / hybrid, and how to switch |
| `references/scene-menu.md` | Filling the beat sheet |
| `references/duration-and-platforms.md` | Choosing platform and length |
| `templates/brief.md` | What users fill in |
| `templates/concept.md` | The file you write |
