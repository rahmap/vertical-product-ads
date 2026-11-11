# Vertical safe zones (1080×1920)

```
y    0 ┌──────────────────────────┐
       │ status bar, tabs, search │  top band (IG/TikTok chrome)
y  250 ├──┬────────────────────┬──┤
       │  │                    │  │
       │  │     SAFE ZONE      │  │  x 84–930: the right 150 px carry
       │  │  all text and UI   │  │  TikTok's like/comment/share rail
       │  │                    │  │
y 1460 ├──┴────────────────────┴──┤
       │ caption, handle, music,  │  bottom band (caption + CTA overlay)
y 1920 └──────────────────────────┘
       x 0   84             930  1080
```

- **The zone `x 84–930, y 250–1460` works for IG Reels and TikTok together.** YouTube Shorts is
  less strict, so the same zone covers it.
- **Text, numbers, chips, labels, captions, the CTA and footnotes stay inside.** `qa_safe.mjs`
  checks every output frame and fails the build on any visible element outside it.
- **Photography may bleed full frame.** Keep the subject's face, lips or product inside the zone.

## Layout that works
| Element | Where |
|---|---|
| Headline / spoken words | `y` 270–330 (`h0`, `h1`, `wordmark`) |
| Second line, product name | `y` ≈ 460–480 (`sub`) |
| Shape card | centre `y` ≈ 1000–1080, height ≤ 1000 so it clears the headline |
| Chips | inside x 100–920, on the side the eye travels from |
| CTA pill | `y` ≈ 1345 (h 104), half-width ≤ 300 |
| Footnote / claim basis | `y` ≈ 1404 (`foot`, one line; words rise 20 px as they enter, so 1414 can break the bottom edge for a frame; long notes wrap and fail the gate) |

## Text sizes
- **Body text below 36 px** (`caps`) is hard to read on a phone. Use `foot` (23 px) only for legal
  and claim notes.
- **One headline per scene,** at most 3 lines of `h1`. Long sentences belong in the voice, not on
  screen.
- **Default text box:** 780 px wide (x 150–930). Widen it only if the zone allows.
