# Changelog

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
