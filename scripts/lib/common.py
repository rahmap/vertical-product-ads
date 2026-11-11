"""Shared helpers for the Python tools: project paths, scenes, .env lookup, ffmpeg PCM I/O, ElevenLabs POST."""
import json, os, pathlib, subprocess, sys, urllib.error, urllib.request

import numpy as np


def project(argv):
    if len(argv) < 2:
        sys.exit(f"usage: {pathlib.Path(argv[0]).name} <project-dir> [--force]")
    p = pathlib.Path(argv[1]).resolve()
    if not (p / "scenes.json").exists():
        sys.exit(f"no scenes.json in {p}")
    (p / "audio").mkdir(exist_ok=True)
    return p


def scenes(p):
    return json.loads((p / "scenes.json").read_text())


def api_key(p, name="ELEVENLABS_API_KEY"):
    """Environment first, then the nearest .env walking up from the project."""
    if os.environ.get(name):
        return os.environ[name]
    for d in [p, *p.parents]:
        env = d / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                if line.strip().startswith(name + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{name} not set (environment or a .env in the project or a parent folder)")


def eleven(p, path, body, timeout=300):
    req = urllib.request.Request("https://api.elevenlabs.io" + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": api_key(p), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs {e.code}: {e.read().decode()[:400]}")


def load_pcm(path, sr, ch=1):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", str(ch), "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    return x.reshape(-1, ch) if ch > 1 else x


def save_wav(path, x, sr, codec="pcm_f32le"):
    ch = 1 if x.ndim == 1 else x.shape[1]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", str(ch), "-i", "-",
                    "-c:a", codec, str(path)], input=x.astype("<f4").tobytes(), check=True)
