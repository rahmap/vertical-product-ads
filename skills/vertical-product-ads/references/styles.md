# Styles (production side)

`style` in `scenes.json` is `motion` (default), `ugc` or `hybrid`. The concept's `style:` decides it.
`validate.mjs` enforces:
- `motion`: no `video` layers.
- `ugc` and `hybrid`: at least one `video` layer. `ugc` also needs `captions`.

Fields are in `scenes-format.md`; the motion recipes are in `direction.md`. This file adds the footage
recipes the concept's scene menu refers to.

## Footage basics
- `footage` names each clip: `"talk": { "file": "assets/talk.mov", "speech": true }`. `speech: true`
  marks clips whose talking `dialogue` may use. Clips without it are b-roll and are **muted**.
- `scripts/footage.py <project>` extracts frames to `build/footage/<name>/` (at `render.fps`, constant
  frame rate, scaled to cover the 9:16 frame) and writes `build/footage.json`. `make.sh` runs it.
  Never edit `build/`.
- A `video` layer shows the clip's frame at film time `t` = clip second `in + t − at`, so `at` is the
  film time where clip second `in` plays. Frames hold on the first/last frame outside the clip.
- Video layers are `cover` mode only: put the face and product where the crop keeps them (`fx`, `fy`
  set the focal point).
- `cut: true` makes the layer switch on/off hard at `tin`/`tout` (no fade, no blur). Use it for
  dialogue edits so the cut lands exactly on the word boundary.

## Dialogue: editing speech
`dialogue.segments` is the edit list. Each `{ footage, in, out, at, why }` plays clip seconds
`in`→`out` starting at film second `at`. Rules:
- Cut in the silence between words, never inside a word. `transcribe.py` writes
  `audio/transcript_<name>.json` with every word's clip time: choose `in` slightly before the first
  word start and `out` slightly after the last word end; `place_dialogue.py` fails a cut inside a word and suggests the nearest word edge.
- Segments must not overlap in film time (`place_dialogue.py` fails and names the pair).
- A `video` layer with `"dialogue": i` takes `in`/`at` from segment `i`; `tin` defaults to the
  segment's `at`, `tout` to `at + out − in`.
- `dialogue` replaces `vo`. Captions then come from the transcript.
- **Proofread the transcript** (`audio/transcript_<name>.json`) against the script and the brand
  words before the preview; fix spellings with `captions.fix`.

## Recipes

### Talking hook
Creator speaks from second 0; captions on; first words inside 3 s.
```json
{
  "style": "ugc",
  "footage": { "talk": { "file": "assets/talk.mov", "speech": true } },
  "dialogue": { "transcriber": "auto", "whisperModel": "small", "language": "id",
    "segments": [ { "footage": "talk", "in": 2.4, "out": 6.1, "at": 0.0, "why": "hook: problem" } ] },
  "captions": { "y": 1181, "size": 64, "maxWords": 3, "case": "upper", "style": "pill", "fix": { "lembab": "lembap" } },
  "shape": { "initial": { "x": 540, "y": 960, "w": 1080, "h": 1920, "r": 0 } },
  "layers": [ { "id": "s0", "kind": "video", "src": "talk", "dialogue": 0, "cut": true } ]
}
```

### Dialogue cut
Next spoken pieces follow with hard cuts; each its own layer.
```json
"dialogue": { "segments": [
  { "footage": "talk", "in": 2.4,  "out": 6.1,  "at": 0.0, "why": "hook" },
  { "footage": "talk", "in": 9.0,  "out": 15.2, "at": 3.7, "why": "product + benefit" } ] },
"layers": [
  { "id": "s0", "kind": "video", "src": "talk", "dialogue": 0, "cut": true },
  { "id": "s1", "kind": "video", "src": "talk", "dialogue": 1, "cut": true, "zoom": 1.08 }
]
```
Alternate framing between segments (the second one `zoom` 1.08, or a different `fx`) so a jump cut
reads as an edit, not a glitch.

### Demo b-roll
Muted footage over a spoken line. The dialogue segment keeps playing as audio; the b-roll layer is
drawn after it and hides it for its time. Words stay in sync because audio comes from the dialogue.
```json
"footage": { "talk": { "file": "assets/talk.mov", "speech": true }, "texture": { "file": "assets/texture.mov" } },
"layers": [
  { "id": "s1", "kind": "video", "src": "talk", "dialogue": 1, "cut": true },
  { "id": "demo", "kind": "video", "src": "texture", "clip": { "in": 0.5, "at": 6.0 }, "tin": 6.0, "tout": 8.4, "cut": true }
]
```

### Caption line
The spoken line is the on-screen text. `captions` already shows it word by word; for a number or a
claim that must stay readable, add a `texts` entry on the word (`"at": "w14"`) and a footnote
(`direction.md`, Truth). Keep captions inside the safe zone (`qa_safe` checks them).

### Talking CTA
Last segment is the creator saying the call to action; add the `cta` pill for 3–5 s.
```json
{ "footage": "talk", "in": 41.0, "out": 44.2, "at": 26.0, "why": "CTA line" }
```
`cta`: `{ "text": "Keranjang kuning", "y": 1345, "h": 104, "half": 240, "tin": 26.4, "textIn": 26.7, "press": 28.6 }`.

### Footage to card (hybrid)
Creator's hook plays full bleed; at its last word the shape closes into a card and the product
appears in the motion look.
```json
"shape": { "initial": { "x": 540, "y": 960, "w": 1080, "h": 1920, "r": 0 } },
"timeline": [
  { "at": "we9", "set": { "x": 540, "y": 960, "w": 900, "h": 900, "r": 64 }, "sp": "morph", "why": "hook ends: footage becomes a card" }
],
"layers": [
  { "id": "hook", "kind": "video", "src": "talk", "dialogue": 0, "tout": "we9+0.1" },
  { "id": "pack", "kind": "img", "src": "pack1", "mode": "world", "blend": "multiply",
    "place": { "size": 850, "srcSize": 2000, "imagePoint": [1000, 1000], "at": [540, 960] }, "tin": "we9+0.15" }
]
```
`we9` is the end of the 10th word (index 9) of `audio/words.json`. Here the video layer keeps its
default fade, because it leaves with a morph, not a cut.

### Product card (hybrid)
Between footage scenes the shape holds a packshot, text and chips exactly as in
`direction.md` ("Product reveal", "Ingredients"). Return to footage with `{ "at": …, "set": "full" }`
and a new `video` layer with `tin` on that time.

Start full bleed with `shape.initial` (as above), never with a timeline `set` at 0: a timeline
entry is a spring, so the first frames would show the card still opening.

### Music drop / Comparison / Claim number / Result / End card (hybrid)
Same fields as in `direction.md`.

### Picture-in-picture (ugc, hybrid)
The creator keeps talking in a small panel while b-roll fills the frame. The panel's layer is the same
dialogue segment, so lips stay in sync; give it a `tout` past the panel's exit, or it stops at the
segment's end and the shrinking panel shows empty (`layouts.md`).
```json
"panels": [{ "id": "pip", "x": 745, "y": 560, "w": 330, "h": 440, "r": 32, "tin": 9.3, "tout": 12.6, "from": "scale", "into": "scale" }],
"layers": [{ "id": "pipTalk", "kind": "video", "src": "talk", "dialogue": 2, "panel": "pip", "tout": 13.4, "fy": 0.3 }]
```

### Split screen of two clips (ugc, hybrid)
Day 1 vs. day 7, with vs. without: two panels, each with a `video` layer (`clip` or `dialogue`). Hide the
full-bleed shape with `{ "set": { "o": 0 }, "sp": "jump" }` on the first panel's `tin` and let that panel
grow out of it (`from: "shape"`), so there is never an empty frame. Captions stay on top.

### Footage collage and footage in letters (hybrid)
Three `polaroid` panels, each a different moment of the b-roll (`clip.in`), popping on the words that
list them; a `masks` entry with `footage` puts a clip inside the hook word. Masks need a calm
background (a hidden shape or a flat fill), never other footage.

## Audio by style
| Style | Speech | Music | Footage sound |
|---|---|---|---|
| motion | `vo` (ElevenLabs or edge-tts) | any | n/a |
| ugc | `dialogue` | synth/ElevenLabs/licensed, ducked under speech | speech clips only |
| hybrid | `dialogue` (footage) and/or `vo` — never both | same | speech clips only |

`dialogue` and `vo` are mutually exclusive in one `scenes.json`. A hybrid with footage speech plus
a narrated product section uses `dialogue` for everything and records the narration into a
footage clip, or uses `vo` and takes the footage as muted b-roll.

## Switching styles
1. Update the concept (`concept.md`) first; re-approve in checkpoint mode.
2. `motion` → `ugc`/`hybrid`: add `footage`, `dialogue`, `captions`; delete `vo`; change `style`.
   Words indices `w<i>` now refer to `audio/words.json` from the dialogue: re-check every one.
3. `ugc`/`hybrid` → `motion`: delete video layers, `footage` and `dialogue`; add `vo` and run
   `vo.py`; rewrite `w<i>`; change `style`. `captions` may stay (they then follow the voice-over).
4. Preview again; the review step is not skipped.
