# Styles

Plain-language guide. Production details and `scenes.json` snippets: the production skill's
`references/styles.md`.

| Style | What it looks like | Needs | Strengths | Limits | Produced here? |
|---|---|---|---|---|---|
| **motion** | One rounded shape morphs between product photos, cards, text and a CTA; designed sound | Product photos; optional VO | Needs no footage; fully controlled, consistent brand look | Feels like a designed ad, not a person; no real faces | Yes (default) |
| **ugc** | A creator talks to camera or shows the product; their footage leads; word-by-word captions; short cuts | Creator footage with speech (see `intake.md` footage spec) | Reads as a recommendation; strong for trust and demos | Quality is the footage's quality; needs talent release; captions need proofreading | Yes: edited from footage you supply |
| **hybrid** | Creator footage plus the motion shape: a talking hook, then product cards, proof and CTA in the motion look | Footage + product photos | Human hook, clear product and offer end | Two looks to keep consistent; needs both asset sets | Yes |
| **talking head** | One person speaks to camera for the whole ad, little else | Footage | Cheap, personal | Weak visual variety | Only as `ugc` with few cuts |
| **live action** | Directed shoot: sets, actors, camera moves | A production crew | Highest craft | Not generated or directed by this skill | No |

Not supported: avatar or AI-generated presenters, generated video, and editing footage by watching
it (the agent works from transcripts and what you describe).

## Choosing
- Only product photos → `motion`.
- Footage of someone speaking + photos → `hybrid` (human hook, product-led body) or `ugc` (footage
  leads throughout).
- Footage without speech (b-roll, texture, application) → add to `motion` or `hybrid` as cut-aways;
  its own sound is muted (affiliate films may keep it for a shot: `affiliate.md`).
- If the user asks for a style the assets cannot carry, say what is missing instead of switching
  silently.

## How to switch
- Set `style: motion | ugc | hybrid` in `brief.md`, or say it in the prompt ("make it ugc").
- If a concept exists, the agent updates `concept.md` (style, beat sheet, audio plan) and, in
  checkpoint mode, asks for approval again.
- What changes:
  - `motion` → `ugc`/`hybrid`: needs footage; the VO is replaced by dialogue taken from the
    footage (or kept in `hybrid`); captions become mandatory in `ugc`; the beat sheet uses the
    ugc/hybrid recipes.
  - `ugc`/`hybrid` → `motion`: footage is dropped; a VO is written; the human hook is rebuilt from
    product visuals.
- Switching after production started restarts at the beat sheet, not at the assets.
