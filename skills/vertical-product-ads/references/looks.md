# Looks

A **look** is a ready-made visual direction: fonts, palette, chip/CTA shape, caption style, how
text enters, and how the layout pieces look (panels, callouts, check lists, marquees, masks;
`layouts.md`). Set it with one line in `scenes.json`:

```json
"look": "bold-streetwear"
```

`style` (`motion`, `ugc`, `hybrid`) decides how the film is produced; `look` decides how it looks.
Any look works with any style. The concept's frontmatter names the look (`look:`); without one the
film uses `classic`.

## The looks
| Look | For | Type (display / text) | Palette | Text enters |
|---|---|---|---|---|
| `classic` | Anything; the Dior Lip Glow film | Georgia / system sans | Warm off-white, berry accent | `blur` |
| `luxe-editorial` | Fragrance, jewellery, premium beauty, fashion | Bodoni Moda / Jost | Ivory, near-black ink, bronze accent | `rise` |
| `clean-clinical` | Skincare actives, pharmacy, supplements, oral and baby care | Plus Jakarta Sans | Cool white, navy ink, teal accent | `wipe` |
| `bold-streetwear` | Sneakers, streetwear, energy drinks, fitness, gaming gear | Anton (capitals) / Archivo | Black, acid lime | `cut` |
| `warm-organic` | Herbal and jamu, coffee, food, hair and body care, home | Fraunces / DM Sans | Cream, brown ink, terracotta | `blur` |
| `tech-neon` | Gadgets, audio, apps, smart home | Space Grotesk / JetBrains Mono (chips, CTA) | Navy-black grid, cyan glow | `type` |
| `pop-playful` | Snacks, drinks, candy, toys, Gen-Z beauty | Bricolage Grotesque / Rubik | Peach and pink, indigo ink, yellow captions | `pop` |
| `ugc-native` | `ugc` and `hybrid` with creator footage | TikTok Sans | Footage first; white text, yellow highlights | `cut` |

The files are `looks/<name>.json`; the fonts are in `looks/fonts/`, all under the SIL Open Font
License (each family's licence sits next to it). They load from the skill: no download, no network.

## Directing each look
The look sets the surface; you still direct the motion. Each look reads best with the shape, pace and
sound below.

| Look | Shape | Pace | Music (ElevenLabs prompt idea · free synth) | Sound effects | Voice |
|---|---|---|---|---|---|
| `classic` | Cards `r` ≈ 52, circles, bands with `rin` 28 | A change every 1–2 beats | Elegant pop, 120 BPM · `pop` 120 | All kinds, sparingly | Warm, natural |
| `luxe-editorial` | Square-ish cards (`r` 0–24) or full bleed; `gap` 10, `rin` 0–12 | One change per bar; `settle`, `slow`, `drift`; long Ken Burns | Minimal deep house or slow R&B, 100–112 BPM, piano chords · `chill` 104 | `shimmer`, soft `whoosh`, `chime`; no `pop` | Calm, unhurried |
| `clean-clinical` | Cards `r` 32–48, circles for numbers; `gap` 16, `rin` 24 | A change every 2 beats; odometers and check chips | Clean minimal electronic, 110–118 BPM, soft plucks · `minimal` 114 | `tick`, `glass`, `click` | Clear, mid tempo |
| `bold-streetwear` | Square (`r` 0); `gap` 20, `rin` 0 | Every beat, lists on 8ths; `snap`, `jump`; slam every key word; zoom punches 1.08 → 1 | Trap, drill or phonk, 130–140 BPM, heavy 808 · `pop` 132 | `sub`, `whoosh`, `swish`, `click`; no `chime` | Punchy, fast |
| `warm-organic` | Soft cards `r` 56–80, circles; `gap` 14, `rin` 32 | A change every 2 beats; ingredient chips; `sheen` over textures | Acoustic organic house, 112–120 BPM, marimba, plucked guitar · `chill` 114 | `pluck`, `glass`, soft `whoosh` | Warm, friendly |
| `tech-neon` | Cards `r` 24–32; `gap` 12, `rin` 12 | Every beat; `snap`, `lead`/`trail`; numbers and spec chips | Synthwave or future bass, 120–128 BPM, arpeggios · `pop` 124 | `tick`, `click`, `swish`, bright `shimmer` | Confident |
| `pop-playful` | Pills and circles (`r` ≥ 64); `gap` 20, `rin` 40 | `pops` on every listed word; `snap` | Bouncy pop, 120–130 BPM, claps, marimba, bright stabs · `pop` 124 | `pop`, `pluck`, `glass`, `click` | Bright, quick |
| `ugc-native` | Footage full bleed; motion scenes short | Cuts on the speech; captions carry the words | Often none under talking; a quiet licensed bed · `minimal`, low | `pop`, `click`, a `whoosh` per scene change | The creator's own |

## Brand colours and fonts
The brand comes first. Keep the look and override in `theme`:

```json
"look": "warm-organic",
"theme": { "css": { "--accent": "#2F6B3A", "--accent-pressed": "#22502B",
                    "--tone-1": "#DCE8D5", "--tone-2": "#8DB37E", "--tone-3": "#2F6B3A" } }
```

- `theme.css` overrides the look key by key; `theme.pools` replaces the look's pools; `theme.fonts`
  and `theme.fontFaces` add to the look's. `theme.enter` replaces the look's entrance. Fields you
  write in `captions` override the look's caption defaults (`style`, `case`, `size`).
- A brand font: self-host it in the project (`theme.fontFaces`) and name it in `--serif` or `--sans`.
- After changing colours, check contrast: ink on `--base` ≥ 4.5:1, `--cta-ink` on `--accent` ≥ 4.5:1
  (≥ 3:1 is the floor at the CTA's 40 px), caption ink on `--caption-bg` ≥ 4.5:1. `validate.mjs`
  fails chip, label, CTA and marquee text under 3:1: a new `--accent` usually needs its `--cta-ink`
  (the light looks use white, `bold-streetwear`, `tech-neon` and `ugc-native` dark ink).
- **Switching a project to a look:** keep only the brand colours in `theme.css`. A full theme written
  before (its `--surface`, `--ink`, `--band`…) fights the look; the contrast check catches the worst of
  it (e.g. `tech-neon`'s light UI ink on an old white surface).

## Writing scenes that work in every look
- **Fills use the theme, not hex codes.** Every look defines three tones of its palette, soft to
  strong: `var(--tone-1)`, `var(--tone-2)`, `var(--tone-3)` (in the dark looks the soft tone is
  dark). Use them for cards and bands, `var(--band)` for a neutral card, and gradients between them
  (`linear-gradient(180deg, var(--tone-1) 0%, var(--tone-3) 100%)`). A hard-coded pastel looks wrong
  in the dark looks. `examples/look-sampler/` uses only these.
- **`serif` is the look's display face, `sans` its text face,** whatever their design (in
  `bold-streetwear`, `serif` is Anton). Only `classic`, `luxe-editorial` and `warm-organic` have real
  italics; elsewhere `ital` slants the letters, so avoid it there.
- **Width differs by look.** Bricolage Grotesque (`pop-playful`) and Space Grotesk run wider than
  Bodoni or Anton. The layout gate fails a line that leaves the safe zone; move to a smaller class
  (`h0` → `h1` → `sub`) or shorten the line.
- **`pop` overshoots about 6 %:** keep `pop` text and chips ~50 px inside the safe zone.
- **Over footage** (`ugc-native`): text carries a shadow (`--text-shadow`); still add a scrim layer
  behind long text on busy footage.
- **Packshots on white in the dark looks** (`bold-streetwear`, `tech-neon`, `ugc-native`):
  `"blend": "multiply"` darkens the whole photo against a dark band. Put a light `fill` layer
  (`var(--ink)` is near-white there) under the packshot inside its shape, or use a cut-out PNG
  with transparency and no blend.
- **Layout pieces follow the look** (`layouts.md`, "Per look" lists the layouts each look reads best
  with): `bold-streetwear` panels are square with a white border, `pop-playful` ones round with a hard
  shadow, `ugc-native` ones white-bordered like stickers.

## Entrances (`theme.enter`)
All are computed from `t` like everything else. The layout gate checks every frame, entrances
included: `pop` overshoots and `rise` chips move 36 px while they enter.

| Value | Texts | Chips | Labels, odometers, CTA text |
|---|---|---|---|
| `blur` | Blur, fade and rise 20 px | Blur and slide from the shape side | Blur and fade |
| `rise` | Glyphs slide up out of a mask | Fade and rise 36 px | Fade |
| `cut` | On and off on frame boundaries; `slam` still scales | On and off | On and off |
| `pop` | Scale from 50 % with overshoot | Scale from 60 % with overshoot | Fade |
| `wipe` | Revealed left to right | Revealed from the anchored side | Fade |
| `type` | Typed on, one character per 45 ms | Revealed from the anchored side | Fade |

## Look variables
Besides the variables in `scenes-format.md`, a look (or your `theme.css`) can set:

| Variable | Default | Controls |
|---|---|---|
| `--tone-1`, `--tone-2`, `--tone-3` | `classic` pinks | Three palette tones, soft → strong, for fill layers |
| `--display-weight` | `400` | Weight of the `serif` (display) class |
| `--text-weight` | `normal` | Weight of `sans` text blocks |
| `--head-case` | `none` | `text-transform` of `h0`, `h1`, `sub`, `wordmark` |
| `--head-tracking` | `0em` | Added to their letter-spacing |
| `--head-leading` | `1` | Multiplies their line-height |
| `--caps-tracking`, `--caps-weight` | `0.2em`, `600` | The `caps` class |
| `--text-shadow` | `none` | Shadow behind every text block |
| `--acc-glow` | `none` | Glow on accent words and odometers |
| `--ui-font`, `--ui-ink`, `--ui-weight`, `--ui-case`, `--ui-tracking` | `--sans`, `--ink`, `600`, `none`, per element | Chips, labels, CTA text |
| `--ui-round` | `1` | Corner radius of chips, labels and the CTA, 0 (square) to 1 (pill) |
| `--ui-border` | `none` | Border of chips, labels and the CTA |
| `--chip-shadow`, `--cta-shadow` | soft drop shadows | Their full `box-shadow` |
| `--cta-ink` | `#fff` | CTA text colour |
| `--caption-font`, `--caption-weight`, `--caption-radius`, `--caption-stroke` | `--sans`, `800`, `0.42em`, black 85 % | Captions |
| `--panel-round` … `--mask-stroke` | per element | Panels, phone, callouts, check lists, marquees, masks (`layouts.md`) |
| `--price-bg`, `--price-ink`, `--price-badge-bg` | `--surface`, `--ui-ink`, `--accent` | Price sticker (`prices`) and its badge |
| `--backdrop-dim` | `0.62` | Brightness of the blurred backdrop behind a `fit: "contain"` picture |
