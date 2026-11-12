---
name: vertical-product-ads
description: Use when asked to build or render a vertical 9:16 product ad (TikTok, Instagram Reels, YouTube Shorts commercial, e-commerce promo, beauty/skincare video) from an approved concept or storyboard, product photos, creator footage or a voice-over script. Styles are motion graphics, UGC footage with captions, or hybrid, in one of eight looks (luxe editorial, clean clinical, bold streetwear, warm organic, tech neon, pop playful, UGC native, classic). Needs an approved concept.md, use the ad-concept skill first if there is none.
---

# Vertical product ads

You direct and build a 9:16 product ad as **data**: one `scenes.json` drives a pure `seek(t)` engine,
and the scripts here turn it into a mastered MP4. You write the scenes. Do not edit the engine
and do not rewrite the pipeline per film.

## Before anything
All `scripts/…` paths are relative to this skill's folder; `<project>` is the ad's own folder, outside
the skill. Run `scripts/check_setup.sh` once. It checks Node ≥ 20, Playwright, ffmpeg and numpy, and
installs whatever is missing. Free extras: `scripts/check_setup.sh --with edge` (free voice-over),
`--with whisper` (local transcription), `--with all`.

## Step 0: the approved concept
Read `<project>/concept.md`. Build only if its frontmatter says `status: approved`.
- Missing, or `awaiting-approval`: run the **ad-concept** skill first (if it is not installed, tell the
  user: `npx skills add tomimandalaputra/vertical-product-ads --skill ad-concept`). Do not guess a
  concept from a bare prompt.
- Take from it: `style`, `look`, `platform`, `duration`, the chosen hook, script, beat sheet, claims,
  audio plan, permissions. The beat sheet's recipes are the scenes; do not add or swap them without
  updating the concept.
- If the concept's `mode` is autopilot, never stop to ask: assume, log `ASSUMPTION:`, decide, log
  `DECISION:`. In checkpoint mode, ask only when something blocks the build.
- **Duration rule:** 15–60 s; default 30. Over 34 s needs the concept's written justification and a
  warning in your report. Over 60 s: refuse. Hook inside the first 3 s; CTA holds 3–5 s.

## Styles
`style` is `motion`, `ugc` or `hybrid` (`references/styles.md`).
| Style | You write | Speech |
|---|---|---|
| `motion` | shape, photos, text, cues | `vo` |
| `ugc` | `footage`, `dialogue`, video layers, `captions` | `dialogue` from the footage |
| `hybrid` | footage scenes and motion scenes in the same shape | `dialogue` (or `vo` over muted b-roll) |
`ugc` and `hybrid` need at least one video layer; `ugc` needs `captions`. Switching styles:
`references/styles.md`.

## Looks
`look` is the visual direction, independent of the style: `classic` (default), `luxe-editorial`,
`clean-clinical`, `bold-streetwear`, `warm-organic`, `tech-neon`, `pop-playful`, `ugc-native`. One line,
`"look": "<name>"`, sets fonts (bundled, OFL), palette, chip and CTA shape, captions and how text
enters. Brand colours go over it in `theme.css`. Each look also has its own shape, pace, music and
sound direction: `references/looks.md`.

## Free vs paid options
| Part | ElevenLabs (key in env or `.env`) | Free |
|---|---|---|
| Voice-over | `vo.engine: "elevenlabs"` (default) | `vo.engine: "edge"` (edge-tts; licence caveat in `references/vo-beat-sync.md`) |
| Music | `music.prompt` | `music.synth` (local synth bed, yours to use) or a licensed `music.file` |
| Sound effects | `sfx` prompts + `sample` cues (`scripts/sfx.py`) | synthesized cues (`tap`, `whoosh`, `chime`…) |
| Transcription | `dialogue.transcriber: "elevenlabs"` | `"whisper"` (faster-whisper, offline); `"auto"` picks ElevenLabs when a key exists, else whisper |

## Workflow
1. **Project folder:** create `<project>/assets/` and `<project>/scenes.json`, copied from
   `examples/minimal/scenes.json` (format: `references/scenes-format.md`); for muted product b-roll
   under a voice-over, start from `examples/product-broll/`; for fills that follow any look, see
   `examples/look-sampler/`. `ELEVENLABS_API_KEY` is read
   by the tools from the environment or a `.env` in the project or any parent folder; it is needed only
   for ElevenLabs voice, music or transcription. If it is missing, tell the user to run
   `scripts/set_key.sh` **in their own terminal**, or use the free options. `.gitignore` for the
   project: `build/`, `renders/`, `snaps/`, `.env`.
2. **Speech first.**
   - **`vo` (motion, hybrid with narration):** pick a voice
     (`scripts/py scripts/voices.py <project> --lang <xx> --gender female` for ElevenLabs; an edge voice
     like `id-ID-GadisNeural` otherwise). Add `vo` to the scenes (no `place` yet), fitting the
     duration (`references/vo-beat-sync.md`), then `scripts/py scripts/vo.py <project>`. It prints
     every word with its index; your text and hits use those as `w<i>`.
   - **`dialogue` (ugc, hybrid):** list the clips in `footage`. Run `scripts/py scripts/footage.py <project>`
     (frames) and `scripts/py scripts/transcribe.py <project>` (words with clip times). **Proofread** the
     transcript against the script and the brand words; fix with `captions.fix`. Choose segments in the
     silences between words, fill `dialogue.segments`, then `make.sh` places them
     (`scripts/place_dialogue.py`) and writes `audio/words.json`.
3. **Music:** `scripts/py scripts/music.py <project>` (ElevenLabs prompt, or `music.synth`) and
   `scripts/py scripts/tempo.py <project>`. The per-second loudness list shows where the drop is and where
   the track ends. If a generated track fades before your CTA, regenerate with `--force`. Kick-peak
   beats are `k<n>`.
4. **Direct:** set `look` from the concept, then fill in `vo.place` (when using `vo`), `timeline`,
   `layers`, `texts`, `captions`, `cues` and the rest from the concept's beat sheet, following
   `references/direction.md` (motion recipes), `references/looks.md` (the look's shape, pace and
   sound) and `references/styles.md` (footage recipes). Every reveal is cued to a word or a beat,
   never to a guess.
5. **Preview:** `scripts/make.sh <project> preview`. It validates the scenes (including style and
   duration rules), builds footage frames, mixes audio, runs the layout gate (safe zone, overlapping text, empty bands), and writes a beat
   contact sheet plus a half-size draft with sound.
6. **Review (mandatory, never skip).** Look at `snaps/sheet.png`; each tile is stamped with its time
   and beat. Then snap every transition at ±0.1 s around the `at` times in your timeline:
   `node scripts/snap.mjs <project> t-0.1 t t+0.1 …`. For dialogue edits, snap around each segment cut
   and check that no word is cut and no caption is wrong. Watch `renders/draft.mp4` at normal speed if
   you can play video; otherwise say so in the report. Fix anything cramped, empty, unreadable,
   overlapping or off the beat, then preview again.
7. **Final:** `scripts/make.sh <project> final <out.mp4>`. It renders at 30 fps with a 180°
   motion-blur shutter, masters to −14 LUFS, and gates on loudness and chunk seams. Look at the
   `_storyboard.png` it writes.
8. **Report:** output path, scene list, `DECISION:`s, which data is real vs invented, claim
   footnotes, permissions (talent release, third-party marks, music and voice licence), duration vs
   the rule, and whether audio was heard or only measured.

## Non-negotiables
- **Safe zones:** all text, captions and UI stay inside `format.safe` (1080×1920: x 84–930, y 250–1460).
  `qa_safe` fails the build otherwise. Only photography and footage bleed.
- **Motion and hybrid product scenes: one shape, never cut.** Footage dialogue edits are the only
  hard cuts (`cut: true`). See `references/direction.md`.
- **Claims carry their footnote on screen.** Never invent product claims.
- **No gate is optional.** A failing gate means fix the scenes, not bypass the gate.
- **Limits:** you cannot watch footage, only read its transcript and snaps; b-roll sound is muted;
  avatars and generated presenters are not supported.
- **Credentials stay out of the chat.** Never ask the user to paste an API key into the conversation,
  never put one in a prompt, a command line or a file you write, and never read, print, `cat`,
  `grep` or echo `.env` or the key. The tools read it themselves; `check_setup.sh` reports only where
  it is. If a user pastes a key anyway, do not repeat it, and tell them to revoke it in the
  ElevenLabs dashboard and store a new one with `scripts/set_key.sh`.

## References
| File | Read when |
|---|---|
| `references/direction.md` | Planning motion scenes: rules, recipes, sound design |
| `references/looks.md` | Choosing or applying a look; brand colours over it; entrances and look variables |
| `references/styles.md` | ugc and hybrid recipes, dialogue editing, switching styles |
| `references/scenes-format.md` | Writing `scenes.json`: every field, time expressions |
| `references/vo-beat-sync.md` | Script, voice engines, transcription, placing on the music |
| `references/vertical-safe-zones.md` | Laying out text, captions, CTA and footnotes |
| `references/render-and-qa.md` | Render options, speed, gates, troubleshooting |
