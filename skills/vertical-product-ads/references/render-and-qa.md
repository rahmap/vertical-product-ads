# Render and QA

## What the pipeline does
| Step | Tool | Output |
|---|---|---|
| Schema + cross-references | `validate.mjs` | pass/fail |
| Footage frames (`footage`) | `footage.py` | `build/footage.json`, `build/footage/<name>/f00001.jpg …` |
| Voice or dialogue, music, beat grid, placement | `vo.py` (ElevenLabs or edge) \| `transcribe.py` + `place_dialogue.py`, `music.py` (prompt or synth), `tempo.py`, `place_vo.py` | `audio/*` |
| Cue table from the engine | `events.mjs` | `audio/events.json` |
| SFX synth + ducking + mix | `audio.py` | `audio/mix.wav` |
| Layout gate: safe zone, overlapping text/UI, empty bands and panels | `qa_safe.mjs` | pass/fail |
| Beat contact sheet (tiles stamped with time and beat) | `snap.mjs --beats --sheet 8` | `snaps/sheet.png` |
| Draft: no motion blur (1 subframe, "shutter 0°"), for timing only | `render.mjs --draft` | `renders/draft.mp4` (540×960, sound) |
| Final picture | `render.mjs` | `renders/video_noaudio.mp4` |
| Master, mux, loudness gate, seam scan, storyboard | `finish.sh` → `qa_video.py` | `<out>.mp4`, `<out>_storyboard.png` |

Order in `make.sh`: validate → footage (if `footage`) → music → (vo → place_vo) | (transcribe →
place_dialogue) → tempo → events → audio → safe zone → preview/final.

`build/` holds derived files (footage frames, `footage.json`). It is rebuilt when a clip's size or
mtime changes; never edit it, and keep `build/`, `renders/`, `snaps/` out of git.

`make.sh <project> preview` runs everything up to the draft. `make.sh <project> final <out>` runs
the gates again, then the final render and finish.

## Frame rate and motion blur
- **Each output frame averages 4 subframes 1/240 s apart** (`tmix`). That gives a shutter of
  4·fps/240: **180° at 30 fps** (film look, the default) and 360° at 60 fps.
- **30 fps loses nothing.** Frame k at 30 fps samples exactly the subframe times of frame 2k at
  60 fps, so it is half the work.
- **Use 60 fps only** for UI demos, whip pans, or footage meant for slow motion.

## Measured speed
Apple M3 Pro, 31 s film, 1080×1920:

| | Before | Now |
|---|---|---|
| Subframes | 7,440 (60 fps) | 3,720 (30 fps / 180°) |
| Capture | PNG ≈ 2.6/s; JPEG CPU 48/s | JPEG + Metal GPU, 6 tabs: 61/s |
| Picture render | 219 s | 71 s |
| Master | 35 s (re-encodes video) | ~5 s (audio only, video copied) |
| Draft with sound | none | 12 s |

Speed choices:
- **Capture JPEG q95, never PNG** (PNG ≈ 10× slower). `tmix` and H.264 hide JPEG's loss.
- **Run Chromium on the GPU:** Metal on macOS, by default. `VPA_GPU=0` forces the CPU rasteriser;
  the frames are then pixel-identical across machines. GPU frames differ only in image resampling
  (measured 42–49 dB PSNR against CPU).
- **Use one browser with N tabs** (`--workers`, default 6). Separate browser processes stalled
  while loading large assets.
- **Overlap encode with capture:** chunk N encodes while chunk N+1 is captured.
- **Encode the picture once, at final quality** (CRF 19, slow, tune film, BT.709). `finish.sh`
  never re-encodes it.

## Gates (a failure stops the build — fix the scenes, never bypass)
| Gate | Rule |
|---|---|
| `validate.mjs` | schema, assets exist, names resolve, `vo.place` covers every word in order |
| `validate.mjs` (style) | `motion`: no footage (video layers or footage masks); `ugc`/`hybrid`: ≥ 1 video layer; `ugc`: `captions` present; `captions` need `vo` or `dialogue`; `vo` and `dialogue` not together; dialogue footage has `speech: true`; a video layer's `src` matches its dialogue segment's footage; `clip`/`dialogue`/`cut` only on video layers; `music.synth` and `music.prompt` not together |
| `validate.mjs` (layouts) | panel ids unique and each holds a layer; a layer's `panel`, a pop's `panel`, a mask's `src`/`footage` resolve; panel layers carry no `band`/`toutBand`/`wipe`/`place`; masks have exactly one of `src`, `fill`, `footage`; comparison rows have one mark per column |
| `validate.mjs` (contrast) | with the look and `theme.css` merged: chip/callout/check-row, label, CTA and marquee text ≥ 3:1 on its surface (plain colours only) |
| `validate.mjs` (duration) | 15–60 s; over 34 s a warning (justify it in the concept and report); over 60 s is an error; the warning does not fail the build |
| `place_dialogue.py` | no segment edge cuts inside a transcribed word (it suggests the nearest edge); segments do not overlap in film time and stay inside the film |
| `place_vo.py` | > 0.2 s between segments, ≥ 0.5 s tail |
| `qa_safe.mjs` | at every output frame: every visible text/UI element (text, chip, label, odometer, caption, CTA, mask, callout label, check row) inside `format.safe`, a marquee band inside it vertically; no two visible text/UI blocks overlap; every visible band and panel shows a layer (no bare surface, no gap between footage segments) |
| `finish.sh` | delivered AAC file within ±0.6 LU of target and sample peak ≤ −0.5 dBFS (the limiter targets −1 dBTP; the margin absorbs AAC overshoot) |
| `qa_video.py` | no spike at a render-chunk seam (Δ > 2 and > 2.5× its neighbours) |

## Review checklist (human or agent, before `final`)
- [ ] Contact sheet: every beat has a framed subject; no empty frame, no cramped text.
- [ ] Transitions at ±0.1 s (`snap.mjs <project> t-0.1 t t+0.1` for each timeline `at`): old
      content gone before new content lands, no double-printed text. Manual snaps go to a fresh
      `snaps/manual-<time>/` folder each run, so a viewer that caches by path never shows a frame
      from before your edit.
- [ ] Draft at normal speed: each card is readable before it leaves; hits land on the word and the
      kick; nothing is still moving when a scene ends unless it is a deliberate drift.
- [ ] Footage styles: each dialogue cut lands between words, captions match what is said (brand
      words, `captions.fix`), no caption leaves the safe zone, b-roll covers the line it illustrates.
- [ ] Duration: hook inside 3 s; CTA held 3–5 s; total within the concept's duration.
- [ ] Claims have their footnote; colours of the product are not filtered away.
- [ ] Zoom in on every number and claim at rest (odometers, prices, percentages): one clean glyph per
      digit, no stray marks above or below. Snap the frame just after each odometer's `t1`.

## Troubleshooting
- **`engine failed: …`:** the message names the scenes key (unknown asset, anchor, track, or a time
  that can't be parsed).
- **Text renders blurry:** never scale text with the camera; HUD text sits outside `#world`.
- **A seam spike:** re-run `render.mjs`. The chunk that failed is reported with its time.
- **Fonts fall back:** system fonts must be named in `theme.fonts` (e.g. `"italic 400 80px Didot"`)
  so they load before frame 0. Fonts that aren't installed go in the project as files, declared in
  `theme.fontFaces` (`{family, src, style, weight}`) and named in `--serif`/`--sans`.
