---
status: approved
mode: autopilot
platform: tiktok
duration: 20
style: hybrid
language: id
---

# Concept: Jahera Ginger Shampoo (fictional product, example project)

## Objective and CTA
- Objective: direct sales on TikTok Shop.
- CTA: VO "Cek keranjang kuning sekarang!"; "Keranjang kuning" button held ≈4 s on the end card.

## Audience and insight
- Audience: women 20–40 worried about hair fall and dandruff.
- Insight: hair coming out in the shower is a problem people recognise at once (ASSUMPTION: fictional product, no review research).

## Style and reason
- Style: hybrid. Muted product b-roll (no people's faces, no speech) under a voice-over; in between, the footage shape closes into an ingredient card, splits into three texture bands and closes into the end card.
- Why: product b-roll has no talking, so `vo` over muted footage is the hybrid path; the motion beats carry the information the b-roll cannot.

## Asset inventory
| File | Shows | Min length | Use |
|---|---|---|---|
| assets/pour.mp4 | Shampoo poured over the standing bottle, ginger slice in front | 2.3 s | hook; "halus" band |
| assets/bubbles.mp4 | Bottle among floating soap bubbles, plant behind | 2.9 s | brand; "bersih" band |
| assets/label.mp4 | Bottle lying tilted in hard sunlight, label readable | 2.6 s | ingredient card |
| assets/splash.mp4 | Water drops splashing around the bottle on glass | 2.6 s | ingredient card → benefits |
| assets/pump.mp4 | A hand presses the pump once | 1.1 s | benefits |
| assets/drip.mp4 | Macro: a thick drop falls from the pump nozzle | 2.4 s | lead-in to the bands |
| assets/palm.mp4 | Shampoo poured from the bottle into an open palm | 2.9 s | "lembut" band, then full bleed |
| assets/hero.mp4 | Hero shot: bottle with ginger root and a brush on wet glass | 3 s | end card |
| assets/fonts/nunito-800.woff2 | Nunito ExtraBold (OFL, `OFL.txt` beside it) | — | headlines |

Missing recommended items: price (the end card has none).

## Research sources
- Shot reference: product UGC video by @hanie.ugc.creator on TikTok,
  https://www.tiktok.com/@hanie.ugc.creator/video/7467561053971369223 (shot list, order and pacing only; its
  footage and brand are not used).
- Product, ingredients and claims: none, they are fictional.

## Hooks
| # | Type | Angle | Line | First 3 s |
|---|---|---|---|---|
| 1 | Problem | hair fall | "Rambut rontok tiap keramas?" | shampoo pouring over the bottle |
| 2 | Ingredient | ginger | "Sampo jahe yang lagi rame ini…" | same |
| 3 | Routine | shower | "Ganti sampo kamu sama yang ini." | same |

## Chosen hook
- Hook #1: a problem people recognise, said over the first shot in 1.7 s.

## Script
```
Rambut rontok tiap keramas? Kenalan sama Jahera Ginger Shampoo! Dengan ekstrak jahe dan lidah buaya. Bantu kurangi rontok, dan atasi ketombe. Rambut bersih, lembut, halus, dan ternutrisi. Cek keranjang kuning sekarang!
```
Spelling: "Jahera", "Ginger Shampoo".

## Beat sheet
Shot cuts and shape moves land on the music's measured beats.

| Time | Function | Visual recipe | On-screen text | Line | Asset |
|---|---|---|---|---|---|
| 0–k4 | Hook | Footage full bleed, slow push-in | captions | hook | pour |
| k4–k9 | Product | Cut on the music drop; brand title slams under a light scrim | "Jahera / Ginger Shampoo" | brand | bubbles |
| k9–k16 | Ingredients | Shape closes into a card; cut to splash inside the card on k14; chips on their words | Ekstrak jahe / Lidah buaya | ingredients | label, splash |
| k16–SPLIT | Benefits | Card opens full bleed; check chips on their words; footnote | Kurangi rontok\* / Atasi ketombe\* | benefits | splash, pump, drip |
| SPLIT–SWALLOW | Texture | Three bands, each pops on its word | captions | bersih, lembut, halus | bubbles, palm, pour |
| SWALLOW–CARD | Nourish | Middle band swallows the others | captions | ternutrisi | palm |
| CARD–end | CTA | Footage closes into the end card | name, 300 ml · ekstrak jahe, CTA, footnote | CTA | hero |

## Claims
| Claim | Source | On-screen footnote | Confirmed by brand? | Conflict with another source? |
|---|---|---|---|---|
| Kurangi rontok, atasi ketombe, bersih/lembut/halus, ternutrisi | invented (fictional product) | "*Produk & klaim fiktif untuk contoh." | n/a | no |

## Audio plan
- Voice: ElevenLabs Aita (ffTJE9l3Kt2ipEM32UOc), eleven_multilingual_v2, speed 1.12.
- Music: ElevenLabs Music from `music.prompt` (fresh organic house, ≈118 BPM, no vocals).
- SFX: ElevenLabs Sound Effects (pour, bubbles, splash, pump, whoosh, pop, riser, sparkle, thump, ka-ching), synthesized plucks on the three bands, a click on the CTA press.
- Licence notes: ElevenLabs output per the user's plan terms.

## Risks and permissions
- People on camera: hands only.
- Third-party marks: none allowed; shoot an unlabelled bottle or your own label.
- Invented vs real data: product, ingredients, volume and claims are invented.

## DECISIONS / ASSUMPTIONS
- DECISION: 20 s; speech ends ≈17.4 s and the CTA holds ≈4 s.
- DECISION: end-card titles enter 0.45 s after CARD so they never overlap the card while it shrinks.
