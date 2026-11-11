# Hooks, angles, script, CTA, claims

## Angle vs hook
- **Angle** = the one reason someone should care (the insight): "lipstick that doesn't dry my lips",
  "cheaper than the salon". Take it from reviews and the brief.
- **Hook** = the first ≤ 3 seconds that make the angle visible or audible. Three hooks = three
  *different angles*, not three phrasings of one.

## Hook types
| Type | Pattern | Needs |
|---|---|---|
| Problem | Name the annoyance the viewer has ("Bibir kering tiap pakai lipstik?") | Review wording |
| Before/after | Show the change first, explain later | **Real** before/after |
| Curiosity | A claim or question that needs the next seconds ("Ini alasan produk ini habis tiap minggu") | A payoff in the next 5 s |
| Social proof | A number or quote from real reviews | Real, sourced rating/testimonial |
| Demo | The product doing the thing, no talk | Footage or application close-up |
| Offer | Price, bundle or code up front | A real, dated offer |
| POV | "POV: kamu baru nemu …" a scene the viewer is in | Footage (`ugc`/`hybrid`) |

## Structures
- **Hook → Problem → Product → Proof → CTA** (default for 30 s). Roughly: hook 0–3 s, problem
  3–8, product 8–15, proof 15–25, CTA last 3–5 s.
- **PAS** (Problem → Agitate → Solution): good for pain-led angles; the agitate beat must be
  true to the reviews, not exaggerated.
- One idea per scene; one benefit per sentence.

## Spoken Indonesian (voice-over or dialogue)
- Write the way people talk: "kamu", "banget", "nggak" are fine in casual tone; keep it consistent
  with the brand. No stiff written forms ("Anda dapat memperoleh").
- Short sentences, ≤ 12 words. The product name appears in the first 8 seconds.
- Spell numbers and symbols as spoken ("empat puluh delapan", "pe-ha"); show digits on screen.
- A question or a concrete image in the first sentence; the CTA is the last sentence.
- Word budget: about 1.9 words/s for ElevenLabs Indonesian (one measured case), so ~52–56 words
  for 30 s. Edge-tts is slower: `id-ID-GadisNeural` 1.61 words/s at `rate` +0% and 1.77 at +10%
  (~47–50 words for 30 s), `id-ID-ArdiNeural` 1.99 at +0%. Details in the production skill's
  `references/vo-beat-sync.md`.
- Read it aloud once; cut every word that does not carry the angle.
- Wrong-sounding spellings matter for captions: note brand words and non-standard spellings (e.g.
  "lembap", not "lembab") so the production step can correct captions.

## CTA conventions
| Platform | CTA | Say / show |
|---|---|---|
| TikTok Shop | Yellow basket | "Klik keranjang kuning" + a basket-pointing end card; the app UI is not drawn by the film |
| TikTok (no shop) / Reels / Shorts | Link in bio / profile link | "Link di bio" |
| Any | Promo code | The code on screen for the whole CTA (3–5 s) and in the line; footnote the validity dates |
| Any | Offer | Price and end date as written in the brief |

Keep the CTA inside the safe zone and held 3–5 s. Never show a button that is not clickable in the
destination as if it were.

## Claims
- **Evidence required.** Each claim maps to a source in the brief or official material (label, lab
  report, official page). Put the source in the claims table and the footnote on screen.
- **No invented numbers**, ratings, testimonials, awards or before/after results.
- **No cure or medical claims for cosmetics** ("menyembuhkan", "menghilangkan jerawat permanen",
  "mengobati"). Describe what it feels or looks like, not what it treats.
- **Check the local rules for the category.** In Indonesia, cosmetics and food are regulated by
  BPOM; confirm the product registration and the permitted wording with the brand before
  publishing. This skill does not give legal advice and does not cite specific regulations.
- Comparisons with a named competitor need a verifiable basis, else do not name them.
- Mark in the concept every claim the brand has not confirmed.
