# Affiliate 60

A 59-second TikTok Shop affiliate video for a fictional product ("Klipo", a cable clip), built only
from pictures, a free voice (edge-tts) and the local synth bed, so it renders without footage or an
API key. It shows the affiliate recipes of `references/styles.md` and the length the pipeline handles.

| Time | Beat | What to look at |
|---|---|---|
| 0–7 s | Hook and problem | Sticker line, three crops of one picture, captions with `anim: "pop"` |
| 7–20 s | The find, size, material | A new picture on the word that names it (`tin: "w<i>-0.05"`, `cut: true`) |
| 20–34 s | How to, capacity, result | Claim chip with its footnote |
| 34–39 s | In the box, colours | Square seller photos shown whole: `fit: "contain"` |
| 39–45 s | Honest note | |
| 46–51 s | Price and promo | `prices` sticker, footnote with the end date |
| 52–59 s | CTA | "Keranjang kuning" pill, pressed on the last word |

```bash
cp -r examples/affiliate-60 /tmp/affiliate-60
scripts/check_setup.sh --with edge        # once: the free voice
scripts/make.sh /tmp/affiliate-60 preview
scripts/make.sh /tmp/affiliate-60 final /tmp/affiliate-60/out.mp4
```

For a real video, replace the SVG stand-ins with your own clips: list them in `footage`, change the
layers to `"kind": "video"` with `"clip": { "in": …, "at": … }`, set `"style": "hybrid"`, and give one
or two clips `"sound": { "gainDb": -12 }` where their own sound is the point. Word indices (`w<i>`)
come from `vo.py`: after changing the script or the voice, run it again and re-check every one.

The product, its price and its claims are invented for this example.
