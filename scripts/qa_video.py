"""QA of a delivered MP4: 1-per-second storyboard, the largest frame-to-frame jumps, and a seam check at every
render chunk boundary (a crashed or mis-ordered chunk shows as a spike that its neighbours don't have).

usage: python3 qa_video.py <project> <video.mp4>
writes <video>_storyboard.png; exit 1 when a chunk seam spikes.
"""
import json, pathlib, subprocess, sys

import numpy as np

from lib.common import project

P = project(sys.argv)
if len(sys.argv) < 3:
    sys.exit("usage: qa_video.py <project> <video.mp4>")
video = pathlib.Path(sys.argv[2]).resolve()
probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height,r_frame_rate,pix_fmt,color_space",
                                   "-show_entries", "format=duration", "-of", "json", str(video)], capture_output=True, check=True).stdout)
v = next(s for s in probe["streams"] if s.get("width"))
num, den = map(int, v["r_frame_rate"].split("/"))
fps = num / den
print(f"{v['codec_name']} {v['width']}x{v['height']} {fps:g} fps {v.get('pix_fmt')} {v.get('color_space')} · "
      f"{float(probe['format']['duration']):.2f} s · audio {'yes' if len(probe['streams']) > 1 else 'NO'}")

sheet = video.with_name(video.stem + "_storyboard.png")
tw, th = v["width"] // 5, v["height"] // 5
dur = float(probe["format"]["duration"])
cols = 8
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf",
                f"fps=1,scale={tw}:{th},tile={cols}x{int(np.ceil(dur / cols))}:padding=4:color=black", "-frames:v", "1", str(sheet)], check=True)
print(f"storyboard: {sheet}")

w, h = 135, 240
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
                     capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))   # d[i]: change from frame i to i+1
print("largest frame-to-frame changes (mean |Δluma|):")
for i in np.argsort(d)[::-1][:8]:
    print(f"  t={(i + 1) / fps:6.2f}s  Δ {d[i]:5.2f}")

meta_file = P / "renders/render.json"
bad = []
if meta_file.exists():
    meta = json.loads(meta_file.read_text())
    step = round(meta["chunkSeconds"] * fps)
    for b in range(step, len(fr), step):
        i = b - 1                                      # change across the boundary
        around = np.concatenate([d[max(0, i - 6):i], d[i + 1:i + 7]])
        ref = around.max() if len(around) else 0
        flag = d[i] > 2 and d[i] > 2.5 * max(ref, 0.2)
        print(f"chunk seam {b / fps:6.2f}s  Δ {d[i]:5.2f}  (neighbours ≤ {ref:5.2f}){'  ← SPIKE' if flag else ''}")
        if flag:
            bad.append(b / fps)
if bad:
    sys.exit(f"seam spike at {', '.join(f'{t:.2f}s' for t in bad)}: re-render that chunk")
print("seams OK")
