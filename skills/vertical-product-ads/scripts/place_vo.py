"""Lay each VO sentence on the film timeline so its anchor word lands on the moment it owns.

Segments are cut halfway into the measured silences (12 ms fades) and re-laid with their internal timing
untouched, so every word time stays exact: new = old + shift.

usage: python3 place_vo.py <project>
reads  scenes.json vo.place, audio/vo.mp3, audio/vo_words.json
writes audio/vo_placed.wav, audio/words.json (what "w<i>" resolves to)
"""
import json, subprocess, sys

import numpy as np

from lib.common import project, scenes, load_pcm

P = project(sys.argv)
S = scenes(P)
place = (S.get("vo") or {}).get("place")
if not place:
    sys.exit("scenes.json vo.place is empty: list sentence segments {words:[first,last], anchor, at}")
W = json.loads((P / "audio/vo_words.json").read_text())["words"]
SR, FILM = 44100, S["duration"]
x = load_pcm(P / "audio/vo.mp3", SR)
out = np.zeros(int(FILM * SR))
fade = int(0.012 * SR)
placed, prev_end, problems = [], -1.0, []

for seg in place:
    a, b = seg["words"]
    anc, at = seg["anchor"], seg["at"]
    if not (a <= anc <= b < len(W)):
        sys.exit(f"segment {seg}: anchor must sit inside words[{a}, {b}] and below {len(W)}")
    shift = at - W[anc]["start"]
    lo = W[a]["start"] - (min(0.12, (W[a]["start"] - W[a - 1]["end"]) / 2) if a > 0 else W[a]["start"])
    hi = W[b]["end"] + (min(0.18, (W[b + 1]["start"] - W[b]["end"]) / 2) if b + 1 < len(W) else 0.25)
    piece = x[int(lo * SR):int(hi * SR)].copy()
    piece[:fade] *= np.linspace(0, 1, fade)
    piece[-fade:] *= np.linspace(1, 0, fade)
    s0 = int(round((lo + shift) * SR))
    if s0 < 0 or s0 + len(piece) > len(out):
        sys.exit(f"segment {a}-{b} lands outside the film (start {lo + shift:.2f}s)")
    out[s0:s0 + len(piece)] += piece
    start, end = W[a]["start"] + shift, W[b]["end"] + shift
    gap = start - prev_end
    if a > 0 and gap <= 0.2:
        need = 0.21 - gap
        problems.append(f"segment {a}-{b} starts {gap:.2f}s after the previous one ends (needs > 0.2s breath): "
                        f"raise this segment's 'at' by ≥{need:.2f}s, or lower the previous segment's 'at' by as much")
    print(f"{a:2d}-{b:2d}  {start:6.2f}-{end:6.2f}  gap {gap:5.2f}  shift {shift:+.2f}  {seg.get('why', '')}")
    prev_end = end
    placed += [{"i": w["i"], "w": w["w"], "start": round(w["start"] + shift, 3), "end": round(w["end"] + shift, 3)}
               for w in W[a:b + 1]]

if placed[-1]["end"] > FILM - 0.5:
    problems.append(f"last word ends {placed[-1]['end']:.2f}s: leave ≥0.5s of tail in a {FILM}s film")
if problems:
    sys.exit("\n".join(problems))
pcm16 = (np.clip(out, -1, 1) * 32767).astype("<i2").tobytes()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                str(P / "audio/vo_placed.wav")], input=pcm16, check=True)
(P / "audio/words.json").write_text(json.dumps(placed, ensure_ascii=False, indent=1))
print(f"peak {20 * np.log10(np.abs(out).max()):.1f} dBFS · last word ends {placed[-1]['end']:.2f}s of {FILM}s")
