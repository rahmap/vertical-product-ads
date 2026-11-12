# Affiliate videos (TikTok Shop)

Use this when the brief says `objective: affiliate`. The film is a creator's recommendation of a
product they do not own the brand of, posted on their own account with the product linked in the
yellow basket. It must look like a post, not like a brand commercial. Where this file disagrees with
the other references, this file wins for affiliate briefs.

## What changes from a brand ad
| | Brand ad | Affiliate video |
|---|---|---|
| Voice | The brand speaks | One person speaks: "aku", first-hand |
| Look | Any | `ugc-native` unless the brief names another |
| Style | Any | `hybrid` with `vo` over the creator's own b-roll; `ugc` when there is talking footage; `motion` only when there are photos alone |
| Length | 30 s | 45 s default; 30 or 60 s by the table below. No written justification needed above 34 s |
| Edit | One shape, morphs | Hard cuts between shots (`cut: true`), a new picture every 1.5–3 s |
| Motion graphics | Carry the film | Support only: price sticker, 1–3 chips, a comparison list, the CTA |
| Music | Arc with a drop | Low bed under the voice; nothing has to land on a drop |
| Polish | High | Deliberately low: no logo sting, no wordmark slam, no end card with a slogan |

Still the same: safe zones, claim footnotes, real data only, every gate.

## Structure by length
Times are targets; the words decide the real ones.

| Beat | 30 s | 45 s | 60 s | What happens |
|---|---|---|---|---|
| Hook | 0–3 | 0–3 | 0–3 | The strongest picture + one line. Product visible within 3 s |
| Why I looked for it | 3–7 | 3–9 | 3–11 | The viewer's problem, in the words reviews use |
| What it is | 7–11 | 9–15 | 11–18 | Name, what it is, one detail seen in hand |
| Demo 1 | 11–18 | 15–25 | 18–30 | The product doing the main thing, close up |
| Demo 2 / detail | – | 25–32 | 30–40 | Second use, size in hand, material, what is in the box |
| Honest note | 18–21 | 32–36 | 40–46 | One small limitation or "cocok buat … , kurang cocok buat …" |
| Price and promo | 21–25 | 36–40 | 46–53 | Price as given in the brief; promo with its end date |
| CTA | 25–30 | 40–45 | 53–60 | "Klik keranjang kuning"; CTA pill held 3–5 s |

- Choose 30 s for one use and one benefit, 45 s for a product with two things to show, 60 s only
  when there are at least 8 distinct shots. A 60 s film with 4 pictures is a slideshow: shorten it.
- **Shot count:** at least one new picture per 3 s (10 for 30 s, 15 for 45 s, 20 for 60 s). A shot
  may be a different part of one clip (`clip.in`), a different crop of one photo (`fx`, `fy`,
  `zoom`), or a layout (split screen, grid).
- The honest note is not optional: it is what separates a recommendation from an ad, and it
  must be true (from the brief's notes or repeated review complaints). No note available: use
  "cocok buat siapa" instead.

## Hooks
Write 3 hooks with 3 different angles (`hooks-and-angles.md`), then also give the two not chosen as
alternative openings in the concept: the user may render them later as variants.

Patterns that fit a first-person recommendation:
| Pattern | Example | Needs |
|---|---|---|
| Find | "Nemu ini di keranjang kuning, ternyata kepake tiap hari." | Own footage of the product in use |
| Problem | "Capek kabel charger berantakan di meja?" | The problem shown in the first shot |
| Price surprise | "Segini doang harganya, tapi…" | The real price from the brief |
| Result first | Show the tidy desk / the finished look, then "ini yang aku pakai" | A real result shot |
| Doubt | "Awalnya ragu, soalnya murah banget." | An honest payoff later |
| Compare | "Yang lama vs yang ini." | Both items in the user's footage |

Not allowed: fake urgency ("stok tinggal 3" unless the brief says so), invented numbers of buyers,
"viral" or "nomor satu" without a source, a promise about results on the viewer.

## Script voice
Rules in `hooks-and-angles.md` (Spoken Indonesian) apply, plus:
- First person, past experience: "aku udah pakai dua minggu", only if the brief says the user has
  used it. Otherwise describe what is seen: "ini bahannya tebel", not an experience that did not
  happen.
- Spoken fillers in moderation: "jadi", "nah", "jujur", "sih", "lho". One per two sentences at
  most; none in the CTA.
- Sentences of 4–10 words. Vary the length: a short one after two longer ones.
- No ad words: "solusi terbaik", "kualitas premium", "dapatkan segera", "jangan sampai kehabisan".
- Price is said as spoken ("tujuh puluh sembilan ribu") and shown as digits (`Rp79.000`).
- The last sentence is the CTA and names the place: "Klik keranjang kuning ya."
- Word budget at about 1.9 words/s (ElevenLabs Indonesian): 30 s ≈ 50 words, 45 s ≈ 78, 60 s ≈ 105.
  Measure the real rate with `vo.py`.

## Picture sources
The asset inventory marks each file `own` (the user recorded it) or `listing` (from the seller's
product page).
- **Own footage is the core.** Hook, both demos and the honest note use `own` shots.
- **Listing photos and clips fill gaps:** the "what it is" beat, variants, what is in the box,
  the price beat. Never more than one third of the running time.
- No `own` footage at all: say so in the concept, keep the film to 30 s, and tell the user what to
  record (`templates/creator-shot-list.md`); platforms tend to demote posts made only of a seller's
  pictures.
- Listing pictures with baked-in text, badges or watermarks: show them small in a panel or not at
  all, never full bleed.
- The user needs the right to use the seller's material; note it under Risks.

## Scene menu for affiliate
Use these recipes (defined in the production skill's `references/styles.md`):
| Beat | Recipe |
|---|---|
| Hook | Affiliate hook |
| Why / What it is / Demo / Honest note | Review b-roll, Listing photo move, Split screen, Grid, Callouts, Comparison list |
| Price and promo | Price sticker |
| CTA | Basket CTA |

## Claims and compliance
- Only claims in the brief's claims table, each with its footnote on screen. Product facts copied
  from the listing count as the seller's claims: footnote them "Menurut deskripsi penjual".
- No health, cure or medical claims, no before/after on a person without real, permitted pictures,
  no income or guarantee promises.
- Price and promo exactly as in the brief, with the promo's end date in the footnote. Prices
  change: the report reminds the user to check the price on the day of posting.
- The voice is synthetic. Remind the user in the report to check the platform's current rule for
  labelling AI-generated content, and its affiliate disclosure setting, when uploading. This skill
  does not give legal advice and does not cite platform policy.

## Post copy
Affiliate concepts also carry the text for the post itself:
- **Caption:** 1–2 spoken-style sentences, the hook's angle in other words, ≤ 150 characters.
- **Hashtags:** 3–5; the product category, the use, one broad tag. No invented trend tags.
- **Pinned comment:** one line answering the most likely question (size, variant, price).
