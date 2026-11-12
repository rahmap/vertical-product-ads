# product-broll: product b-roll + voice-over + motion graphics

A 20 s `hybrid` ad for a fictional shampoo, **Jahera Ginger Shampoo**. Eight muted b-roll clips
(hands and product only, no faces) play under an ElevenLabs voice-over, with motion beats in
between. The footage is not included: you shoot it (list below). The project is otherwise complete:
`concept.md` (approved), `scenes.json`, and the headline font.

**Source.** The shot list, shot order and pacing follow a product UGC video by
[@shin.ugc on TikTok](https://www.tiktok.com/@shin.ugc/video/7477264941087608086). That video, its
footage and the brand shown in it belong to their owners and are not included here.

| Time | What happens | Fields |
|---|---|---|
| 0–2.1 s | Hook over the pour, slow push-in | video layer `zoom` |
| 2.1 s | Cut on the music drop; brand title slams under a scrim | `texts` `slam`, `fill` layer |
| 4.6–8 s | Footage closes into a card; ingredient chips enter on their words | `timeline` `set`, `chips` + `icons` |
| 8–11.5 s | Card opens full bleed; benefit chips with checks; footnote | `"set": "full"`, `chips`, `foot` text |
| 11.5–14 s | Three bands pop on "bersih", "lembut", "halus" | `gap`/`rin`, `band` layers, `toutBand`, `pops` |
| 14 s | The middle band swallows the others on "ternutrisi" | `b0`/`b2` → 0.0001 on `trail`/`lead` |
| 15.2–20 s | Footage closes into the end card; CTA pressed on "sekarang" | `cta` |
| throughout | Recorded sound effects on physical events | `sfx` + `sample` cues |

## What you need
- An ElevenLabs key (voice, music and sound effects). Free route: `vo.engine: "edge"`, a
  `music.synth` block instead of `music.prompt`, and synthesized cues (`whoosh`, `pop`, `shimmer`…)
  instead of the `sample` cues and the `sfx` block.
- Eight vertical clips, ideally 1080×1920 or larger, 30 fps:

| File | Shot | Min length | Framing |
|---|---|---|---|
| `assets/pour.mp4` | Shampoo poured over the standing bottle | 2.3 s | bottle centred, upper half of the frame |
| `assets/bubbles.mp4` | Bottle among floating soap bubbles | 2.9 s | bottle centred; keep the top 20 % calm for the title |
| `assets/label.mp4` | Bottle lying tilted in hard sunlight, label readable | 2.6 s | label near the centre (shown in a near-square card) |
| `assets/splash.mp4` | Water splashing around the bottle on glass | 2.6 s | bottle centred |
| `assets/pump.mp4` | A hand presses the pump once, early in the clip | 1.1 s | pump in the upper third |
| `assets/drip.mp4` | Macro: a thick drop falling from the nozzle | 2.4 s | nozzle in the upper half |
| `assets/palm.mp4` | Shampoo poured into an open palm | 2.9 s | stream and palm around 60 % height |
| `assets/hero.mp4` | Bottle with ginger root and a brush on wet glass | 3 s | product in the middle; the clip holds its last frame on the end card |

Use an unlabelled bottle or a label you own. Do not film other brands' products.

## Steps
Paths are relative to the `vertical-product-ads` skill folder.

```bash
cp -r examples/product-broll ~/ads/jahera       # then put the eight clips in ~/ads/jahera/assets/
scripts/py scripts/vo.py ~/ads/jahera            # voice; prints every word with its index
scripts/py scripts/music.py ~/ads/jahera         # music from music.prompt
scripts/py scripts/tempo.py ~/ads/jahera         # beat grid → audio/grid.json
scripts/make.sh ~/ads/jahera preview             # then review, as SKILL.md step 6 says
scripts/make.sh ~/ads/jahera final ~/ads/jahera/jahera.mp4
```

### Re-fit after generating
- **`vo.place[].at` are seconds** fitted to a 118.5 BPM track (beat n ≈ 0.034 + 0.5064·n). A new
  track has its own grid: recompute each `at` from `audio/grid.json` (phase + n·period + peak_offset)
  for the beat named in its `why`. `place_vo.py` (run by `make.sh`) fails with a fix when two
  segments leave no breath between them.
- **Everything else uses `k<n>` and `w<i>`** and follows the new grid and voice by itself.
- **A different script changes the word indices.** The `w<i>` in `anchors`, `chips`, `texts`, `cta`,
  `pops`, band layers and `cues` assume these 31 words: 6 Jahera, 7 Ginger, 8 Shampoo, 10 ekstrak,
  13 lidah, 16 kurangi, 19 atasi, 22 bersih, 23 lembut, 24 halus, 26 ternutrisi, 30 sekarang.
- **Music ending.** ElevenLabs often ignores timings in the prompt; read the per-second loudness that
  `tempo.py` prints. The reference track lost its kick after 16.2 s, under the CTA. The fix that was
  used: keep bar 1 low-passed (so the groove drops at k4), then repeat bars 4–5 after bar 8. One bar is
  240 / BPM seconds (2.025 s at 118.5 BPM); recompute the cut points for your track:

  ```bash
  ffmpeg -i audio/music.mp3 -filter_complex "\
  [0:a]atrim=0:2.030,asetpts=N/SR/TB,lowpass=f=700,lowpass=f=700,volume=-2dB,afade=t=out:st=2.020:d=0.010[a];\
  [0:a]atrim=2.030:16.203,asetpts=N/SR/TB,afade=t=in:d=0.004,afade=t=out:st=14.163:d=0.010[b];\
  [0:a]atrim=8.104:12.153,asetpts=N/SR/TB,afade=t=in:d=0.004[c];\
  [a][b][c]concat=n=3:v=0:a=1" -ar 44100 -c:a pcm_s16le audio/music.wav
  ```

  Then set `"music": { "file": "audio/music.wav", "bpm": 118.5 }` (no `prompt`, so `--force` cannot
  overwrite the edit) and run `tempo.py` again.

## Rights
The product, ingredients and claims are invented; the footnote says so on screen. Your footage and
any label in it must be yours. ElevenLabs output follows your plan's terms. Nunito is under the SIL
Open Font License (`assets/fonts/OFL.txt`).
