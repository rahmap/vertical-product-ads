"""Voice-over from scenes.json "vo" via ElevenLabs, with per-word timings from the character alignment.

usage: python3 vo.py <project> [--force]
writes audio/vo.mp3, audio/vo_words.json; prints every word with its index (the "w<i>" in scenes.json).
Skips the API call when audio/vo.mp3 already matches the script (re-run with --force to regenerate).
"""
import base64, json, re, sys

from lib.common import project, scenes, eleven

P = project(sys.argv)
S = scenes(P)
vo = S.get("vo")
if not vo:
    sys.exit("scenes.json has no \"vo\" block (a music-only film needs no voice-over)")
out_mp3, out_words = P / "audio/vo.mp3", P / "audio/vo_words.json"

if out_mp3.exists() and out_words.exists() and "--force" not in sys.argv:
    meta = json.loads(out_words.read_text())
    if meta.get("script") == vo["script"] and meta.get("voice") == vo["voice"]:
        words = meta["words"]
        print(f"cached: {len(words)} words, ends {words[-1]['end']:.2f}s (use --force to regenerate)")
        for w in words:
            print(f'{w["i"]:3d} {w["start"]:6.2f} {w["end"]:6.2f} {w["w"]}')
        sys.exit(0)

body = {"text": vo["script"], "model_id": vo.get("model", "eleven_multilingual_v2"),
        "voice_settings": vo.get("settings", {})}
if vo.get("language"):
    body["language_code"] = vo["language"]
# 128 kbps works on every tier; 192 kbps needs Creator or above
fmt = vo.get("format", "mp3_44100_128")
raw, _ = eleven(P, f"/v1/text-to-speech/{vo['voice']}/with-timestamps?output_format={fmt}", body)
res = json.loads(raw)
out_mp3.write_bytes(base64.b64decode(res["audio_base64"]))
al = res.get("normalized_alignment") or res["alignment"]

words, cur = [], None
for c, s, e in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
    if re.match(r"[\w\-']", c):
        if cur is None:
            cur = {"w": "", "start": s, "end": e}
        cur["w"] += c
        cur["end"] = e
    elif cur is not None:
        words.append(cur)
        cur = None
if cur:
    words.append(cur)
for i, w in enumerate(words):
    w["i"] = i
    w["start"], w["end"] = round(w["start"], 3), round(w["end"], 3)

out_words.write_text(json.dumps({"voice": vo["voice"], "model": body["model_id"], "script": vo["script"],
                                 "words": words}, ensure_ascii=False, indent=1))
span = words[-1]["end"]
print(f"{len(words)} words, speech ends {span:.2f}s, {len(words) / span:.2f} words/s")
for w in words:
    print(f'{w["i"]:3d} {w["start"]:6.2f} {w["end"]:6.2f} {w["w"]}')
if span > S["duration"] - 0.9:
    print(f"WARNING: speech ({span:.1f}s) leaves no tail hold in a {S['duration']}s film — cut words, "
          f"or raise settings.speed; aim for ≈{int((S['duration'] - 2) * len(words) / span)} words")
