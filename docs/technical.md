# Technical reference

[Home](../README.md) · [Bahasa Indonesia](technical.id.md) · [User guide](guide.md)

[Requirements](#requirements) · [Quality checks](#quality-checks) · [Limitations](#limitations) · [Measured speed](#measured-speed) · [Repository structure](#repository-structure)

## Requirements

| Dependency | Purpose | Installed by |
|---|---|---|
| Node.js 20+ | Engine tools, rendering and validation | You |
| FFmpeg / FFprobe | Encoding, motion blur, loudness and footage frames | You |
| Python 3.9+ | Beat analysis, sound synthesis and mixing | You |
| Playwright + Chromium, numpy | Browser rendering and audio processing | `check_setup.sh` |
| edge-tts, optional | Free voice-over; needs internet | `check_setup.sh --with edge` |
| faster-whisper, optional | Offline footage transcription | `check_setup.sh --with whisper` |
| ElevenLabs API key, optional | ElevenLabs voice, music and transcription | You, through `set_key.sh` |

[Installation instructions](guide.md#installation) · [Safe key setup](guide.md#elevenlabs-api-key)

## Quality checks

Failed checks stop the build. The agent must fix the scenes rather than skip a gate.

| Check | Protects |
|---|---|
| Safe zone | Text, captions, chips, labels, callouts, check rows, masks and CTA stay within the configured safe area. The standard 1080×1920 area is x 84–930, y 250–1460. |
| Layout | No overlapping text/UI blocks or empty bands and panels. |
| Dialogue | No word is cut in half; speech segments do not overlap. |
| Scene contract | Schema, assets, style, duration and cross-references are valid. |
| Contrast | Chip, label, CTA, callout, check-row and marquee text meets the validator's 3:1 threshold after combining the look and project theme. |
| Audio | The delivered file is within −14 LUFS ±0.6, with peak at or below −0.5 dBFS. |
| Render | No unexpected glitch at render-chunk seams. |

Preview supplies a time-stamped contact sheet and a half-size draft with sound. The agent reviews
these and transition snapshots before final rendering. The final pipeline writes a storyboard.
Automatic checks do not establish the truth of a product claim or replace a viewing/listening pass.

The default final render uses 30 fps, four subframes per frame and a 180° shutter. Audio mastering
copies the already-rendered video instead of encoding it again. Word timings and measured music
beats drive text reveals and sound cues; music ducks under speech.

[Render and QA details](../skills/vertical-product-ads/references/render-and-qa.md) ·
[Safe zones](../skills/vertical-product-ads/references/vertical-safe-zones.md) ·
[Voice and beat sync](../skills/vertical-product-ads/references/vo-beat-sync.md)

## Limitations

- The skills do not generate product photography, avatars or AI presenters. Supply images and
  recorded creator footage with the necessary permissions.
- B-roll without speech is muted. Use creator dialogue or a voice-over for the spoken track.
- Transcript and snapshot review does not replace watching the video. Speech recognition can
  mishear brand names; check captions, including any `captions.fix` corrections.
- Audio measurement does not replace listening. Listen to the delivered file before publishing.
- Claims need a source and an on-screen footnote. Check the local advertising rules for the
  product category, including BPOM rules for cosmetics in Indonesia.
- Text masks need a calm background; footage inside text over busy footage can be unreadable.
- A full project theme can override a new look and fail contrast checks. Retain only the brand
  overrides you need when changing looks.

Production ads are 15–60 seconds, with a 30-second default. Above 34 seconds, the approved concept
must justify the length. The 8.5-second minimal example is a pipeline test, not a production ad.
[Duration policy](../skills/ad-concept/references/duration-and-platforms.md).

## Measured speed

These are recorded examples on an Apple M3 Pro, not render-time guarantees. Film content, grain,
footage, machine load and external services affect the result. No new benchmark is implied by
this documentation reorganisation.

### Original renderer comparison

The same 31-second 1080×1920 motion film. “Before” used a hand-written HTML film and 60 fps renderer.

| Step | Before | This skill |
|---|---|---|
| Picture render | 219 s, 7,440 subframes | 71 s, 3,720 subframes at 30 fps / 180° |
| Audio master | 35 s, re-encodes video | About 5 s, audio only |
| Draft with sound | Not available | 12 s |
| Authoring | About 600 lines of JavaScript per ad | A `scenes.json` per ad |

### Looks

The same [17-second look sampler](../skills/vertical-product-ads/examples/look-sampler/),
30 fps with motion blur:

| Look | Picture render |
|---|---|
| `classic` | 39.8 s |
| `luxe-editorial` | 39.2 s |
| `clean-clinical` | 19.4 s |
| `bold-streetwear` | 39.6 s |
| `warm-organic` | 40.4 s |
| `tech-neon` | 36.4 s |
| `pop-playful` | 19.5 s |
| `ugc-native` | 16.2 s |

Grain-free looks render faster in these measurements. Fonts ship with the skill, so choosing a
look does not add a font-download step.

### Layouts

The [20-second layout sampler](../skills/vertical-product-ads/examples/layout-sampler/), compared
per second of film with the separately measured look sampler:

| Look | Layout sampler | Per film second | Look-sampler baseline per film second |
|---|---|---|---|
| `classic` | 45.4 s | 2.27 s | 2.31 s |
| `luxe-editorial` | 43.9 s | 2.20 s | 2.31 s |
| `clean-clinical` | 23.7 s | 1.19 s | 1.14 s |
| `bold-streetwear` | 43.4 s | 2.17 s | 2.33 s |
| `warm-organic` | 45.5 s | 2.28 s | 2.38 s |
| `tech-neon` | 40.6 s | 2.03 s | 2.14 s |
| `pop-playful` | 24.9 s | 1.25 s | 1.15 s |
| `ugc-native` | 19.8 s | 0.99 s | 0.95 s |

These are different films, so their difference does not isolate layout overhead. A controlled
comparison adding three footage streams for a whole 20-second film measured a 1.8% increase.

### End-to-end agent runs

Fresh agents, installed through `npx skills add`, without assistance:

| Mode | Result | Prompt to MP4 |
|---|---|---|
| Checkpoint | 30 s motion, free audio | 10 min 52 s; concept at 1 min 13 s |
| Autopilot | 24 s hybrid, footage + ElevenLabs music | 13 min 28 s |

Measurement details: [render and QA reference](../skills/vertical-product-ads/references/render-and-qa.md)
and [CHANGELOG](../CHANGELOG.md).

## Repository structure

| Path | Contents |
|---|---|
| `skills/ad-concept/` | Concept skill, intake and creative references, brief/concept/shot-list templates, example prompts |
| `skills/vertical-product-ads/` | Production skill and its engine, scripts, schema, looks and examples |
| `skills/vertical-product-ads/references/` | Direction, styles, looks, layouts, scene format, timing and QA |
| `skills/vertical-product-ads/looks/` | Look presets and bundled OFL fonts |
| `skills/vertical-product-ads/engine/` | HTML/JavaScript renderer driven by deterministic `seek(t)` |
| `skills/vertical-product-ads/scripts/` | Preview/final orchestration, audio, rendering and validation |
| `skills/vertical-product-ads/schemas/` | `scenes.schema.json` |
| `docs/` | User guide, gallery and technical reference, in English and Indonesian |
| `media/` | Showcase MP4s and GIFs; excluded from installed skills |

Runnable examples: [minimal](../skills/vertical-product-ads/examples/minimal/),
[product b-roll](../skills/vertical-product-ads/examples/product-broll/),
[look sampler](../skills/vertical-product-ads/examples/look-sampler/),
[layout sampler](../skills/vertical-product-ads/examples/layout-sampler/).
The b-roll example needs your own footage.

Agent entry points: [ad-concept](../skills/ad-concept/SKILL.md) and
[vertical-product-ads](../skills/vertical-product-ads/SKILL.md).
Scene contract: [format reference](../skills/vertical-product-ads/references/scenes-format.md).
Contributor guidance: [AGENTS.md](../AGENTS.md).
