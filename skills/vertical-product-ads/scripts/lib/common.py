"""Shared helpers for the Python tools: project paths, scenes, .env lookup, ffmpeg PCM I/O, ElevenLabs POST."""
import json, os, pathlib, subprocess, sys, time, urllib.error, urllib.request

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


def api_key(p, name="ELEVENLABS_API_KEY", required=True):
    """Environment first, then the nearest .env walking up from the project. None when absent and not required.
    The value is never printed: error messages name the variable, not its content."""
    if os.environ.get(name):
        return os.environ[name]
    for d in [p, *p.parents]:
        env = d / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                line = line.strip()
                if line.startswith("export "):
                    line = line[7:].lstrip()
                if line.startswith(name + "="):
                    value = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if value:   # an empty line (a fresh copy of .env.example) is "not set": keep looking
                        return value
    if not required:
        return None
    sys.exit(f"{name} not set. Run scripts/set_key.sh in your own terminal (never paste the key into a chat), "
             f"or set it in the environment")


def fetch(req, timeout=300, tries=4):
    """urlopen with retries on 429 (system_busy, rate limit) and 5xx: waits 2, 4, 8 s. Other HTTP errors raise."""
    for k in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(), r.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            if (e.code == 429 or e.code >= 500) and k < tries - 1:
                print(f"  ElevenLabs {e.code}, retrying in {2 ** (k + 1)} s", file=sys.stderr)
                time.sleep(2 ** (k + 1))
                continue
            raise


def eleven(p, path, body, timeout=300):
    req = urllib.request.Request("https://api.elevenlabs.io" + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": api_key(p), "Content-Type": "application/json"})
    try:
        return fetch(req, timeout)
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
