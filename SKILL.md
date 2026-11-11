---
name: vertical-product-ads
description: Use when asked to make a vertical 9:16 product ad, TikTok, Instagram Reels or YouTube Shorts commercial, e-commerce promo, or beauty/skincare/cosmetics video from product photos, a storyboard, keyframes or a voice-over script.
---

# Vertical product ads

You direct and build a 9:16 product ad as **data**: one `scenes.json` drives a pure `seek(t)` engine,
and the scripts here turn it into a mastered MP4. You write the scenes. Do not edit the engine
and do not rewrite the pipeline per film.

## Before anything
All `scripts/…` paths are relative to this skill's folder; `<project>` is the ad's own folder, outside
the skill. Run `scripts/check_setup.sh` once. It checks Node ≥ 20, Playwright, ffmpeg and numpy, and
installs whatever is missing.

## Inputs to collect
Read the brief, storyboard and keyframes. Collect:
- **Product images** without baked-in text: crop it out. If a feature only exists in an image with
  text, show it another way or leave it out. Upscale small crops (Real-ESRGAN if installed, else
  ffmpeg `scale=…:flags=lanczos`).
- **Claims and their footnotes.**
- **Language and voice**, if there is a voice-over.
- **Music:** a licensed track, or an ElevenLabs prompt.

Make every creative call yourself. Log each one as `DECISION:` and list them all in your report.

## Workflow
1. **Project folder:** create `<project>/assets/` and `<project>/scenes.json`, copied from
   `examples/minimal/scenes.json` (the format is in `references/scenes-format.md`).
   `ELEVENLABS_API_KEY` is read from the environment or from a `.env` in the project or any parent
   folder; it is only needed for `vo` and `music.prompt`.
2. **Voice first.** Pick a voice: `scripts/py scripts/voices.py <project> --lang <xx> --gender female`.
   Add `"vo": {"voice": …, "model": "eleven_multilingual_v2", "language": …, "script": …}` to the
   scenes (no `place` yet), fitting the duration (`references/vo-beat-sync.md`). Then run
   `scripts/py scripts/vo.py <project>`. It prints every word with its index; your text and hits use
   those indices as `w<i>`.
3. **Music:** run `scripts/py scripts/music.py <project>` and `scripts/py scripts/tempo.py <project>`.
   The per-second loudness list shows where the drop is and where the track ends. If it fades
   before your call to action, regenerate with `--force`. Kick-peak beats are `k<n>`.
4. **Direct:** fill in `vo.place`, `timeline`, `layers`, `texts`, `cues` and the rest, following
   `references/direction.md`. Every reveal is cued to a word or a beat, never to a guess.
5. **Preview:** run `scripts/make.sh <project> preview`. It validates the scenes, mixes audio,
   runs the safe-zone gate, and writes a beat contact sheet plus a half-size draft with sound.
6. **Review (mandatory, never skip).** Look at `snaps/sheet.png`; each tile is stamped with its time
   and beat. Then snap every transition at ±0.1 s around the `at` times in your timeline:
   `node scripts/snap.mjs <project> t-0.1 t t+0.1 …`. It prints the PNG paths, in a fresh folder
   each run. Watch `renders/draft.mp4` at normal speed if you can play video; otherwise say so in
   the report. Fix anything that is cramped, empty, unreadable, overlapping or off the beat, then
   preview again.
7. **Final:** run `scripts/make.sh <project> final <out.mp4>`. It renders at 30 fps with a 180°
   motion-blur shutter, masters to −14 LUFS, and gates on loudness and chunk seams. Look at the
   `_storyboard.png` it writes.
8. **Report:** output path, scene list, `DECISION:`s, which data is real vs invented, claim
   footnotes, asset/likeness permissions, and whether audio was heard or only measured.

## Non-negotiables
- **Safe zones:** all text and UI stay inside `format.safe` (1080×1920: x 84–930, y 250–1460).
  `qa_safe` fails the build otherwise. Only photography bleeds.
- **One shape, never cut:** scenes are morphs of the same shape (resize, round, split into bands,
  merge, open full bleed). See `references/direction.md`.
- **Claims carry their footnote on screen.** Never invent product claims.
- **No gate is optional.** A failing gate means fix the scenes, not bypass the gate.

## References
| File | Read when |
|---|---|
| `references/direction.md` | Planning scenes: motion rules, scene recipes, sound design |
| `references/scenes-format.md` | Writing `scenes.json`: every field, time expressions |
| `references/vo-beat-sync.md` | Writing the script, placing sentences on the music |
| `references/vertical-safe-zones.md` | Laying out text, CTA and footnotes |
| `references/render-and-qa.md` | Render options, speed, gates, troubleshooting |
