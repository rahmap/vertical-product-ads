"""Procedural instrumental bed (numpy only): kick/clap/hats/bass/pad/pluck on a bar grid, sidechain-style pumping,
a filter opening at the drop, a short reverb for width. Deterministic per seed. Used by music.py (music.synth)."""
import math

import numpy as np

SR = 44100
MAJOR, MINOR = [0, 4, 7], [0, 3, 7]
NAMES = "C C# D D# E F F# G G# A A# B".split()
FLATS = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"}
# (semitones from tonic, triad) per bar; the 4-bar loop I–V–vi–IV, minor keys use the diatonic i–VI–III–VII
PROG = {"major": [(0, MAJOR), (7, MAJOR), (9, MINOR), (5, MAJOR)],
        "minor": [(0, MINOR), (8, MAJOR), (3, MAJOR), (10, MAJOR)]}
STYLES = {
    # kick/clap/snare/hat/pluck gains, pad low-pass (Hz) in groove, pump depth, pluck steps per 8th and decay (s),
    # swing (fraction of a 8th), reverb wet, pluck timbre
    "pop":     dict(kick=1.0, clap=0.55, snare=0.25, hat=0.20, pluck=0.26, pad_lp=2400, duck=0.55, steps=[1] * 8,
                    decay=0.14, swing=0.0, wet=0.22, bell=False, add9=False),
    "minimal": dict(kick=0.9, clap=0.0, snare=0.38, hat=0.12, pluck=0.22, pad_lp=1600, duck=0.40, steps=[1, 0, 0, 1, 0, 1, 0, 0],
                    decay=0.18, swing=0.0, wet=0.25, bell=False, add9=False),
    "chill":   dict(kick=0.80, clap=0.0, snare=0.42, hat=0.13, pluck=0.24, pad_lp=1500, duck=0.35, steps=[1, 0, 1, 0, 1, 1, 0, 1],
                    decay=0.30, swing=0.18, wet=0.34, bell=True, add9=True),
}


def lowpass(x, fc, order=2):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    h = 1 / (1 + (f / fc) ** (2 * order))
    return np.fft.irfft(np.fft.rfft(x, axis=0) * (h[:, None] if x.ndim > 1 else h), len(x), axis=0)


def highpass(x, fc, order=2):
    return x - lowpass(x, fc, order)


def bandpass(x, lo, hi):
    return lowpass(highpass(x, lo), hi)


def decay_env(n, tau, attack=0.003):
    t = np.arange(n) / SR
    return np.minimum(t / attack, 1) * np.exp(-t / tau)


def partials(f, n, amps, phase=0.0):
    """Sum of harmonics below 8 kHz with the given amplitudes (index 0 = fundamental)."""
    t = np.arange(n) / SR
    y = np.zeros(n)
    for h, a in enumerate(amps, 1):
        if f * h < 8000:
            y += a * np.sin(2 * math.pi * f * h * t + phase * h)
    return y


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def kick():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 46 + 80 * np.exp(-t / 0.022)          # 126 Hz → 46 Hz sweep: the 40–120 Hz body the beat tracker keys on
    y = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    y += 0.25 * np.sin(2 * math.pi * 55 * t) * np.exp(-t / 0.28)
    y *= np.minimum(t / 0.002, 1)
    return np.tanh(1.6 * y) / math.tanh(1.6)


def render(bpm, key, style, duration, drop=None, end=None, seed=1):
    st = STYLES[style]
    rng = np.random.default_rng(seed)
    parts = key.split()
    name = FLATS.get(parts[0][0].upper() + parts[0][1:], parts[0][0].upper() + parts[0][1:])
    if name not in NAMES:
        raise ValueError(f"music.key {key!r}: tonic must be one of {' '.join(NAMES)} (or a flat like Bb)")
    tonic = NAMES.index(name)
    mode = "minor" if len(parts) > 1 and parts[1].lower().startswith("min") else "major"
    per = 60 / bpm
    bar = 4 * per
    end = duration if end is None else end
    total = max(duration, end)
    n = int(round(total * SR))
    last = math.floor((end - 0.75 * bar) / bar) * bar          # bar line where the final chord starts
    drop = math.ceil(0.2 * duration / bar - 1e-9) * bar if drop is None else drop
    if last < drop + 3 * bar:
        raise ValueError(f"too short for the form: drop {drop:.1f}s, final chord {last:.1f}s at {bpm} BPM "
                         f"(needs ≥ 3 bars of groove between them; lower drop or lengthen end/duration)")
    thin = last - 2 * bar
    root_midi = 36 + tonic - (12 if tonic >= 7 else 0)         # bass root around 65–98 Hz

    def step(e):                                                # time of 8th note e in a bar, offbeats pushed by swing
        return (e * 0.5 + (st["swing"] * 0.5 if e % 2 else 0)) * per

    def put(buf_lr, sig, t, pan=0.0, g=1.0):
        i = int(round(t * SR))
        if i >= n or i < 0:
            return
        m = min(len(sig), n - i)
        a = (pan + 1) * math.pi / 4
        buf_lr[0][i:i + m] += sig[:m] * math.cos(a) * g
        buf_lr[1][i:i + m] += sig[:m] * math.sin(a) * g

    drums, bass, pad, pluck, fx = ([np.zeros(n), np.zeros(n)] for _ in range(5))
    kicks = []
    K = kick()
    noise = lambda d: rng.standard_normal(int(d * SR))
    chat = highpass(noise(0.05), 7000) * decay_env(int(0.05 * SR), 0.012, 0.001)
    ohat = highpass(noise(0.30), 6500) * decay_env(int(0.30 * SR), 0.09, 0.001)
    crash = highpass(noise(1.6), 5000) * decay_env(int(1.6 * SR), 0.45, 0.001)
    clap = np.zeros(int(0.25 * SR))
    for off in (0, 0.011, 0.023):
        b = noise(0.25)[:len(clap) - int(off * SR)]
        clap[int(off * SR):] += b * decay_env(len(b), 0.008, 0.001)
    clap += noise(0.25) * decay_env(len(clap), 0.07, 0.01) * 0.6
    clap = bandpass(clap, 900, 3800)
    clap /= np.abs(clap).max()
    sn = bandpass(noise(0.2), 1200, 7000) * decay_env(int(0.2 * SR), 0.06, 0.001) + \
        0.7 * np.sin(2 * math.pi * 190 * np.arange(int(0.2 * SR)) / SR) * decay_env(int(0.2 * SR), 0.05, 0.001)
    sn /= np.abs(sn).max()

    prog = PROG[mode]
    nbars = int(math.ceil(total / bar))
    for b in range(nbars):
        t0 = b * bar
        if t0 >= last + bar:
            break
        sem, tri = prog[b % 4]
        iv = tri + ([14] if st["add9"] else [])
        r = root_midi + sem
        chord = []
        for x in iv:                                            # close voicing inside midi 55–70
            m = 36 + tonic + sem + x
            while m < 55:
                m += 12
            while m > 70:
                m -= 12
            chord.append(m)
        chord.sort()
        section = "intro" if t0 + bar <= drop + 1e-6 else "final" if t0 >= last - 1e-6 else "thin" if t0 >= thin - 1e-6 else "groove"

        # pad: whole bar (final chord: rings to `end`), long release so chords overlap
        length = (end - t0) if section == "final" else bar + 0.35
        nn = int(length * SR)
        env = np.minimum(np.arange(nn) / SR / 0.25, 1) * np.exp(-np.arange(nn) / SR / (max(length, 1) / 3 if section == "final" else 6))
        if section == "final":
            env *= np.clip((end - t0 - np.arange(nn) / SR) / 0.35, 0, 1)
        else:
            env *= np.clip((length - np.arange(nn) / SR) / 0.35, 0, 1)
        for m in chord:
            ph = rng.uniform(0, 6.28)
            f = mtof(m)
            lo = partials(f * 0.997, nn, [1, .5, .33, .25, .2, .16, .14, .12], ph)
            hi = partials(f * 1.003, nn, [1, .5, .33, .25, .2, .16, .14, .12], ph + 1.3)
            i = int(round(t0 * SR))
            m_ = min(nn, n - i)
            pad[0][i:i + m_] += (lo + 0.5 * hi)[:m_] * env[:m_] / len(chord)
            pad[1][i:i + m_] += (hi + 0.5 * lo)[:m_] * env[:m_] / len(chord)

        if section == "final":
            put(drums, K, t0, g=0.8 * st["kick"])
            put(fx, crash, t0, 0.2, 0.25)
            kicks.append(t0)
            nb = int(min(end - t0, 2.2 * bar) * SR)
            f0 = mtof(r)
            y = np.tanh(1.8 * (partials(f0, nb, [1, .3, .12]) * decay_env(nb, 1.2, 0.01))) * 0.5
            put(bass, y, t0)
            for k, m in enumerate(chord + [chord[0] + 12]):
                nb = int(1.6 * SR)
                f = mtof(m + 12)
                y = partials(f, nb, [1, .35, .12, .05]) * decay_env(nb, 0.5, 0.002)
                put(pluck, y, t0 + 0.02 * k, -0.4 + 0.25 * k, st["pluck"])
            continue

        # drums
        if section == "intro":
            for e in range(1, 8, 2):
                put(drums, chat, t0 + step(e), 0.25, 0.5 * st["hat"])
            if b == int(round(drop / bar)) - 1:                  # riser into the drop
                nr = int(bar * SR)
                ramp = np.linspace(0, 1, nr) ** 2.5
                put(fx, bandpass(noise(bar), 600, 6000)[:nr] * ramp, t0, 0.0, 0.18)
        else:
            beats = (0, 1, 2, 3) if section == "groove" else (0, 2)
            for beat in beats:
                put(drums, K, t0 + beat * per, 0, st["kick"] * (1 if beat in (0, 2) else 0.85))
                kicks.append(t0 + beat * per)
            backbeat = (1, 3) if section == "groove" else (3,)
            for beat in backbeat:
                if st["clap"]:
                    put(drums, clap, t0 + beat * per, 0.05, st["clap"])
                put(drums, sn, t0 + beat * per, -0.05, st["snare"])
            for e in range(8):
                tt = t0 + step(e)
                if section == "thin" and e % 2 == 0:
                    continue
                vel = 1.0 if e % 2 else 0.55
                if e == 7 and section == "groove" and b % 2 == 1:
                    put(drums, ohat, tt, 0.3, 0.7 * st["hat"])
                else:
                    put(drums, chat, tt, (-0.25, 0.25)[e % 2], vel * st["hat"])
            if abs(t0 - drop) < 1e-6:
                put(fx, crash, t0, 0.0, 0.3)

            # bass: root pattern, ducked by the kicks later
            f0 = mtof(r)
            pattern = [(0, 1.5, 0), (2, 1.0, 0), (3.5, 0.5, 12)] if section == "groove" else [(0, 2, 0), (2, 2, 0)]
            for beat, ln, up in pattern:
                nb = int(ln * per * SR)
                f = f0 * 2 ** (up / 12)
                y = partials(f, nb, [1, .28, .14]) * decay_env(nb, 0.5, 0.006)
                y *= np.clip((nb - np.arange(nb)) / (0.02 * SR), 0, 1)
                put(bass, np.tanh(1.8 * y) * 0.55, t0 + beat * per)

            # pluck arpeggio on 8ths (not in thin bars except every other note)
            order = [0, 1, 2, 3, 2, 1, 2, 3] if len(chord) > 3 else [0, 1, 2, 1, 0, 1, 2, 1]
            for e in range(8):
                if not st["steps"][e] or (section == "thin" and e % 2):
                    continue
                m = chord[order[e] % len(chord)] + 12
                nb = int(1.2 * SR)
                f = mtof(m)
                if st["bell"]:                                  # electric-piano-ish: the 2nd partial dies faster
                    y = (partials(f, nb, [1]) + 0.3 * partials(2 * f, nb, [1]) * decay_env(nb, 0.1, 0.001)) \
                        * decay_env(nb, st["decay"], 0.002)
                else:
                    y = partials(f, nb, [1, 0, .11, 0, .04]) * decay_env(nb, st["decay"], 0.002)
                    y += 0.3 * partials(f, nb, [1, .5, .33, .25]) * decay_env(nb, st["decay"] * 0.3, 0.001)
                put(pluck, y, t0 + step(e), (-0.5, 0.5)[(e // 2) % 2], st["pluck"] * (1 if e % 2 == 0 else 0.7))

    # sidechain-style pumping on the harmonic layers
    duck = np.ones(n)
    m_ = int(0.5 * SR)
    for tk in kicks:
        i = int(round(tk * SR))
        d = np.arange(min(m_, n - i)) / SR
        duck[i:i + len(d)] *= 1 - st["duck"] * np.exp(-d / (0.16 * per * 2)) * np.minimum(d / 0.002, 1)

    # filter opens at the drop: dark pad in the intro, brighter in the groove, crossfaded over one beat
    pad_dark = [lowpass(c, 650) for c in pad]
    pad_open = [lowpass(c, st["pad_lp"]) for c in pad]
    xf = np.clip((np.arange(n) / SR - drop) / per + 0.5, 0, 1)
    pad = [pad_dark[c] * (1 - xf) * 0.55 + pad_open[c] * xf for c in (0, 1)]
    ducked = [pad[c] * duck for c in (0, 1)]
    bass_d = [lowpass(bass[c], 400) * duck for c in (0, 1)]
    pl = [lowpass(pluck[c], 5000) for c in (0, 1)]
    # ping-pong delay (dotted eighth) on the plucks
    dl = int(0.75 * per * SR)
    echo = [np.zeros(n), np.zeros(n)]
    src = (pl[0] + pl[1]) * 0.5
    for k, g in enumerate((0.38, 0.2, 0.1), 1):
        s = np.zeros(n)
        s[k * dl:] = src[:n - k * dl] * g
        echo[k % 2] += s
    pl = [(pl[c] + echo[c]) * duck ** 0.5 for c in (0, 1)]

    # short stereo reverb (decorrelated noise tails) on pad + pluck
    nir = int(1.4 * SR)
    wet = []
    nfft = 1 << (n + nir).bit_length()
    for c in (0, 1):
        ir = lowpass(rng.standard_normal(nir) * np.exp(-np.arange(nir) / SR / 0.32), 4500)
        ir /= np.sqrt(np.sum(ir ** 2))
        bus = ducked[c] + pl[c]
        wet.append(np.fft.irfft(np.fft.rfft(bus, nfft) * np.fft.rfft(ir, nfft), nfft)[:n])

    mix = [drums[c] * 0.9 + bass_d[c] * 0.9 + ducked[c] * 0.34 + pl[c] + wet[c] * st["wet"] + fx[c] for c in (0, 1)]
    x = np.stack(mix, 1)
    # level: groove RMS to about −17 dBFS (≈ −16 LUFS for this material), soft clip
    g0, g1 = int(drop * SR), int(max(last, drop + bar) * SR)
    x *= 10 ** (-17 / 20) / np.sqrt(np.mean(x[g0:g1] ** 2))
    x = np.tanh(x * 1.15) / 1.15
    fade = np.clip((end - np.arange(n) / SR) / 0.05, 0, 1)
    return x * fade[:, None], {"drop": drop, "last_bar": last, "end": end, "bpm": bpm, "key": f"{NAMES[tonic]} {mode}"}
