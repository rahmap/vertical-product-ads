# Direction

You are the director. Make the creative calls, log each as `DECISION:`, and keep the film original.
The brand's own palette and type come first; never copy a template or a competitor's ad.

## Motion rules
1. **One shape, never cut.** Every scene is the same rounded shape. Moves available:
   - resize and re-round it: card ↔ circle;
   - split it into three bands (`gap`, `rin`) and merge them back;
   - let one band swallow the others (`b0`/`b1` → 0.0001);
   - open it full bleed (`"set": "full"`).

   Transitions are morphs, never hard cuts.
2. **Content swaps with a short blur.** Layers and words enter on a spring with blur and exit
   short and early (`tout` sits a few frames before the next scene's `tin`), so old and new never
   overlap.
3. **Springs, a tiny overshoot at most.** Use the named springs: `morph` for shape changes, `snap`
   for a hit, `settle`/`drift`/`slow` for Ken Burns, `lead`/`trail` for edges that should stretch.
   No bouncy easing.
4. **Something happens on every beat.** Fill holds with secondary motion: Ken Burns `zoom`,
   parallax `shift`, band `pops`, a `sheen` sweep. Never fill a hold with dead time.
5. **Every reveal is motivated.**
   - Words appear on the word that names them: `w<i>`.
   - Hits land on the measured kick: `k<n>`.
   - A gesture (touch dot press, drag wipe, swipe arc) lands on the verb.
6. **Readable holds.** Budget ≥ 0.35 s per word plus 0.3 s settle for any card you expect people
   to read. One idea per scene.

## Scene recipes (proven in the Dior Lip Glow film)
| Beat | Recipe | Fields |
|---|---|---|
| Hook, before/after | Card holds the "before"; a touch drags a wipe that reveals the "after"; labels pinned to the card corners | layer `wipe`, `touch.holds` with `wiper`, `labels` with `cross` times |
| Product reveal | Shape opens full bleed; packshot split into two `world` layers that drift apart (parallax); brand word slams on its word | `place`, `pivot`, `clipX`, `shift`, text `slam` |
| Music drop | Shape snaps into a circle on the drop while the camera punches in (`zoom` 1.05 → 1) | timeline `sp: "snap"`, `zoom` |
| How to use | Close-up of application; a swipe `arc` draws over the lips on the verb | `arcs` |
| Comparison / variants | Split into three bands, each popping on consecutive beats with its own image | `gap`/`rin`, per-band layers, `pops`, `toutBand` |
| Result | Bands merge; slow push through the break; a `sheen` sweeps when the groove returns | `sheen` layer |
| Ingredients | Full-bleed texture; ingredient chips slide in on their words | `chips` + `icons` |
| Claim number | Shape closes to a circle; an odometer rolls to the number while it is spoken; footnote under it | `odometers`, `foot` text |
| Choice | Bands slam in on 8ths; the touch taps the favourite, which swallows the others | `b0`/`b1` on `trail`/`lead` |
| End card | Hero packshot, brand slam, CTA pill grows from the centre (edges on different springs) and is pressed on the call to action | `cta` |
| Full-bleed end card with a square packshot | `cover` would crop a square photo to ~56 % of its width on a 9:16 frame. Instead: shape `"set": "full"`, a `fill` layer for the background, and the packshot as a `world` layer with `blend: multiply`, `place.size` ≈ 850 and `place.at` centring the product | `fill` + `world` layer |

## Sound design
- **SFX are synthesized and placed by their own peak** (`audio.py`). Each one punctuates a
  physical event:
  - `click`/`tap` for a press, `whoosh` for a shape move, `glass`/`pluck` for bands landing;
  - `sub` + `chime` under the brand reveal;
  - `shimmer` on a drop or the groove's return;
  - `tick`s come automatically from odometers.
- **One cue per event.** Nothing repeats more than a handful of times.
- **Leave near-silence before a hit:** end the previous motion early.
- **The voice is always the loudest layer.** The music ducks −15 dB under speech and −8 dB in the
  gaps.

## Look
- **Palette, type, shadows and pools come from `theme.css`.** Use the brand's colours. When the
  brand font isn't available, self-host an OFL font in the project: declare it in
  `theme.fontFaces` and name it in `--serif`/`--sans`.
- **Product photos on white:** use `"blend": "multiply"` so they sit on the shape. A background
  that isn't pure white shows as a grey box, so normalise it to 255 first:
  1. Measure a corner pixel:
     `ffmpeg -v error -i in.png -vf crop=40:40:10:10,scale=1:1 -f rawvideo -pix_fmt rgb24 - | od -An -tu1`.
  2. Divide each channel by 255 and use that as `rimax`/`gimax`/`bimax`. For a corner of
     240, 240, 243:
     `ffmpeg -i in.png -vf colorlevels=rimax=0.941:gimax=0.941:bimax=0.953 out.png`.
  3. Measure again: the corner should read 255, 255, 255.
- **Crop baked-in text out of every image.** Upscale small crops 4× so a 1080 px wide band never
  shows blur: Real-ESRGAN ncnn when it is installed, otherwise
  `ffmpeg -vf scale=iw*4:ih*4:flags=lanczos`.

## Truth
- **Product claims come only from the brief or official material.** Every claim on screen carries
  its footnote (test basis, sample size).
- **Report which numbers are real and which are invented,** and which images show real people or
  third-party marks that need permission.
