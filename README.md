# vertical-product-ads

An agent skill for **9:16 product ads**: TikTok, Instagram Reels and YouTube Shorts commercials,
e-commerce promos and beauty/skincare spots. The agent writes one `scenes.json`; a pure `seek(t)`
engine and a measured pipeline turn it into a mastered, platform-safe MP4.

Works with any agent that reads `SKILL.md` skills: Claude Code, Codex, Cursor, Amp, Cline and others.

```bash
npx skills add <your-github-user>/vertical-product-ads
```

Then run the setup check once from the installed skill folder (it installs Playwright's Chromium and
a numpy venv when missing):

```bash
.agents/skills/vertical-product-ads/scripts/check_setup.sh
```

And ask your agent:

> Make a 30-second 9:16 ad for this product. Storyboard: docs/storyboard.md, photos in assets/,
> female voice-over in Indonesian.

## What you get
- **One shape, never cut.** Every scene is the same rounded shape. It morphs into cards and
  circles, splits into three bands for comparisons, merges, and opens full bleed. Springs with a
  tiny overshoot at most; content swaps with a short blur.
- **Voice and music locked together.** ElevenLabs voice-over with per-word timings; each sentence is
  placed so its key word lands on the music's measured beat; text appears on the word that names it.
- **Synthesized sound design.** Clicks, whooshes, glass and plucks in the song's key, each placed by
  its own peak. The music ducks under the voice; the mix is mastered to −14 LUFS / −1 dBTP.
- **Platform safe zones enforced.** Every visible word, chip, label and the CTA are checked against
  x 84–930, y 250–1460 every 0.05 s; the build fails otherwise.
- **Real motion blur.** 4 subframes per frame at a 180° shutter, 30 fps by default.
- **A review step built in.** `preview` produces a beat contact sheet and a half-size draft with
  sound before the full render.

## Try it without any API key
```bash
SKILL=.agents/skills/vertical-product-ads
cp -r $SKILL/examples/minimal my-ad
$SKILL/scripts/make.sh my-ad preview              # contact sheet + draft
$SKILL/scripts/make.sh my-ad final my-ad/out.mp4  # mastered MP4 + storyboard
```

## Measured speed
Apple M3 Pro, 31 s film at 1080×1920. The "Before" column is the same film built with a
hand-written HTML film and a 60 fps renderer.

| | Before | This skill |
|---|---|---|
| Picture render | 219 s (7,440 subframes) | 71 s (3,720 subframes, 30 fps / 180°) |
| Master | 35 s (re-encodes video) | ~5 s (audio only) |
| Draft with sound | none | 12 s |
| Writing the film | a ~600-line JS file per ad | a `scenes.json` per ad |

How each number is obtained: `references/render-and-qa.md`.

## Requirements
| Need | For |
|---|---|
| Node ≥ 20 (+ `npm install` in the skill: Playwright, Ajv) | engine, render, gates |
| ffmpeg / ffprobe | motion blur, encode, loudness |
| Python 3 + numpy | beat grid, SFX synthesis, mix |
| `ELEVENLABS_API_KEY` (optional) | voice-over and generated music |

## Layout
| Path | |
|---|---|
| `SKILL.md` | what the agent follows |
| `references/` | direction, `scenes.json` format, VO/beat sync, safe zones, render + QA |
| `engine/` | `index.html` + `engine.js`: the pure `seek(t)` renderer |
| `scripts/` | `make.sh` (preview/final) and every step it runs |
| `schemas/scenes.schema.json` | the contract `validate.mjs` enforces |
| `examples/minimal/` | an asset-free 8.5 s film |

## Licence
MIT, see `LICENSE`. Portions are derived from
[product-launch-motion](https://github.com/AbubakrChan/product-launch-motion) (MIT); see `NOTICE`.
Product images, voices and music you put into a film keep their own licences.
