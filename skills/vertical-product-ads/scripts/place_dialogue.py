"""Cut the spoken pieces of creator footage and lay them on the film timeline.

Each dialogue segment {footage, in, out, at} takes the clip's audio from `in` to `out` (10 ms fades) and plays it from
film second `at`. Words of the transcript lying wholly inside [in, out] move with it: film time = at + (start − in).

usage: python3 place_dialogue.py <project>
reads  scenes.json dialogue, audio/transcript_<name>.json (transcribe.py)
writes audio/vo_placed.wav, audio/words.json (what "w<i>" and the captions resolve to)
"""
import json, subprocess, sys

import numpy as np

from lib.common import project, scenes, load_pcm

P = project(sys.argv)
S = scenes(P)
dlg = S.get("dialogue")
if not dlg or not dlg.get("segments"):
    sys.exit("scenes.json dialogue.segments is empty: list pieces {footage, in, out, at}")
SR, FILM, TOL = 44100, S["duration"], 0.03
FADE = int(0.010 * SR)
T, PCM = {}, {}
for n in {s["footage"] for s in dlg["segments"]}:
    f = P / f"audio/transcript_{n}.json"
    if not f.exists():
        sys.exit(f"{f.relative_to(P)} missing: run transcribe.py first")
    T[n] = json.loads(f.read_text())["words"]
    PCM[n] = load_pcm(P / S["footage"][n]["file"], SR)


def nearest_edge(words, t):
    return min((e for w in words for e in (w["start"], w["end"])), key=lambda e: abs(e - t))


errors = []
for k, seg in enumerate(dlg["segments"]):
    a, b, W = seg["in"], seg["out"], T[seg["footage"]]
    if b <= a:
        errors.append(f"segment {k}: out ({b}) must be greater than in ({a})")
        continue
    for w in W:
        if w["start"] + TOL < a < w["end"]:
            errors.append(f"segment {k}: in {a} cuts into the word '{w['w']}' ({w['start']:.2f}-{w['end']:.2f}); "
                          f"try in {nearest_edge(W, a):.2f}")
        if w["start"] < b < w["end"] - TOL:
            errors.append(f"segment {k}: out {b} cuts into the word '{w['w']}' ({w['start']:.2f}-{w['end']:.2f}); "
                          f"try out {nearest_edge(W, b):.2f}")
    if seg["at"] < 0 or seg["at"] + (b - a) > FILM:
        errors.append(f"segment {k}: film time {seg['at']:.2f}-{seg['at'] + b - a:.2f}s leaves the {FILM}s film")
order = sorted(range(len(dlg["segments"])), key=lambda k: dlg["segments"][k]["at"])
for p, q in zip(order, order[1:]):
    sp, sq = dlg["segments"][p], dlg["segments"][q]
    if sp["at"] + sp["out"] - sp["in"] > sq["at"]:
        errors.append(f"segments {p} and {q} overlap in film time ({sp['at']:.2f}-{sp['at'] + sp['out'] - sp['in']:.2f}s "
                      f"vs {sq['at']:.2f}s): move 'at' or shorten a piece")
if errors:
    sys.exit("\n".join(errors))

out = np.zeros(int(FILM * SR))
placed = []
for k in order:
    seg = dlg["segments"][k]
    a, b, at, W = seg["in"], seg["out"], seg["at"], T[seg["footage"]]
    piece = PCM[seg["footage"]][int(round(a * SR)):int(round(b * SR))].copy()
    if len(piece) < 2 * FADE:
        sys.exit(f"segment {k} is too short ({b - a:.3f}s)")
    piece[:FADE] *= np.linspace(0, 1, FADE)
    piece[-FADE:] *= np.linspace(1, 0, FADE)
    s0 = int(round(at * SR))
    n = min(len(piece), len(out) - s0)
    out[s0:s0 + n] += piece[:n]
    ws = [w for w in W if w["start"] >= a - TOL and w["end"] <= b + TOL]
    for w in ws:
        placed.append({"i": len(placed), "w": w["w"], **({"p": w["p"]} if w.get("p") else {}),
                       "start": round(max(at + w["start"] - a, at), 3), "end": round(at + w["end"] - a, 3)})
    first = len(placed) - len(ws)
    print(f"{k:2d}  {seg['footage']:10} clip {a:6.2f}-{b:6.2f} → film {at:6.2f}-{at + b - a:6.2f}  "
          f"words {first}-{len(placed) - 1 if ws else first}  {seg.get('why', '')}")

if not placed:
    sys.exit("no transcript word lies inside any segment: check in/out against the transcript")
peak = np.abs(out).max()
pcm16 = (np.clip(out, -1, 1) * 32767).astype("<i2").tobytes()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                str(P / "audio/vo_placed.wav")], input=pcm16, check=True)
(P / "audio/words.json").write_text(json.dumps(placed, ensure_ascii=False, indent=1))
print(f"{len(placed)} words · peak {20 * np.log10(max(peak, 1e-9)):.1f} dBFS · last word ends {placed[-1]['end']:.2f}s of {FILM}s")
