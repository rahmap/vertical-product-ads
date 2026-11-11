"""Extract the frames of every scenes.json "footage" clip so the engine can seek them deterministically.

usage: python3 footage.py <project> [--force]
Each clip becomes build/footage/<name>/f00001.jpg … at render.fps (default 30, CFR via the fps filter), scaled to
*cover* the film format (both sides ≥ the frame, aspect kept; the engine crops with object-fit). Rotation metadata is
applied (ffmpeg autorotate). Writes build/footage.json. A clip is skipped while its size, mtime, fps and
format are unchanged and its frames are on disk.
"""
import json, pathlib, shutil, subprocess, sys

from lib.common import project, scenes

P = project(sys.argv)
S = scenes(P)
clips = S.get("footage")
if not clips:
    sys.exit('scenes.json has no "footage" block')
fps = (S.get("render") or {}).get("fps", 30)
fmt = S.get("format") or {}   # validate.mjs requires format; default to 9:16 so footage can be prepared before it is written
FW, FH = fmt.get("width", 1080), fmt.get("height", 1920)
out_json = P / "build/footage.json"
old = json.loads(out_json.read_text()) if out_json.exists() else {}
result = {}


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                        "-of", "json", str(path)], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"ffprobe cannot read {path}: {r.stderr.strip()[:300]}")
    info = json.loads(r.stdout)
    types = [s["codec_type"] for s in info["streams"]]
    if "video" not in types:
        sys.exit(f"{path} has no video stream")
    return float(info["format"]["duration"]), "audio" in types


def jpg_size(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    w, h = r.stdout.strip().split(",")
    return int(w), int(h)


for name, c in clips.items():
    src = P / c["file"]
    if not src.exists():
        sys.exit(f"footage.{name}: {c['file']} does not exist")
    st = src.stat()
    fdir = P / "build/footage" / name
    prev = old.get(name)
    if (prev and "--force" not in sys.argv and prev["file"] == c["file"] and prev["size"] == st.st_size
            and prev["mtime"] == st.st_mtime and prev["fps"] == fps and prev.get("cover") == [FW, FH]
            and len(list(fdir.glob("f*.jpg"))) == prev["frames"]):
        result[name] = prev
        print(f"{name}: cached, {prev['frames']} frames ({prev['width']}x{prev['height']}, {prev['duration']:.2f}s)")
        continue
    duration, has_audio = probe(src)
    shutil.rmtree(fdir, ignore_errors=True)
    fdir.mkdir(parents=True)
    # scale to cover: grow until both sides reach the film size; -2 keeps the other side even
    vf = f"fps={fps},scale='if(gt(a,{FW}/{FH}),-2,{FW})':'if(gt(a,{FW}/{FH}),{FH},-2)'"
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", vf, "-q:v", "2", "-an",
                        str(fdir / "f%05d.jpg")], capture_output=True, text=True)
    frames = len(list(fdir.glob("f*.jpg")))
    if r.returncode or not frames:
        sys.exit(f"footage.{name}: ffmpeg failed: {r.stderr.strip()[:400]}")
    w, h = jpg_size(fdir / "f00001.jpg")
    result[name] = {"dir": f"build/footage/{name}", "fps": fps, "frames": frames, "width": w, "height": h,
                    "duration": round(duration, 3), "file": c["file"], "size": st.st_size, "mtime": st.st_mtime,
                    "hasAudio": has_audio, "cover": [FW, FH]}
    print(f"{name}: {c['file']} {st.st_size / 1e6:.1f} MB, {duration:.2f}s → {frames} frames at {fps} fps ({w}x{h})")
    if c.get("speech") and not has_audio:
        print(f"  WARNING: footage.{name} is marked speech but has no audio track")

out_json.parent.mkdir(exist_ok=True)
out_json.write_text(json.dumps(result, indent=1))
