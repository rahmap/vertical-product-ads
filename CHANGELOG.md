# Changelog

## Unreleased

**Affiliate videos (TikTok Shop)**
- **`objective: affiliate`:** a first-person recommendation instead of a brand ad. 45 s by default, up
  to 60 s without a written justification, hard cuts on words, `ugc-native` look, an honest note,
  price and promo from the brief, post copy (caption, hashtags, pinned comment) in the concept.
  `skills/ad-concept/references/affiliate.md`; recipes in the production `references/styles.md`.
- **`fit: "contain"`** on `img` and `video` layers: the whole picture over a blurred copy of itself
  (square seller photos, landscape clips). `cut` now also works on `img` and `fill` layers.
- **`prices`:** a price sticker with was-price and badge; checked by the layout gate.
- **`captions.anim: "pop"`:** the spoken word scales up while it is said.
- **`footage.<name>.sound`:** b-roll keeps its own audio under the voice wherever it is shown.
- **Natural voice:** settings, punctuation and placement guidance in `references/vo-beat-sync.md`.
- `qa_safe.mjs` checks frames in parallel tabs (`VPA_WORKERS`).

**Studio**
- `studio/`: local web app with a SQLite store for products (import from a link, or by hand), assets,
  a video queue, preview approval and revision notes, finished videos and post results.
- `.claude/skills/affiliate-queue`: works through the queue with the two skills.

## 0.5.0

**Layouts**
- **Panels:** extra rounded frames beside the shape, for split screens, grids, picture-in-picture,
  collages, card stacks and editorial grids. A panel enters out of the shape's rect (`from:
  "shape"`), from an edge, scaling up, fading or on a cut; springs through `moves` (`x y w h r rot`);
  leaves the same ways, including `into: "shape"`. Layers join one with `"panel": "<id>"` (images,
  fills, sheens, footage and dialogue clips); `pops` punch panels too.
- **Frames:** `polaroid` (paper border) and `phone` (bezel and island; the content is the screen).
- **Shape opacity:** new track `o` hides the shape while panels or type carry the frame.
- **Masks:** big letters filled with an image, a gradient or a footage clip.
- **Callouts:** a dot on the product, a line drawn out to a label.
- **Check lists:** ✓/✗ rows that land on their words; with `head`, a comparison ("Glowa / Biasa").
- **Marquees:** a band of repeating promo text, tilted if wanted.
- Every piece follows the look (new variables `--panel-round`, `--panel-shadow`, `--panel-border`,
  `--panel-paper`, `--device-ink`, `--callout-line`, `--callout-width`, `--callout-dot`,
  `--marquee-*`, `--check-yes`, `--check-no`, `--mask-shadow`, `--mask-stroke`, set in all seven
  non-classic looks) and the look's text entrance.
- Films without layout pieces render as in 0.4.0 (Dior, ginger shampoo, flat shoes and the look
  sampler in all eight looks: no pixel differs by more than the ±1 level two runs of 0.4.0 also show).

**Gates**
- `qa_safe.mjs` checks masks, callout labels and check rows for safe zone and overlap, a marquee for
  its height, and fails a visible panel with no visible layer.
- `validate.mjs` checks panel, pop and mask references, panel-layer restrictions and comparison
  columns, and counts footage masks as footage for the style rules.
- New contrast check: with the engine defaults, the look and `theme.css` merged, chip/callout/check
  row, label, CTA and marquee text must reach 3:1 on its surface. It caught a full classic-era theme
  kept under `tech-neon` (light ink on a white surface) and a brand accent with the look's dark CTA
  ink (2.6:1).

**Docs**
- Shorter English and Indonesian README landing pages. Full gallery, user guide and technical
  reference live in `docs/`, with language links and the existing benchmarks and media credits.
- `references/layouts.md`: catalogue, rules, recipes, per-style and per-look use, sound, variables.
  `direction.md`, `styles.md` (picture-in-picture, split of two clips, footage collage and masks),
  `looks.md`, `scenes-format.md` and `render-and-qa.md` updated.
- `ad-concept`: the scene menu gains twelve layout recipes, the concept uses 2–4 per film, and the
  look guide lists the layouts each look reads best with.

**Example and showcase**
- `examples/layout-sampler/`: a 20 s ad that walks through kinetic type, a split screen, a text mask,
  callouts, a comparison list, a grid that becomes a collage under a marquee, and a phone with the
  shop page. Two SVG drawings ship with it; voice and music are free.
- `media/layouts.mp4` and `.gif`: that film in all eight looks.
- `media/ugc-layouts.mp4` and `.gif`: permitted ginger-shampoo creator footage in all eight looks,
  with picture-in-picture, split screen, a polaroid collage, marquee and volume callout. Reuses
  the existing ElevenLabs audio; labelled hybrid (b-roll + voice-over), not creator dialogue.

**Measured** (M3 Pro, picture render, 30 fps with motion blur): the 20 s layout sampler takes
19.8–45.5 s per look, 0.99–2.28 s per film second against 0.95–2.38 for the 17 s look sampler
(−7 % to +9 % by look). Three extra footage streams on screen for a whole 20 s film cost +1.8 %;
three extra images, nothing measurable.

## 0.4.0

**Looks**
- New `"look"` in `scenes.json`: a ready-made visual direction, independent of the style. Eight
  ship in `looks/`: `classic` (the default, unchanged), `luxe-editorial`, `clean-clinical`,
  `bold-streetwear`, `warm-organic`, `tech-neon`, `pop-playful`, `ugc-native`. Each sets fonts,
  palette, three fill tones, chip/label/CTA shape, caption defaults and how text enters.
- `theme` overrides the look (css key by key; `pools` and `enter` whole; fonts added), so brand
  colours go over any look. `captions` fields override the look's caption defaults.
- Twelve OFL font families ship with the skill (`looks/fonts/`, Latin subsets from Fontsource, 520 KB
  with their licences): no download, no network.
- New `theme.enter`: `blur` (as before), `rise` (glyphs slide up out of a mask), `cut` (on and off
  on frame boundaries), `pop` (scale with overshoot), `wipe` (left-to-right reveal), `type` (typed
  on, at most 0.6 s per piece). Texts, chips, labels, odometers and the CTA text follow it. `rise`
  and `wipe` never move the box the layout gate measures.
- New theme variables, each falling back to the built-in value: `--tone-1…3`, `--display-weight`,
  `--text-weight`, `--head-case`, `--head-tracking`, `--head-leading`, `--caps-tracking`,
  `--caps-weight`, `--text-shadow`, `--acc-glow`, `--ui-font`, `--ui-ink`, `--ui-weight`, `--ui-case`,
  `--ui-tracking`, `--ui-round`, `--ui-border`, `--chip-shadow`, `--cta-shadow`, `--cta-ink`,
  `--caption-font`, `--caption-weight`, `--caption-radius`, `--caption-stroke`.
- Films without a look render pixel-identical to 0.3.0 (checked on the minimal example, the Dior,
  ginger shampoo and flat-shoes films).
- `validate.mjs` checks that the look exists, that its theme and caption defaults pass the schema,
  and that its fonts are present.
- `references/looks.md`: the catalogue, per-look direction (shape, pace, music, sound effects,
  voice), brand overrides, and how to write scenes that work in every look. `ad-concept` picks a
  look (`look:` in `brief.md` and `concept.md`) from the category and brand tone, or takes the
  user's; `references/looks.md` there explains the choice in plain language.

**Example and showcase**
- `examples/look-sampler/`: a 17 s asset-free ad with free voice and music whose fills use only
  the look's tones; change `"look"` and render again.
- `media/looks.mp4` and `.gif`: that film in all eight looks, side by side.

**Measured** (17 s film, M3 Pro, picture render): 16–40 s per look. Film grain is the cost: the
three looks without grain render in half the time of `classic`; the others are within 2 %. Grain
in `bold-streetwear` and `warm-organic` was lowered from 0.08/0.07 to 0.05 after it measured 15 %
slower and made files twice as large.

## 0.3.0

**ElevenLabs sound effects**
- New `sfx` block: named samples generated from a prompt with ElevenLabs Sound Effects
  (`scripts/sfx.py`, run by `make.sh`, cached until the prompt, `dur` or `influence` changes), or
  your own licensed files.
- New cue kind `sample` (`src`, optional `align: "start"`) places them in the mix next to the
  synthesized cues. `validate.mjs` checks that every `src` exists in `sfx`.

**Fix: captions with a voice-over ran across sentences**
- With `vo`, words carried no punctuation, so a caption chunk could join the end of one sentence and
  the start of the next ("BANGET DIPAKAI SEHARIAN"). `place_vo.py` now takes each word's trailing
  punctuation from `vo.script`, and captions break at commas and sentence ends as they already did
  for `dialogue`.

**Example: `examples/product-broll/`**
- A 20 s hybrid ad for a fictional shampoo: eight muted product clips (hands only, no faces) under an
  ElevenLabs voice-over, music and sound effects; ingredient card, benefit chips, three bands that
  pop on their words, a band that swallows the others, and an end card. Ships `concept.md`,
  `scenes.json` and the headline font (Nunito, OFL); its README lists the shots to film and what to
  re-fit after generating a new voice or track.
- The shot list follows a product UGC video by @hanie.ugc.creator on TikTok (credited in the example's
  README); that video's footage and brand are not included.

## 0.2.2

**Fix: stray marks on odometer numbers**
- Reported from the black-box films: a sliver of the neighbouring digit showed above "48 jam" and
  "8 jam", even after the number stopped. Cause: each rolling cell was exactly 1 em tall, and serif
  fonts with old-style figures (Georgia, Cormorant) draw digits past their em box, so the digit above
  reached into the window.
- Odometers now use lining figures, cells 1.4 em tall, and a window clipped to the middle 1 em: at
  rest no neighbour can reach the window, and while rolling the digits stay in the number's band
  (they used to rise into the label above). Digit positions on screen are unchanged.
- The layout gate measures odometer glyphs instead of the padded cells; the review checklist adds a
  zoom-in on every number at rest.

**API key safety**
- `scripts/set_key.sh`: the user stores `ELEVENLABS_API_KEY` in `.env` from their own terminal
  (hidden input, `chmod 600`, added to `.gitignore`); it refuses piped input.
- `check_setup.sh` reports where the key is (environment or which `.env`), never its value, and warns
  when the file is readable by others or not git-ignored. `.env` lines may use `export`.
- Both skills forbid the agent to ask for a key in chat or to read, print or echo `.env`.

## 0.2.1

**Examples for users** (in `skills/ad-concept/`, so they install with the skill)
- `examples/prompts.md`: copy-paste prompts for `motion`, `ugc` and `hybrid`, in checkpoint and
  autopilot, with a `brief.md` and fully self-contained without one, plus follow-up prompts
  (concept only, approve, switch style, revise, 15 s cutdown, ask for a shot list).
- `examples/brief-motion.md`, `brief-ugc.md`, `brief-hybrid.md`: one fictional product (Glowa Lip
  Serum) briefed three ways, so the asset differences between styles are visible side by side.
- `templates/creator-shot-list.md`: what a creator records per take (3 hook variants, intro, demo,
  result, CTA, b-roll), phone settings, light, pauses, delivery and release.
- Assets-per-style table in `references/intake.md` and both READMEs; `ad-concept` hands out the
  shot list when a user wants `ugc`/`hybrid` without footage.
- READMEs reorganised by topic with a table of contents: using it (quick start, how it works,
  material, prompts, styles, voice and music, duration), results (quality gates, limits, measured
  speed), technical (requirements, layout, licence). Limits that were scattered now sit in one section.

## 0.2.0

**Two skills**
- Repo split into `skills/ad-concept` and `skills/vertical-product-ads`; one `npx skills add` installs both.
- New `ad-concept` skill: intake from `brief.md` and assets, research, 3 hooks with different angles,
  script, beat sheet, claims table and audio plan, written to `concept.md`. Checkpoint mode (default)
  waits for approval; autopilot continues and logs `ASSUMPTION:`/`DECISION:`.
- `vertical-product-ads` now starts from an approved `concept.md` (new step 0).

**Styles**
- `style`: `motion` (unchanged), `ugc` (creator footage leads, captions) and `hybrid` (footage plus
  motion scenes in the same shape).
- New scenes fields: `footage`, `dialogue`, `captions`, video layers (`clip`, `dialogue`, `cut`).
- New scripts: `footage.py`, `transcribe.py`, `place_dialogue.py`.

**Free options**
- Voice-over with edge-tts (`vo.engine: "edge"`); licence caveat documented.
- Music from a local synth (`music.synth`).
- Footage transcription with faster-whisper; `check_setup.sh --with edge|whisper|all`.

**Rules**
- Duration: default 30 s, 15–60 s allowed, over 34 s warns, over 60 s refused; hook inside 3 s,
  CTA held 3–5 s.
- New gates: style checks, dialogue cuts that fall inside a word, duration.
- The layout gate (`qa_safe.mjs`) now checks every output frame instead of every 0.05 s, and adds
  two checks: overlapping text/UI blocks (double-printed text) and empty bands (bare surface or a gap
  between footage segments). The per-frame check found a footnote in the Dior film rising 4 px past
  the safe zone for a frame during its entry; footnotes now sit at `y` ≈ 1404.

**Fixes**
- Captions: a chunk leaves before the next one enters (they overlapped for 40 ms), the pop-in no
  longer overshoots past full size, and the widest chunk stays symmetric about the frame centre
  inside the asymmetric safe zone.
- `render.mjs` gives each tab whole frames, so a footage frame loads once per output frame.
- `"set": "full"` now also merges the bands (`gap` 0, `rin` 0). Opening full bleed straight from
  split bands used to leave the gaps as thin lines across the end card (found in the black-box
  checkpoint run). The Dior film is pixel-identical (it always merged first).
- Hard cuts (`cut: true`) snap to the boundary between two output frames, so a cut no longer renders
  one 50/50 double-exposure frame, and a clip starting at 0 s no longer half-fades its first frame.
- Synth music regenerates when its parameters change; `tempo.py` takes a synth bed's key from
  `music.key` (detection confused C major with A minor). `theme.fontFaces[].weight` accepts a
  variable-font range (`"300 700"`). `vo.py`'s speed hint names `settings.rate` for edge voices.
- Mastering: `finish.sh` now raises the mix into a −1 dBFS limiter and repeats until the master is
  within 0.2 LU of the target. `loudnorm`'s linear mode could not add gain on a dense mix (true peak
  already near −1 dBTP), and the gate failed at −14.8 LUFS until the mix was tuned by hand.
- `transcriber: "auto"` falls back to faster-whisper when the ElevenLabs key lacks speech-to-text
  permission (401/403), and reuses that transcript from cache. Every ElevenLabs call retries 429/5xx.
- `footage.py` defaults to 1080×1920 when `format` is not written yet.

**Black-box tests** (fresh agents, skills installed with `npx skills add`, only the installed docs)
- Checkpoint: a 30 s `motion` ad with free voice and music. The concept with 3 hooks was written
  and approval requested after 1 min 13 s; the final MP4 came 10 min 52 s after the prompt.
- Autopilot: a 24 s `hybrid` ad from creator footage (retake cut out), a b-roll and photos, with
  ElevenLabs music. Prompt to final MP4 took 13 min 28 s.
- Their reports drove the fixes above and the doc changes: intake rules (a failing asset counts
  as missing, a blank brief field means the agent decides, conflicts between sources), measured
  edge-tts rates, synth `end`, chip `y`, `musicDb` scope, text scrims, and font downloads.

**Docs**
- `README.id.md` (Indonesian), brief and concept templates, styles reference.
- Limits stated: agents cannot watch videos, b-roll is muted, avatar UGC is not supported.

## 0.1.0

First release, extracted from a 31 s Dior Addict Lip Glow ad built by hand.

**Engine**
- The `scenes.json` engine reproduces that hand-written film pixel for pixel under CPU
  rasterisation: PSNR ∞ at 24 sampled times.
- The audio pipeline reproduces the same beat grid, word timings, 60 cues and a mix within
  1.5·10⁻⁸ of the original.

**Speed** (same film, Apple M3 Pro)
- 30 fps with a 180° shutter by default: 3,720 subframes instead of 7,440, and every frame keeps
  the same subframe times it had at 60 fps.
- JPEG q95 capture instead of PNG: 33 ms instead of 344 ms per subframe.
- Chromium on Metal: 59–61 subframes/s with 6 tabs, against 48 on SwiftShader.
- Chunk encoding overlaps capture.
- Result: the picture render took 71 s, against 219 s before.
- The picture is encoded once, at CRF 19. Mastering touches the audio only: ~5 s instead of 35 s,
  and one fewer lossy generation.

**Workflow**
- Half-size draft with sound in 12 s.
- Beat contact sheet.
- Gates: schema and cross-references, VO spacing, the 9:16 safe zone every 0.05 s, delivered
  loudness, and chunk seams.
- `make.sh preview|final`, `check_setup.sh`, and an asset-free example.

**Black-box test**
- A fresh agent with only these docs made a 12 s Indonesian ad (voice, generated music, 5 scenes)
  in 5 min 05 s, from reading `SKILL.md` to the final MP4, with every gate passing.
- Fixed from its report:
  - `voices.py` lists voices by language and gender;
  - `vo.place` is optional until `vo.py` has run;
  - the VO gap error says how far to move which segment;
  - snaps carry time and beat stamps, and manual snaps go to a fresh folder each run;
  - the docs explain `k<n>`, the vertical bands, `place`/`pivot`, text box geometry, white
    normalisation, square packshot end cards, music endings, and the loudness gate margin.
