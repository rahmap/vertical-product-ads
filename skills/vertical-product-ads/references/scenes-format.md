# scenes.json format

`schemas/scenes.schema.json` is the contract. `scripts/validate.mjs` checks it plus cross-references.
Working reference: `examples/minimal/scenes.json` (no assets, no voice). A full hybrid film with
voice-over, sound effects, chips, split bands and an end card: `examples/product-broll/` (bring your
own footage). For the fields behind each product-ad beat (before/after wipe, parallax packshot,
split bands, chips, odometer, CTA), see the recipe table in `direction.md`.

## Time expressions
Any `at`, `tin`, `tout`, `t0`, `t1`, `press`… accepts a time in one of these forms:

| Form | Meaning |
|---|---|
| `2.62` | seconds |
| `"w12"` / `"we12"` | start / end of voice-over word 12 (after `place_vo.py`; indices printed by `vo.py`) |
| `"k16"`, `"k50.5"` | beat 16 on the measured grid: `phase + 16·period + peak_offset` from `audio/grid.json` (≈ where that beat's kick peaks; at 120 BPM `k4` ≈ 2.0 s). Fractions are 8ths/16ths |
| `"DROP"` | a name from `anchors` (anchors may use earlier anchors) |
| `"k16-0.13"`, `"w18+0.05"`, `"TAP+0.32"` | any of the above with offsets |
| `{ "cross": "dx", "value": 760, "from": "PRESS1", "to": 3 }` | first time a track reaches a value (not allowed inside `timeline`) |

**Lead rule:** a spring that must *arrive* on a beat starts ~0.1–0.3 s before it (`"k16-0.13"`).
Hits fire exactly on it (`"k16"`).

## Top level
| Key | |
|---|---|
| `duration` | Seconds. 15–60 (default 30; over 34 needs the concept's justification; over 60 is an error; 35–60 passes with a warning). Leave ≥ 0.5 s after the last word. Hook inside 3 s, CTA held 3–5 s |
| `format` | `{width:1080, height:1920, safe:{l:84, r:930, t:250, b:1460}}` |
| `render` | `{fps: 30, crf: 19}`; use 60 fps only for fast UI/whip motion |
| `vo` | `{engine, voice, model, language, settings, script, place:[{words:[first,last], anchor, at, why}]}`. `engine`: `"elevenlabs"` (default) or `"edge"`; with `edge`, `voice` is like `id-ID-GadisNeural` and `settings` is free-form strings `{rate: "+10%", pitch: "+0Hz", volume: "+0%"}`. Write it without `place` before running `vo.py`; then `place` must cover every word in order, and each `anchor` word lands at `at` seconds. Not allowed together with `dialogue` |
| `music` | `{file, bpm, key, prompt, length_ms, synth}`. An existing track: `file`. A generated one: `file` (where to write it) **and** `prompt`. A free local bed: `file` **and** `synth: {style: "pop"\|"minimal"\|"chill", drop: seconds, end: seconds, seed: int}`, using `bpm` (90–140, default 120) and `key` (default "C major"); `synth` and `prompt` are mutually exclusive. `drop` is where the groove starts (default: first bar line after 20 % of the film). `end` is where the bed falls silent (default: the film's end); the final chord starts on the last bar line at least ¾ bar before `end` and rings out to it, so to keep the full groove under a CTA set `end` past the film's end. The synth bed regenerates whenever these fields change; `tempo.py` takes the key from `music.key`. With no `file` the grid comes from `bpm` and there is no bed |
| `sfx` | `name → {file, prompt, dur, influence}`: samples for `sample` cues. With `prompt`, `scripts/sfx.py` (run by `make.sh`) generates the sound with ElevenLabs Sound Effects into `file` (`dur` 0.5–30 s, omit to let the model choose; `influence` 0–1, default 0.5, how literally the prompt is followed) and regenerates it when these fields change. Without `prompt`, `file` must exist (a sound you hold a licence for) |
| `audio` | `{duckSpeechDb:-15, duckGapDb:-8, sfxGain:0.8, fadeOut:0.6, musicDb:-20, lufs:-14}`. With a voice (`vo` or `dialogue`) the music sits `duckSpeechDb` under the voice while it speaks and `duckGapDb` in the gaps; `musicDb` (music RMS in dBFS) applies only to films without a voice |
| `theme` | `css` (CSS custom properties, see below), `fonts` (CSS font shorthands to preload), `fontFaces` (self-hosted: `{family, src, style, weight}`, `src` relative to the project; `weight` is `400` or a variable font's range `"300 700"`), `pools` (drifting light blobs: `{color, r, x:[base, amp, freq, phase, "sin"|"cos"], y:[…]}`) |
| `assets` | `name → path` relative to the project |
| `icons` | `name → inline SVG`; `{accent}` is replaced by the accent colour |
| `anchors` | `NAME → time` |
| `style` | `"motion"` (default), `"ugc"` or `"hybrid"`. `motion`: no video layers. `ugc`/`hybrid`: at least one video layer. `ugc`: `captions` required (`styles.md`) |
| `footage` | `name → {file, speech}`, `file` relative to the project (e.g. `assets/talk.mov`). `speech: true` marks clips with talking that `dialogue` may use; other clips are muted b-roll. Frames come from `scripts/footage.py` into `build/footage/<name>/` |
| `dialogue` | `{transcriber: "auto"\|"elevenlabs"\|"whisper", whisperModel: "small", language: "id", segments:[{footage, in, out, at, why}]}`. Edit list: clip seconds `in`→`out` play from film second `at` (numbers only). Replaces `vo` (mutually exclusive). Segments must not overlap in film time and must use `speech: true` footage. Words land in `audio/words.json` as `w<i>` |
| `captions` | `{y: 1181, size: 64, maxWords: 3, maxGap: 0.35, case: "upper"\|"none", style: "pill"\|"plain", tin, tout, fix: {"lembab": "lembap"}}`. Word-by-word captions from `audio/words.json`. `y` is the vertical **centre** of the caption block (default round(height × 0.615) = 1181 at 1920 high); a chunk that would need more than two lines shrinks its font until it fits two; needs `vo` or `dialogue`. `fix` maps a transcribed word to the spelling shown |

Theme variables (defaults in `engine/index.html`):
- **Surfaces:** `--base`, `--bg`, `--band`.
- **Colours:** `--ink`, `--accent`, `--accent-pressed` (both `#RRGGBB`), `--muted`.
- **UI fills:** `--surface`, `--surface-label`, `--icon-bg`.
- **Shadows:** `--shadow-rgb`, `--cta-shadow-rgb`, `--dot-shadow-rgb` (as `r, g, b`).
- **Fonts and finish:** `--serif`, `--sans`, `--sheen`, `--grain-opacity`.

## The shape: `shape.initial` and `timeline`
Tracks:
- **Shape:** `x y w h r` (centre, size, corner radius).
- **Bands:** the shape is always three bands **stacked vertically** (top `0`, middle `1`, bottom `2`).
  - `gap` is the space between them; `rin` is the inner corner radius once they split.
  - `b0 b1 b2` are relative heights; set one to 0.0001 to collapse it.
  - A band with no layer shows the theme's `--band` surface, and `qa_safe.mjs` fails the build
    ("EMPTY BAND"). Give every visible band a layer (an `img`, `video` or `fill`) that has entered
    before the band appears, e.g. keep a whole-shape layer under the bands until each has its own.
- **Camera:** `zoom` (written as a scale; stored as log), `cx cy`.
- **Touch dot:** `dx dy`.

```json
{ "at": "DROP-0.13", "set": { "w": 900, "h": 900, "r": 450 }, "sp": "snap", "why": "drop" }
{ "at": 18.3, "set": "full" }
```
`"set": "full"` is the whole frame with square corners **and the bands merged** (`gap` 0, `rin` 0):
one full-bleed image. For a full-width split screen, set the fields yourself
(`{ "x": 540, "y": 960, "w": 1080, "h": 1920, "r": 0, "gap": 16 }`).

Events apply in file order; write them chronologically. `sp` is one of:
- **Shape and hits:** `morph` (default), `snap`.
- **Slow moves:** `settle`, `drift`, `slow`, `drag`.
- **Travel:** `move`, `jump`.
- **Stretching edges:** `lead`, `trail`.
- **Custom:** `{w, z}`.

## layers (drawn in order, inside the shape's bands)
| Key | |
|---|---|
| `id`, `kind` | `img` (default), `fill` (CSS background in `fill`), `sheen` (sweep from `t0` to `t1`) |
| `src` | asset name |
| `band` | omit for the whole shape, or `0`/`1`/`2` for one band |
| `mode` | `cover` (default: fills the band or shape, focal point `fx`/`fy` in 0–1) or `world` (fixed placement, for packshots that must not crop) |
| `place` | `world` only: `{size, srcSize, imagePoint, at, srcAspect}`. The image is drawn `size` px wide (height `size × srcAspect`, default square). `imagePoint` is a pixel in the source image measured at `srcSize` width, and it lands on frame point `at` |
| `pivot` | `world` only: the frame point `zoom` scales around (default: frame centre) |
| `zoom` | number, `{to, at, sp}` (spring from 1), or an array of those (multiplied) |
| `shift` | `{dx:{to,at,sp}, dy:{…}}`, springs from 0 (parallax) |
| `tin`, `tout`, `dOut` | enter on a blur spring; exit over `dOut` s (default 0.16) |
| `toutBand` | three exit times when a full-shape layer leaves band by band |
| `blend` | e.g. `multiply` for packshots on white |
| `clipX` | `[from, to]` horizontal slice of the image (parallax halves) |
| `wipe` | reveal up to the touch dot's `dx` (before/after) |
| `kind: "video"` | A clip from `footage`; `src` is the **footage name**, not an asset. `cover` mode only. Extra keys below |
| video `clip` | `{in, at}`: clip second `in` plays at film time `at` (`at` is a time expression). Frame at film time `t` = clip second `in + t − at`, clamped to the clip |
| video `dialogue` | Segment index `i` of `dialogue.segments`: takes `in`/`at` from it; `tin` defaults to `segment.at`, `tout` to `at + out − in` |
| video `cut` | `true`: hard on/off at `tin`/`tout`, no fade or blur (dialogue cuts) |

`src` must match the footage of the `dialogue` segment it points to. `clip`, `dialogue` and `cut` are rejected on non-video layers.

With neither `clip` nor `dialogue`, the clip plays from its second 0 at `tin`. `fx`, `fy`, `zoom`,
`shift`, `band`, `blend`, `clipX`, `toutBand` work as for images.

## HUD elements (screen space, must stay in the safe zone)
- **`texts`:** `{y, cls, lines:[[{t, at, acc, slam}]], tout, lead, x, w, align}`.
  - `y` is the top of the text box; `x` is its centre (default 540); `align` defaults to `center`.
  - `cls` combines `serif` / `sans`, `ital`, and a size: `h0` 112, `h1` 88, `wordmark` 172,
    `sub` 64, `caps` 36, `foot` 23.
  - Default box: x 150–930 (`w` 780). Lines wrap at the box width, so a long `foot` becomes two
    lines and may cross the safe-zone bottom.
  - Each word enters on its own time; `acc` uses the accent colour; `slam` scales in.
- **`chips`:** `{text, icon, x, y, side, tin, tout}`. `y` is the chip's vertical centre (the pill is
  104 px high, so it spans `y − 46` to `y + 58`). `side: left` anchors the left edge at `x`; `right`
  anchors the right edge.
- **`labels`:** `{text, side, tin, tout}`, pinned above the shape's bottom corners and clamped to
  the safe zone.
- **`odometers`:** `{final, t0, t1, y, size, suffix, tout}`. Rolls to `final`; ticks are added to
  the cues automatically.
- **`arcs`:** `{layer, t0, t1, tout, path:[[x,y]×3]}`. A quadratic stroke in the layer's image
  coordinates (0–1).
- **`pops`:** `{band, at}`, a damped scale punch on a band.
- **`touch`:** `{start:[x,y], windows:[{tin,tout,dOut}], presses:[t], holds:[{from,to,wiper}]}`.
  Move the dot with `dx`/`dy` in the timeline.
- **`cta`:** `{text, y, h, half, tin, textIn, press}`. The press is added to `touch.presses`
  automatically.

## cues
`{at, kind, gain, …}` with these kinds and parameters:
- `tap` (`f`), `click`, `tick` (`f`), `pop` (`f`);
- `glass`, `pluck` (`note`: semitones above the song's tonic);
- `chime` (`notes`), `sub` (`dur`);
- `swish`, `whoosh` (`dur`, `up`, `rev`, `soft`);
- `shimmer` (`dur`, `bright`);
- `sample` (`src`: a name from `sfx`; `align`: `"peak"` (default) or `"start"`).

Each sound's own peak lands on `at` (with `"align": "start"`, a sample's first moment does).
