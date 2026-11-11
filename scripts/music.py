"""Music bed: uses scenes.json music.file when it exists, otherwise generates it from music.prompt
with ElevenLabs Music (instrumental). Check the licence terms of your plan before paid placements.

usage: python3 music.py <project> [--force]
"""
import sys

from lib.common import project, scenes, eleven

P = project(sys.argv)
m = scenes(P).get("music") or {}
if not m.get("file"):
    if m.get("prompt"):
        sys.exit("music.prompt needs music.file: the path the generated track is written to")
    print(f"no music.file: no bed, beat grid from music.bpm ({m.get('bpm', 120)} BPM)")
    sys.exit(0)
out = P / m["file"]
if out.exists() and "--force" not in sys.argv:
    print(f"using {out.relative_to(P)}")
    sys.exit(0)
if not m.get("prompt"):
    sys.exit(f"{m['file']} does not exist and music.prompt is empty: add a licensed track or a prompt")
raw, ctype = eleven(P, "/v1/music?output_format=mp3_44100_128",
                    {"prompt": m["prompt"], "music_length_ms": m.get("length_ms", int(scenes(P)["duration"] * 1000) + 1000),
                     "force_instrumental": True}, timeout=600)
if "audio" not in ctype:
    sys.exit(f"unexpected response {ctype}: {raw[:300]!r}")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(raw)
print(f"generated {out.relative_to(P)} ({len(raw) / 1e6:.1f} MB)")
