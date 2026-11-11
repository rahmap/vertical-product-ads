"""List voices to pick vo.voice: ElevenLabs (this API key) or edge-tts (free, no key).

usage: scripts/py scripts/voices.py <project> [--engine edge|elevenlabs] [--lang id] [--gender female]
--engine defaults to elevenlabs when a key is found, otherwise edge. Filters are optional.
elevenlabs prints voice_id, name, gender, language, accent, use case; edge prints ShortName, gender, locale.
"""
import asyncio, json, sys, urllib.error, urllib.request

from lib.common import project, api_key

P = project(sys.argv)
args = sys.argv[2:]
want = {k: args[args.index(f"--{k}") + 1].lower() for k in ("lang", "gender", "engine") if f"--{k}" in args}
engine = want.get("engine") or ("elevenlabs" if api_key(P, required=False) else "edge")
if engine not in ("edge", "elevenlabs"):
    sys.exit("--engine must be edge or elevenlabs")
if "engine" not in want and engine == "edge":
    print("no ELEVENLABS_API_KEY found: listing free edge-tts voices (use them with vo.engine \"edge\")")

if engine == "edge":
    try:
        import edge_tts
    except ImportError:
        sys.exit("edge-tts is not installed: run scripts/check_setup.sh --with edge")
    rows = []
    for v in sorted(asyncio.run(edge_tts.list_voices()), key=lambda v: v["ShortName"]):
        if want.get("lang") and not v["Locale"].lower().startswith(want["lang"]):
            continue
        if want.get("gender") and v["Gender"].lower() != want["gender"]:
            continue
        print(f"{v['ShortName']:34} {v['Gender'].lower():7} {v['Locale']}")
        rows.append(v)
    print(f"{len(rows)} voice(s). Set vo.engine \"edge\" and vo.voice to a ShortName; vo.settings takes rate/pitch/volume like \"+10%\", \"+0Hz\".")
    sys.exit(0)

req = urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": api_key(P)})
try:
    voices = json.load(urllib.request.urlopen(req, timeout=60))["voices"]
except urllib.error.HTTPError as e:
    sys.exit(f"ElevenLabs {e.code}: {e.read().decode()[:300]}")
rows = []
for v in voices:
    lb = v.get("labels") or {}
    lang = (lb.get("language") or "").lower()
    gender = (lb.get("gender") or "").lower()
    if want.get("lang") and lang != want["lang"]:
        continue
    if want.get("gender") and gender != want["gender"]:
        continue
    rows.append((v["voice_id"], v["name"][:44], gender or "?", lang or "?", lb.get("accent", ""), lb.get("use_case", "")))
for r in rows:
    print(f"{r[0]}  {r[1]:44}  {r[2]:7} {r[3]:4} {r[4]:12} {r[5]}")
print(f"{len(rows)} voice(s). Multilingual models can speak any language; a voice labelled with your language sounds most native.")
