"""Beat grid of the music bed: tempo by autocorrelation of spectral flux, phase by a comb over kick-band
onsets, the measured kick-peak lag, and the key (Krumhansl profiles) so tonal SFX sit in key.

usage: python3 tempo.py <project>
writes audio/grid.json — "k<beat>" in scenes.json resolves to phase + beat·period + peak_offset.
Without a music file the grid comes from music.bpm (default 120) with phase 0.
"""
import json, sys

import numpy as np

from lib.common import project, scenes, load_pcm

P = project(sys.argv)
S = scenes(P)
m = S.get("music") or {}
out = P / "audio/grid.json"
names = "C C# D D# E F F# G G# A A# B".split()

if not m.get("file") or not (P / m["file"]).exists():
    bpm = m.get("bpm", 120)
    tonic = names.index(m.get("key", "C major").split()[0])
    grid = {"bpm": bpm, "period": 60 / bpm, "phase": 0.0, "peak_offset": 0.0, "key": m.get("key", "C major"),
            "tonic_pc": tonic, "mode": "major", "source": "music.bpm (no music file)"}
    out.write_text(json.dumps(grid, indent=1))
    print(f"no music file: grid from {bpm} BPM")
    sys.exit(0)

SR, HOP, N = 44100, 256, 2048
x = load_pcm(P / m["file"], SR)
frames = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * np.hanning(N)
Sx = np.abs(np.fft.rfft(frames, axis=1))
f = np.fft.rfftfreq(N, 1 / SR)
flux = np.concatenate([[0], np.maximum(np.diff(np.log1p(100 * Sx), axis=0), 0).sum(1)])
fps = SR / HOP
t = np.arange(len(flux)) / fps
kick = np.log1p(100 * Sx[:, (f > 35) & (f < 130)].sum(1))
kflux = np.concatenate([[0], np.maximum(np.diff(kick), 0)])

# tempo: autocorrelation of the onset envelope in 90–140 BPM, parabolic refinement
o = flux - flux.mean()
ac = np.correlate(o, o, "full")[len(o) - 1:]
lags = np.arange(len(ac))
bpm_l = 60 * fps / np.maximum(lags, 1)
win = (bpm_l >= 90) & (bpm_l <= 140)
lag = lags[win][np.argmax(ac[win])]
a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
period = (lag + 0.5 * (a - c) / (a - 2 * b + c)) / fps
bpm = 60 / period

# phase: comb over kick flux
phases = np.linspace(0, period, 200, endpoint=False)
score = []
for ph in phases:
    idx = np.round(np.arange(ph, t[-1], period) * fps).astype(int)
    score.append(kflux[idx[idx < len(kflux)]].sum())
phase = phases[int(np.argmax(score))]

# measured kick peaks within ±60 ms of each grid beat
peaks = []
for g in np.arange(phase, t[-1], period):
    lo, hi = int((g - 0.06) * fps), int((g + 0.06) * fps)
    if lo < 0 or hi >= len(kick):
        continue
    peaks.append(round((lo + int(np.argmax(kick[lo:hi]))) / fps, 4))
kp = np.array(peaks)
grid_t = phase + np.round((kp - phase) / period) * period
strong = np.array([kick[int(p * fps)] for p in kp]) > np.percentile(kick, 75)
peak_off = float(np.median((kp - grid_t)[strong]))

chroma = np.zeros(12)
band = (f > 60) & (f < 2000)
pc = np.mod(np.round(69 + 12 * np.log2(f[band] / 440)), 12).astype(int)
np.add.at(chroma, pc, Sx[:, band].sum(0))
maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
mnr = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_, tonic, mode = max((np.corrcoef(np.roll(pr, k), chroma)[0, 1], k, md) for k in range(12) for pr, md in ((maj, "major"), (mnr, "minor")))
if m.get("synth") is not None:   # the synth wrote it in music.key; detection can't tell a key from its relative major/minor
    k = m.get("key", "C major").split()
    tonic = names.index({"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"}.get(k[0], k[0]))
    mode = k[1] if len(k) > 1 else "major"

rms = [round(float(20 * np.log10(np.sqrt(np.mean(x[int(s * SR):int((s + 1) * SR)] ** 2)) + 1e-9)), 1)
       for s in range(int(len(x) / SR))]
grid = {"bpm": round(bpm, 3), "period": round(period, 5), "phase": round(phase, 4), "peak_offset": round(peak_off, 4),
        "key": f"{names[tonic]} {mode}", "tonic_pc": int(tonic), "mode": mode, "kick_peaks": peaks, "rms_db_per_s": rms}
out.write_text(json.dumps(grid, indent=1))
print(f"bpm {bpm:.2f} · period {period:.4f}s · phase {phase:.3f}s · kick peak +{peak_off * 1000:.0f} ms · key {grid['key']}")
print("loudness per second (dB):", rms)
print("Read sections from the loudness list: the drop is where it jumps by 10+ dB.")
