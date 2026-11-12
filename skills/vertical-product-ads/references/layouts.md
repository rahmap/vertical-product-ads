# Layouts

The shape (card, circle, bands, full bleed) is still the backbone of every film. Layouts add pieces
around it: **panels** (more frames: split screen, grid, picture-in-picture, collage, card stack, phone),
**masks** (a picture inside big letters), **callouts**, **check lists** and **marquees**. The look styles
every piece, so a layout written once works in all eight looks. Fields: `scenes-format.md`. Working
film with all of them: `examples/layout-sampler/`.

## Catalogue
| Layout | Use it for | Built from |
|---|---|---|
| One shape | Hero, before/after wipe, claim number, end card | the shape (`direction.md`) |
| Stacked split | Three variants or textures, top to bottom | shape bands `gap`/`b0..b2` |
| Split screen | Before/after, ours vs. the usual, day 1 vs. day 7 | 2 panels side by side |
| Grid | Shades, sizes, uses, a bundle | 3–4 panels |
| Picture-in-picture | Creator keeps talking over b-roll, or product over the creator | a small panel in a corner |
| Collage | Lifestyle, "everyone uses it", a moodboard | `polaroid` panels, `rot`, panel `pops` |
| Card stack | Reviews, features one by one | panels with `moves` sliding out, the next sliding in |
| Editorial grid | Luxury: one big picture, one small, big type | 2 panels of different sizes + `texts` |
| Phone | Shop page, checkout, an app screen | a `phone` panel with a screenshot (or, in `ugc`/`hybrid`, a screen recording) |
| Kinetic type | Hook or claim told by words alone | shape `o: 0` + `texts`/`masks` |
| Text mask | Brand name or hook word with the product or footage inside | `masks` |
| Callouts | Ingredients, features on a packshot | `callouts` |
| Comparison list | Benefits as ✓ rows; ours vs. theirs | `checks` (with `head` for a comparison) |
| Marquee | Promo, free shipping, a running claim | `marquees` |

## Rules
1. **Panels come from somewhere.** Grow them out of the shape (`from: "shape"`, default), slide them
   from the edge the eye expects (`left`/`right`/`bottom`), or pop them up (`scale`) on a beat. Leave
   the same way (`into: "shape"` merges back). The shape hands over with a timeline event
   `{ "set": { "o": 0 }, "sp": "jump" }` on the panels' `tin`, and takes back with `o: 1` after they
   land (`into: "shape"` lands, then fades over 0.15 s from `tout + 0.35`).
2. **One layout per beat.** At most four panels on screen; a grid holds one beat, then becomes
   something else.
3. **Text sits on a surface or outside the pictures.** Labels above panels (`caps`), check rows on
   their own surface, callout labels are surfaces. Put headlines where no panel is.
4. **Masks need a calm background.** A mask over busy footage is unreadable: hide the shape behind it
   or put it over a flat fill. `ugc-native` adds a white stroke for the cases where it must sit on footage.
5. **Callout labels stay inside the safe zone**, the dot may sit anywhere on the product. Labels on the
   right of a centred product leave about 330 px: move the product left (shape `x`) to make room.
6. **Panel layers need no `tin`/`tout`.** The panel's entry and exit show and hide them. Give a layer a
   `tout` only to change the picture inside a panel; keep footage running until the panel has left
   (a dialogue layer stops at its segment's end unless its `tout` is later).
7. **The gates apply.** Masks, callout labels and check rows are checked for safe zone and overlap like
   text; a marquee only for its height; a visible panel with no visible layer fails like an empty band.

## Recipes
**Split screen out of the card** (before/after on "Ini bedanya"):
```json
"timeline": [{ "at": "SPLIT", "set": { "o": 0 }, "sp": "jump" }],
"panels": [
  { "id": "before", "x": 300, "y": 960, "w": 440, "h": 880, "r": 40, "tin": "SPLIT", "tout": "MERGE", "from": "shape", "into": "shape" },
  { "id": "after",  "x": 780, "y": 960, "w": 440, "h": 880, "r": 40, "tin": "w3-0.2", "tout": "MERGE", "from": "right", "into": "shape" }
],
"layers": [{ "id": "b", "src": "before", "panel": "before" }, { "id": "a", "src": "after", "panel": "after" }]
```
**Picture-in-picture** (ugc: the creator keeps talking over the b-roll):
```json
{ "id": "pip", "x": 745, "y": 560, "w": 330, "h": 440, "r": 32, "tin": 9.3, "tout": 12.6, "from": "scale", "into": "scale" }
{ "id": "pipTalk", "kind": "video", "src": "talk", "dialogue": 2, "panel": "pip", "tout": 13.4, "fy": 0.3 }
```
**Grid into collage:** four `polaroid` panels `from: "shape"` staggered 0.06 s, then on the next word
a `moves` entry each (`rot` −7…5, small `x`/`y` nudges, `sp: "snap"`) and a panel `pop` each. Exit to
the nearest edge (`into: "left"`/`"right"`).

**Card stack:** panels at the same place; on each beat the top one `moves` to `x: -400` (or leaves
`into: "left"`) and the next one `from: "right"` lands. One review or feature per card.

**Phone:** `{ "frame": "phone", "w": 480, "h": 980, "r": 72, "from": "bottom", "sp": "move" }` with a
screenshot (≈ 400 × 846) or a screen recording as its layer; the CTA goes below it.

**Text mask:** `{ "text": "GLOWA", "y": 262, "size": 190, "fill": "linear-gradient(100deg, var(--tone-3), var(--tone-2), var(--tone-3))", "tin": "w4" }`.
Size it so the widest look still fits: 190 px for six capitals; the gate measures every look.

**Callouts:** one per word that names the feature, `tin` 0.05 s before the word, all leaving together
before the next layout (`tout` 0.2 s before it, so they never overlap what comes next).

**Comparison:** `{ "y": 900, "w": 780, "size": 42, "head": ["Glowa", "Biasa"], "rows": [{ "text": "Lebih lembap", "at": "w13", "marks": [true, false] }] }`.
Rows land on their words; marks draw 0.12 s later.

**Marquee:** `{ "text": "Promo 7.7 • Gratis ongkir", "sep": "✦", "y": 940, "h": 100, "rot": -5, "tin": "w20", "tout": "SHOP" }`
across the middle of a grid or a packshot.

## Styles
- **motion:** panels hold photos or `fill`s (tones); masks use `src` or `fill`.
- **ugc:** panels hold footage: picture-in-picture of the creator over b-roll, a split of two clips,
  a phone with a screen recording. Captions stay on top of everything. Masks may use `footage`
  (on a calm background).
- **hybrid:** both: a collage of b-roll clips, callouts on the packshot end card, a check list over
  muted footage.

## Per look
The look styles every piece; these are the layouts each look reads best with.
| Look | Layouts that fit | How the pieces look |
|---|---|---|
| `classic` | split screen, callouts, comparison | soft shadows, pill rows, accent lines |
| `luxe-editorial` | editorial grid, text mask, callouts | near-square panels with hairline borders, 2 px ink callout lines, dark marquee in Jost |
| `clean-clinical` | split screen, comparison, callouts | rounded panels with a teal hairline, teal lines and checks |
| `bold-streetwear` | split screen, marquee, grid | square panels with a white 4 px border, no shadow, lime lines, lime marquee in Anton |
| `warm-organic` | collage, callouts | very round panels, cream paper, terracotta lines and marquee |
| `tech-neon` | phone, check list, callouts | cyan glow ring, dark paper, cyan lines, glowing masks, mono marquee |
| `pop-playful` | collage, marquee, grid | very round panels, thick outline and hard offset shadow, outlined masks |
| `ugc-native` | picture-in-picture, split screen, check list | white-bordered panels like stickers, green ✓ red ✗, yellow marquee, white-stroked masks |

## Sound
- Slide-in or merge: `whoosh` (`up` for in, `rev` for out); a panel `pop`: `glass` or `pop`.
- Callout dot: `pluck`, rising notes per callout; check row: `tick` 0.12 s after the row.
- Grid or collage landing: `glass`; marquee entering: `swish`.

## Look variables
| Variable | Piece |
|---|---|
| `--panel-round` | panel corner radius × 0–1 (phones keep theirs) |
| `--panel-shadow`, `--panel-border` | panel shadow; border drawn inside the picture |
| `--panel-paper` | polaroid paper |
| `--device-ink` | phone bezel |
| `--callout-line`, `--callout-width`, `--callout-dot` | callout line and dot |
| `--marquee-bg`, `--marquee-ink`, `--marquee-font`, `--marquee-weight` | marquee band |
| `--check-yes`, `--check-no` | ✓ and ✗ strokes |
| `--mask-shadow`, `--mask-stroke` | mask drop shadow (a CSS `filter`) and outline |

Chips, callout labels and check rows share the UI variables (`--surface`, `--ui-ink`, `--ui-font`,
`--ui-round`…, `looks.md`).

## Cost
Layout pieces are positions, clips and a few strokes: they do not slow the render the way film grain
does (`render-and-qa.md`). Measured on an M3 Pro: the 20 s layout sampler renders at 0.99–2.28 s per
film second depending on the look, −7 % to +9 % of the look sampler; three extra footage streams on
screen for a whole 20 s film add 1.8 %.
