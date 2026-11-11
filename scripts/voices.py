"""List the ElevenLabs voices available to this API key, to pick vo.voice.

usage: scripts/py scripts/voices.py <project> [--lang id] [--gender female]
prints voice_id, name, gender, language, accent and use case; filters are optional.
"""
import json, sys, urllib.error, urllib.request

from lib.common import project, api_key

P = project(sys.argv)
args = sys.argv[2:]
want = {k: args[args.index(f"--{k}") + 1].lower() for k in ("lang", "gender") if f"--{k}" in args}
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
