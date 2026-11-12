# look-sampler: one film, every look

A 17 s `motion` ad for a fictional lip serum, written so that changing one line, `"look"`, restyles
the whole film. It needs no assets and no API key: free voice (edge-tts) and a local synth bed.

| Time | What happens | Fields |
|---|---|---|
| 0–2 s | Hook card, headline word by word, slam on "pecah-pecah?" | `texts` `slam`, fill `var(--tone-1)`/`var(--tone-2)` |
| 2 s | The card snaps into a circle on the music drop; camera punch | `timeline` `snap`, `zoom` |
| 2.4–4.7 s | Full bleed; the wordmark slams on "Glowa"; sheen | `"set": "full"`, `wordmark`, `sheen` |
| 5–8 s | Circle; odometer rolls to 24 on "dua puluh empat jam"; two chips on beats; footnote | `odometers`, `chips` + `icons`, `foot` |
| 8.3–11.7 s | Tall card splits into three bands that pop on "Rose", "Peach", "Berry"; captions | `gap`/`rin`, band fills `var(--tone-1…3)`, `pops`, `captions` |
| 12–17 s | End card; CTA grows and is pressed on "kuning" | `cta`, `touch` |

Every fill uses the look's tones (`var(--tone-1)`, `var(--tone-2)`, `var(--tone-3)`, `var(--band)`),
so nothing is tied to one palette. The product, claim and footnote are invented, and say so on
screen.

## Steps
Paths are relative to the `vertical-product-ads` skill folder. `scripts/check_setup.sh --with edge`
installs the free voice.

```bash
cp -r examples/look-sampler ~/ads/sampler
scripts/py scripts/vo.py ~/ads/sampler           # edge-tts voice; prints every word with its index
scripts/py scripts/music.py ~/ads/sampler        # local synth bed, 120 BPM
scripts/py scripts/tempo.py ~/ads/sampler        # beat grid → audio/grid.json
scripts/make.sh ~/ads/sampler preview
scripts/make.sh ~/ads/sampler final ~/ads/sampler/sampler.mp4
```

To try another look, change `"look"` in `scenes.json` (`classic`, `luxe-editorial`,
`clean-clinical`, `bold-streetwear`, `warm-organic`, `tech-neon`, `pop-playful`, `ugc-native`) and run
`make.sh` again: the voice and music are reused.

## Re-fit after generating
- **`vo.place[].at` are seconds** fitted to the 120 BPM synth bed (beat n ≈ 0.501 + 0.4997·n). The
  synth is deterministic, so the same `music` block gives the same grid. With another track,
  recompute each `at` from `audio/grid.json` for the beat named in its `why`.
- **The `w<i>` indices assume these 24 words:** 0 Bibir, 1 kering, 3 pecah-pecah, 4 Kenalan,
  6 Glowa, 7 Lip, 9 Lembap, 11 dua, 13 empat, 14 jam, 15 Tiga, 16 shade, 17 Rose, 18 Peach,
  19 Berry, 21 keranjang, 22 kuning. A different script changes them.
- **edge-tts timing** can shift slightly between voice versions; `place_vo.py` (run by `make.sh`)
  fails with a fix if two segments leave no breath between them.
