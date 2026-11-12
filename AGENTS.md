# Repository Guidelines

## Project Overview

An agent skill for producing 9:16 product ads from a declarative `scenes.json`, rendered as a mastered MP4. For individual ads, author scene data rather than modifying the engine or pipeline; follow `SKILL.md` for the production workflow and creative constraints.

## Architecture & Data Flow

- `scripts/make.sh` orchestrates validation, optional voice and music generation, beat analysis, voice placement, cue extraction, audio mixing and safe-zone checks. Preview produces a contact sheet and draft; final renders and masters the video.
- `engine/index.html` and `engine/engine.js` load project data and expose deterministic `seek(t)` rendering. Timeline tracks and time expressions resolve against voice-word timings (`w<i>`), music beats (`k<n>`) and anchors. Keep visual state derivable from the requested time, not prior frames.
- Playwright drives the engine for cue extraction, layout QA, snapshots and frame capture. `scripts/render.mjs` feeds frames to FFmpeg; `scripts/finish.sh` masters audio, muxes video and runs final QA.
- `scenes.json` is the shared contract: update `schemas/scenes.schema.json`, `scripts/validate.mjs`, the engine and `references/scenes-format.md` together when changing its behavior.

## Key Directories

- `engine/`: browser rendering and layout. Layout pieces (panels, masks, callouts, check lists, marquees) live beside the shape: panels in `#world` (camera applies), the rest in `#hud`; `scripts/qa_safe.mjs` must know each new HUD class to gate it.
- `looks/`: look presets (`<name>.json`: theme + caption defaults) and their OFL fonts; served to the engine at `/looks/` by `scripts/lib/stage.mjs`. A new look variable needs a fallback at its `var()` use in `engine/index.html`, so films without it render unchanged.
- `scripts/`: shell orchestration, Node/Playwright rendering and validation, Python audio processing; shared helpers in `scripts/lib/`.
- `schemas/`: scene JSON schema.
- `references/`: scene format, direction, looks, layouts, timing, safe zones and render/QA details.
- `examples/minimal/`: asset-free example project.
- `examples/product-broll/`: hybrid example (b-roll + VO + motion); the footage is not included, its README lists the shots.
- `examples/look-sampler/`: asset-free film whose fills use only look tones; render it per look to check a look change.
- `examples/layout-sampler/`: every layout piece in one film (SVG assets included); render it per look to check a layout or look change.
- `docs/`: English and Indonesian user guides, showcase galleries and technical references. Keep `README.md` and `README.id.md` as concise introductions; put detailed instructions, media catalogues and benchmarks in these pages, updating both languages together.

## Development Commands

Run from the repository root; `<project>` is a separate ad directory containing `scenes.json`.

```bash
npm install
scripts/check_setup.sh
cp -r examples/minimal /tmp/vertical-ad-example
node scripts/validate.mjs /tmp/vertical-ad-example
scripts/make.sh /tmp/vertical-ad-example preview
scripts/make.sh /tmp/vertical-ad-example final /tmp/vertical-ad-example/out.mp4
node scripts/snap.mjs /tmp/vertical-ad-example 1.0 1.1 1.2
```

There are no npm build, test or lint scripts in `package.json`. Use the relevant validation and pipeline commands above for changes; `scripts/check_setup.sh` can install missing dependencies.

## Code Conventions & Common Patterns

- JavaScript uses ES modules (`.mjs` for Node scripts), async/await for browser and I/O operations, and shared Playwright/server helpers in `scripts/lib/stage.mjs`. Python scripts share project, environment and audio/API helpers in `scripts/lib/common.py`; invoke them through `scripts/py` to select a Python with NumPy.
- Follow existing local formatting and naming; shell entry points use `set -euo pipefail`. Validation and QA gates fail with actionable errors rather than silently bypassing invalid input.
- Film configuration and generated files in the project directory carry state between pipeline steps; there is no application-wide state container or dependency-injection framework. Preserve deterministic, random-access engine rendering.
- Scene timing should reference measured words and beats rather than guessed seconds. Keep visible text and UI within `format.safe`; only photography may bleed. Preserve the continuous morphing-shape direction and on-screen claim footnotes.

## Important Files

- `SKILL.md`: agent-facing workflow and non-negotiable production rules.
- `scripts/make.sh`: preview/final entry point; `scripts/validate.mjs` and `scripts/qa_safe.mjs`: input and layout gates.
- `scripts/render.mjs`, `scripts/finish.sh`, `scripts/qa_video.py`: frame rendering, mastering and delivery checks.
- `scripts/tempo.py`, `scripts/place_vo.py`, `scripts/audio.py`: beat analysis, VO placement and sound mix.
- `references/scenes-format.md` and `schemas/scenes.schema.json`: scene contract; `references/render-and-qa.md`: gate details and troubleshooting.

## Runtime/Tooling Preferences

Use Node.js 20 or newer and npm (`package-lock.json`); the Node dependencies are Ajv and Playwright, with Chromium installed for Playwright. FFmpeg/FFprobe and Python 3 with NumPy are required. `scripts/py` selects `$PYTHON`, the repository `.venv`, or system Python when suitable. `ELEVENLABS_API_KEY` is optional for voice-over and prompted music generation; it can come from the environment or a project/ancestor `.env`. Do not commit credentials or generated project output.

## Testing & QA

No dedicated test framework or coverage target is configured. `validate.mjs` checks schema and cross-references; `qa_safe.mjs` samples visible text/UI every 0.05 seconds against the configured safe area. The final pipeline checks loudness and render-chunk seams. See `references/render-and-qa.md` for thresholds and recovery; never bypass a failing gate.

Review `snaps/sheet.png` and `renders/draft.mp4` before final rendering. Snapshot each transition at its time and ±0.1 seconds; inspect the final storyboard. The minimal example needs no API key and is suitable for an end-to-end smoke check. Preview replaces the project's `snaps/` directory, so use a disposable copy when testing.
