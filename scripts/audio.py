"""Synthesize every SFX cue, place each so its own envelope peak lands on the cue, duck the music under
the voice and mix. Works with any subset of {music, voice}: SFX alone is a valid film.

usage: python3 audio.py <project>
reads  audio/events.json (from events.mjs), audio/grid.json, music.file, audio/vo_placed.wav
writes audio/sfx.wav, audio/mix.wav (stereo 48 kHz float, peak 0.93; mastering happens in finish.sh)
"""
import json, sys

import numpy as np

from lib.common import project, scenes, load_pcm, save_wav

P = project(sys.argv)
S = scenes(P)
A = P / "audio"
SR = 48000
rng = np.random.default_rng(20261111)   # fixed seed: the mix is reproducible

ev = json.loads((A / "events.json").read_text())
grid = json.loads((A / "grid.json").read_text())
cfg = {"duckSpeechDb": -15, "duckGapDb": -8, "sfxGain": 0.8, "fadeOut": 0.6, "musicDb": -20, **S.get("audio", {})}
FILM = ev["film"]
N = int(round(FILM * SR))
TONIC = 440 * 2 ** ((grid.get("tonic_pc", 0) - 9) / 12) * 2   # tonic in octave 5


def fit(x, n):
    out = np.zeros((n,) + x.shape[1:])
    out[:min(n, len(x))] = x[:n]
    return out


t_ = lambda d: np.arange(int(d * SR)) / SR
env_exp = lambda d, k: np.exp(-t_(d) * k)


def onepole_lp(x, fc):
    a = np.broadcast_to(np.exp(-2 * np.pi * np.asarray(fc) / SR), x.shape)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def bandnoise(d, lo, hi):
    n = rng.standard_normal(int(d * SR))
    return onepole_lp(n, hi) - onepole_lp(n, lo)


def bell(f, d, partials=((1, 1.0, 3.2), (2.76, 0.42, 6.5), (5.4, 0.2, 10), (8.9, 0.08, 15))):
    t = t_(d)
    return sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * k) for m, a, k in partials) * (1 - np.exp(-t * 900))


def synth(c):
    k = c["kind"]
    if k == "tap":
        f = c.get("f", 1400)
        return np.sin(2 * np.pi * f * t_(0.05)) * env_exp(0.05, 90) + 0.4 * bandnoise(0.05, 1500, 6000) * env_exp(0.05, 160)
    if k == "click":
        a = bandnoise(0.03, 1800, 7000) * env_exp(0.03, 220) + 0.6 * np.sin(2 * np.pi * 1900 * t_(0.03)) * env_exp(0.03, 150)
        out = np.zeros(int(0.12 * SR)); out[:len(a)] += a; out[int(0.07 * SR):int(0.07 * SR) + len(a)] += 0.45 * a
        return out
    if k == "tick":
        return np.sin(2 * np.pi * c.get("f", 2400) * t_(0.012)) * env_exp(0.012, 420)
    if k == "pop":
        f = c.get("f", 900); t = t_(0.12)
        ph = 2 * np.pi * np.cumsum(f * (0.62 + 0.38 * np.exp(-t * 40))) / SR
        return np.sin(ph) * np.exp(-t * 34) * (1 - np.exp(-t * 2500))
    if k == "glass":
        return bell(TONIC * 2 ** (c["note"] / 12), 0.9)
    if k == "pluck":
        f = TONIC * 2 ** (c["note"] / 12) / 2
        p = int(SR / f); buf = rng.uniform(-1, 1, p); out = np.zeros(int(0.8 * SR))
        for i in range(len(out)):
            out[i] = buf[i % p]
            buf[i % p] = 0.996 * 0.5 * (buf[i % p] + buf[(i + 1) % p])
        return out * (1 - np.exp(-t_(0.8) * 3000))
    if k == "chime":
        return sum(bell(TONIC * 2 ** (n / 12), 1.6) * (0.85 ** j) for j, n in enumerate(c["notes"]))
    if k == "sub":
        d = c.get("dur", 1.4); t = t_(d)
        ph = 2 * np.pi * np.cumsum(43.65 + 30 * np.exp(-t * 9)) / SR
        return np.sin(ph) * np.exp(-t * 2.4) * (1 - np.exp(-t * 400))
    if k in ("swish", "whoosh"):
        d = c.get("dur", 0.6); t = t_(d); x = t / d
        e = np.sin(np.pi * x ** 1.6) ** 2 if (c.get("rev") or c.get("up")) else np.sin(np.pi * x) ** 2
        hi = (2600 if c.get("soft") else 5200) * (0.35 + 0.65 * (x if c.get("up") else 1 - 0.5 * x))
        lo = 300 if k == "whoosh" else 900
        n = rng.standard_normal(len(t))
        return (onepole_lp(n, hi) - onepole_lp(n, np.full(len(t), lo))) * e
    if k == "shimmer":
        d = c.get("dur", 1.2); t = t_(d)
        base = TONIC * (4 if c.get("bright") else 2)
        y = np.zeros(len(t))
        for n in (0, 4, 7, 12, 16, 19, 24):
            f = base * 2 ** (n / 12) * (1 + rng.uniform(-0.002, 0.002))
            y += np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(5, 11) * t))
        return y * (1 - np.exp(-t * 18)) * np.exp(-t * 2.6) / 4
    sys.exit(f"unknown SFX kind {k!r} (tap click tick pop glass pluck chime sub swish whoosh shimmer)")


# ── SFX bus: unit-peak sounds placed so their own envelope peak lands on the cue ──────────────────
sfx = np.zeros(N)
worst = 0.0
for c in ev["cues"]:
    s = synth(c)
    s = s / (np.abs(s).max() + 1e-12)
    w = int(0.004 * SR)
    pk = int(np.argmax(np.convolve(np.abs(s), np.ones(w) / w, "same")))
    start = int(round(c["t"] * SR)) - pk
    a, b = max(0, start), min(N, start + len(s))
    if b > a:
        sfx[a:b] += c["gain"] * s[a - start:b - start]
    worst = max(worst, abs((start + pk) / SR - c["t"]))

# ── music bed and voice ───────────────────────────────────────────────────────────────────────────
m = S.get("music") or {}
has_music = bool(m.get("file")) and (P / m["file"]).exists()
has_vo = (A / "vo_placed.wav").exists() and bool(S.get("vo"))
music = fit(load_pcm(P / m["file"], SR, 2), N) if has_music else np.zeros((N, 2))
music *= np.clip((FILM - np.arange(N) / SR) / cfg["fadeOut"], 0, 1)[:, None]
vo = fit(load_pcm(A / "vo_placed.wav", SR), N) if has_vo else np.zeros(N)

rms = lambda x: np.sqrt(np.mean(x ** 2))
if has_vo:
    win = int(0.03 * SR)
    speech = (np.sqrt(np.convolve(vo ** 2, np.ones(win) / win, "same")) > 0.02).astype(float)
    duck = np.zeros(N); acc = 0.0
    att, rel = np.exp(-1 / (0.04 * SR)), np.exp(-1 / (0.35 * SR))
    for i in range(N):
        k = att if speech[i] > acc else rel
        acc = k * acc + (1 - k) * speech[i]
        duck[i] = acc
    ref = rms(vo[speech > 0])
    level = ref / (rms(music.mean(1)[N // 3:]) + 1e-12) if has_music else 0
    g_speech, g_gap = level * 10 ** (cfg["duckSpeechDb"] / 20), level * 10 ** (cfg["duckGapDb"] / 20)
    mgain = g_gap + (g_speech - g_gap) * duck
    sfx_gain = cfg["sfxGain"] * np.abs(vo).max()
else:
    mgain = np.full(N, 10 ** (cfg["musicDb"] / 20) / (rms(music.mean(1)) + 1e-12) if has_music else 0)
    sfx_gain = cfg["sfxGain"] * 0.5

mix = music * mgain[:, None] + vo[:, None] + (sfx * sfx_gain)[:, None]
peak = np.abs(mix).max()
if peak < 1e-6:
    sys.exit("the mix is silent: no music, no voice and no cues")
mix *= 0.93 / peak
save_wav(A / "sfx.wav", np.stack([sfx * sfx_gain / peak * 0.93] * 2, 1), SR)
save_wav(A / "mix.wav", mix, SR)
print(f"{len(ev['cues'])} cues, worst peak placement {worst * 1000:.2f} ms · music {'yes' if has_music else 'no'} · "
      f"voice {'yes' if has_vo else 'no'} · mix peak normalised to 0.93")
