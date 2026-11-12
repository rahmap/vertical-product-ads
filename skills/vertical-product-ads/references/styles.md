# Styles (production side)

`style` in `scenes.json` is `motion` (default), `ugc` or `hybrid`. The concept's `style:` decides it.
`validate.mjs` enforces:
- `motion`: no `video` layers.
- `ugc` and `hybrid`: at least one `video` layer. `ugc` also needs `captions`.

Fields are in `scenes-format.md`; the motion recipes are in `direction.md`. This file adds the footage
recipes the concept's scene menu refers to.

## Footage basics
- `footage` names each clip: `"talk": { "file": "assets/talk.mov", "speech": true }`. `speech: true`
  marks clips whose talking `dialogue` may use. Clips without it are b-roll and are **muted**, unless
  `"sound": { "gainDb": -12 }` keeps the clip's own audio under the voice (Affiliate, below).
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

## Affiliate (`objective: affiliate` in the concept)
A first-person recommendation for TikTok Shop: the creator's own muted b-roll under a `vo`, hard cuts,
captions on, few graphics. `style` is `hybrid` (or `ugc` with talking footage), `look` is `ugc-native`
unless the concept says otherwise. Differences from the rules above and in `direction.md`:
- **Cuts, not morphs.** The shape stays full bleed for the whole film (`shape.initial` as below, an
  empty `timeline` or camera moves only). Every shot is its own `video` or `img` layer with
  `"cut": true` on video and `tin`/`tout` on a word.
- **Cut on words, not beats.** `tin` is `w<i>-0.05` of the word that names what the shot shows. Music
  is a low bed (`audio.musicDb` −24 to −22); beats `k<n>` are optional.
- **A new picture every 1.5–3 s.** Reuse a clip with another `clip.in`, or the same picture with another
  `fx`/`fy`/`zoom`. Alternate wide and close; never two shots with the same framing in a row.
- **Hand-held feel.** Give each shot a slow push or pull (`zoom` `{ "to": 1.04–1.08, "sp": "slow" }`),
  alternating direction (start at 1.06 with a number, or push to 1.06). No sheen, no blur swaps.
- **Graphics are stickers.** At most one text line or chip group on screen besides the captions.
- Captions: `{ "style": "plain", "case": "none", "anim": "pop", "maxWords": 3, "size": 64 }`, at `y` 1181, or lower
  (1300) while a sticker sits mid-frame.

### Affiliate hook
The strongest own shot from second 0, the hook line spoken and captioned, one sticker line naming
the topic. No title card, no logo.
```json
"shape": { "initial": { "x": 540, "y": 960, "w": 1080, "h": 1920, "r": 0 } },
"timeline": [],
"layers": [
  { "id": "h1", "kind": "video", "src": "pakai", "clip": { "in": 3.2, "at": 0 }, "cut": true, "tin": 0, "tout": "w5-0.05",
    "zoom": { "to": 1.06, "at": 0, "sp": "slow" } }
],
"texts": [ { "y": 300, "cls": "sans sub", "lines": [[{ "t": "Nemu di keranjang kuning", "at": 0.1 }]], "tout": "w5-0.05" } ]
```

### Review b-roll
The body of the film: own clips cut on the words that describe them.
```json
"layers": [
  { "id": "b1", "kind": "video", "src": "buka",  "clip": { "in": 0.4, "at": "w5-0.05" },  "cut": true, "tin": "w5-0.05",  "tout": "w11-0.05" },
  { "id": "b2", "kind": "video", "src": "pakai", "clip": { "in": 7.0, "at": "w11-0.05" }, "cut": true, "tin": "w11-0.05", "tout": "w17-0.05", "zoom": 1.15, "fy": 0.6 },
  { "id": "b3", "kind": "video", "src": "detail","clip": { "in": 1.0, "at": "w17-0.05" }, "cut": true, "tin": "w17-0.05", "tout": "w24-0.05",
    "zoom": { "to": 1.05, "at": "w17", "sp": "slow" } }
]
```
A clip shorter than its slot holds its last frame: check each clip's length in `build/footage.json`
and pick `clip.in` so `in + (tout − tin)` stays inside it.

### Listing photo move
A seller photo as a cut-away. Seller photos are usually square and often carry text, so show them
**whole**: `"fit": "contain"` draws the picture uncropped over a blurred, darkened copy of itself.
```json
"assets": { "varian": "assets/listing-varian.jpg" },
"layers": [
  { "id": "p1", "kind": "img", "src": "varian", "fit": "contain", "cut": true, "tin": "w24-0.05", "tout": "w29-0.05",
    "zoom": { "to": 1.05, "at": "w24", "sp": "slow" } }
]
```
Never more than one third of the film, never the hook (`ad-concept` `references/affiliate.md`).

### Unboxing with its own sound
B-roll is muted unless the clip asks for its sound. `"sound": { "gainDb": -12 }` on a `footage` entry
mixes the clip's own audio wherever its `clip` layers show it (tearing tape, a click, a pour), ducked
under the voice like the music.
```json
"footage": { "buka": { "file": "assets/buka.mp4", "sound": { "gainDb": -12 } } }
```
Use it for one or two shots where the sound is the point. Clips with talking or music in them stay
muted.

### Price sticker
`prices` draws the price as a sticker: the was-price struck through, the price, an optional badge.
Values come from the concept, never from memory. The promo's end date goes in a footnote.
```json
"prices": [ { "x": 507, "y": 760, "price": "Rp79.000", "was": "Rp129.000", "badge": "-39%", "tin": "w61-0.05", "tout": "w70" } ],
"texts": [ { "y": 1404, "cls": "sans foot", "lines": [[{ "t": "*Harga promo sampai 30 Nov 2026, bisa berubah.", "at": "w61" }]], "tout": "w70" } ]
```

### Basket CTA
The last own shot keeps playing; the CTA pill enters on the CTA sentence and is pressed on its last
word. No end card.
```json
"cta": { "text": "Keranjang kuning", "y": 1300, "h": 104, "half": 250, "tin": "w98-0.1", "textIn": "w98+0.15", "press": "w101" }
```
End captions at the pill's `tin` (`captions.tout`) or keep them above it (`captions.y` ≤ 1130).

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
