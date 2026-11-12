# layout-sampler: every layout piece in one film

A 20 s `motion` ad for a fictional vitamin C serum that walks through the layouts: kinetic type, a
split screen out of the card, a text mask, callouts, a comparison list, a grid that turns into a
collage under a marquee, and a phone with the shop page. Free voice (edge-tts) and a local synth bed;
the two pictures are SVG drawings in `assets/` (`bottle.svg`, `shop.svg`), made for this example.

| Time | What happens | Fields |
|---|---|---|
| 0–2.4 s | "Kulit kusam?" over a dull card | `texts`, fill with `color-mix` of the tones |
| 2.4–4.4 s | The card becomes the "before" panel; "after" slides in from the right with a sheen | `panels` (`from: "shape"`, `from: "right"`), shape `o: 0`, `sheen` in a panel |
| 4.4–5.6 s | Both panels land on the card, which takes over with the bottle; "GLOWA" in gradient letters | `into: "shape"`, `masks` with `fill` |
| 5.6–9.6 s | Card slides left; callouts draw to "Vitamin C", "Niacinamide", "Hyaluronic" on their words | `callouts` |
| 9.9–14.1 s | Circle above a comparison list: rows land on "lembap", "alkohol", "tujuh" | `checks` with `head` |
| 14.4–15.7 s | Four polaroids grow out of the circle; a tilted marquee runs across; on "promo" they tilt into a collage | `panels` (`frame: "polaroid"`, `moves`), panel `pops`, `marquees` |
| 15.7–20 s | The polaroids leave to the sides; a phone with the shop page rises; CTA pressed on "kuning" | `panels` (`frame: "phone"`, `into: "left"`/`"right"`), `cta`, `touch` |

Every fill uses the look's tones, so the film restyles with `"look"`. The product, its price and
its claims are invented.

## Steps
Paths are relative to the `vertical-product-ads` skill folder. `scripts/check_setup.sh --with edge`
installs the free voice.

```bash
cp -r examples/layout-sampler ~/ads/layouts
scripts/py scripts/vo.py ~/ads/layouts           # edge-tts voice; prints every word with its index
scripts/py scripts/music.py ~/ads/layouts        # local synth bed, 120 BPM
scripts/py scripts/tempo.py ~/ads/layouts        # beat grid → audio/grid.json
scripts/make.sh ~/ads/layouts preview
scripts/make.sh ~/ads/layouts final ~/ads/layouts/layouts.mp4
```

To try another look, change `"look"` in `scenes.json` and run `make.sh` again.

## Re-fit after generating
- **`vo.place[].at` are seconds** fitted to the 120 BPM synth bed (beat n ≈ 0.502 + 0.4997·n). With
  another track, recompute each `at` from `audio/grid.json` for the beat named in its `why`.
- **The `w<i>` indices assume these 26 words:** 0 Kulit, 1 kusam, 2 Ini, 3 bedanya, 4 Glowa,
  5 Serum, 7 vitamin, 9 niacinamide, 11 hyaluronic, 12 Lebih, 13 lembap, 15 alkohol, 18 tujuh,
  20 Lagi, 21 promo, 22 Cek, 23 keranjang, 24 kuning. A different script changes them.
- **The callout points sit on the bottle** as the card shows it from 5.6 s (`x` 330, `w` 440); move
  them with the card.
