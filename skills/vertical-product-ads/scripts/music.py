"""Music bed: uses scenes.json music.file when it exists, otherwise generates it either locally (music.synth:
free procedural instrumental, lib/synth.py) or from music.prompt with ElevenLabs Music (instrumental).
Check the licence terms of your plan before paid placements. --force regenerates an existing file.

usage: python3 music.py <project> [--force]
"""
import json, sys

from lib.common import project, scenes, eleven

P = project(sys.argv)
m = scenes(P).get("music") or {}
if not m.get("file"):
    if m.get("prompt"):
        sys.exit("music.prompt needs music.file: the path the generated track is written to")
    print(f"no music.file: no bed, beat grid from music.bpm ({m.get('bpm', 120)} BPM)")
    sys.exit(0)
out = P / m["file"]
synth = m.get("synth")
# a synth bed is regenerated whenever its parameters change; the recipe is stored beside the bed
recipe_file = P / "audio" / "synth_recipe.json"
recipe = None if synth is None else {"bpm": m.get("bpm", 120), "key": m.get("key", "C major"), "duration": scenes(P)["duration"],
                                     "file": m["file"], **synth}
stale = recipe is not None and (not recipe_file.exists() or json.loads(recipe_file.read_text()) != recipe)
if out.exists() and not stale and "--force" not in sys.argv:
    print(f"using {out.relative_to(P)}")
    sys.exit(0)
if synth is not None:
    from lib.common import save_wav
    from lib.synth import render, SR
    try:
        x, info = render(recipe["bpm"], recipe["key"], synth.get("style", "pop"), recipe["duration"],
                         synth.get("drop"), synth.get("end"), synth.get("seed", 1))
    except ValueError as e:
        sys.exit(str(e))
    out.parent.mkdir(parents=True, exist_ok=True)
    save_wav(out, x, SR, "libmp3lame" if out.suffix.lower() == ".mp3" else "pcm_s16le")
    recipe_file.write_text(json.dumps(recipe, indent=1))
    print(f"synthesised {out.relative_to(P)}: {info['bpm']} BPM {info['key']}, {synth.get('style', 'pop')}, drop {info['drop']:.2f}s, "
          f"final chord {info['last_bar']:.2f}s (rings out to end), ends {info['end']:.2f}s")
    sys.exit(0)
if not m.get("prompt"):
    sys.exit(f"{m['file']} does not exist and there is no music.prompt or music.synth: add a licensed track, a prompt or a synth block")
raw, ctype = eleven(P, "/v1/music?output_format=mp3_44100_128",
                    {"prompt": m["prompt"], "music_length_ms": m.get("length_ms", int(scenes(P)["duration"] * 1000) + 1000),
                     "force_instrumental": True}, timeout=600)
if "audio" not in ctype:
    sys.exit(f"unexpected response {ctype}: {raw[:300]!r}")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(raw)
print(f"generated {out.relative_to(P)} ({len(raw) / 1e6:.1f} MB)")
