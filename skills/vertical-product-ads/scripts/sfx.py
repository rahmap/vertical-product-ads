"""Sound-effect samples for `sample` cues: generated with ElevenLabs Sound Effects, or your own files.

usage: python3 sfx.py <project> [--force]
scenes.json sfx: name → {file, prompt, dur, influence}. With `prompt`, the sample is generated into `file` when it is
missing or when prompt/dur/influence changed (recipes kept in audio/sfx_recipes.json); --force regenerates all.
Without `prompt`, `file` must already exist (a sound you hold a licence for). Check your plan's terms before paid placements.
"""
import json, sys

from lib.common import project, scenes, eleven

P = project(sys.argv)
fx = scenes(P).get("sfx") or {}
book_file = P / "audio" / "sfx_recipes.json"
book = json.loads(book_file.read_text()) if book_file.exists() else {}
force = "--force" in sys.argv
made = 0
for name, x in fx.items():
    out = P / x["file"]
    if not x.get("prompt"):
        if not out.exists():
            sys.exit(f"sfx.{name}: {x['file']} does not exist and there is no prompt")
        continue
    recipe = {k: x.get(k) for k in ("file", "prompt", "dur", "influence")}
    if out.exists() and book.get(name) == recipe and not force:
        continue
    body = {"text": x["prompt"], "prompt_influence": x.get("influence", 0.5)}
    if x.get("dur") is not None:
        body["duration_seconds"] = x["dur"]
    raw, ctype = eleven(P, "/v1/sound-generation?output_format=mp3_44100_128", body, timeout=120)
    if "audio" not in ctype:
        sys.exit(f"sfx.{name}: unexpected response {ctype}: {raw[:300]!r}")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(raw)
    book[name] = recipe
    made += 1
    print(f"generated sfx.{name} → {x['file']} ({len(raw) / 1e3:.0f} kB)")
book_file.parent.mkdir(parents=True, exist_ok=True)
book_file.write_text(json.dumps(book, indent=1))
print(f"{len(fx)} sfx samples, {made} generated, {len(fx) - made} cached")
