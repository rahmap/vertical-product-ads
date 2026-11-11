"""Voice-over from scenes.json "vo": ElevenLabs (default; word timings from the character alignment) or
edge-tts (vo.engine "edge": free, word boundaries from the service).

usage: python3 vo.py <project> [--force]
writes audio/vo.mp3, audio/vo_words.json; prints every word with its index (the "w<i>" in scenes.json).
Skips the API call when audio/vo.mp3 already matches the script (re-run with --force to regenerate).
"""
import asyncio, base64, json, re, sys

from lib.common import project, scenes, eleven

P = project(sys.argv)
S = scenes(P)
vo = S.get("vo")
if not vo:
    sys.exit("scenes.json has no \"vo\" block (a music-only film needs no voice-over)")
engine = vo.get("engine", "elevenlabs")
if engine not in ("elevenlabs", "edge"):
    sys.exit(f'vo.engine must be "elevenlabs" or "edge", got {engine!r}')
out_mp3, out_words = P / "audio/vo.mp3", P / "audio/vo_words.json"

if out_mp3.exists() and out_words.exists() and "--force" not in sys.argv:
    meta = json.loads(out_words.read_text())
    # files written before "engine"/"settings" existed count as elevenlabs / matching
    if (meta.get("engine", "elevenlabs") == engine and meta.get("script") == vo["script"] and meta.get("voice") == vo["voice"]
            and meta.get("settings", vo.get("settings", {})) == vo.get("settings", {})):
        words = meta["words"]
        print(f"cached: {len(words)} words, ends {words[-1]['end']:.2f}s (use --force to regenerate)")
        for w in words:
            print(f'{w["i"]:3d} {w["start"]:6.2f} {w["end"]:6.2f} {w["w"]}')
        sys.exit(0)


def eleven_words():
    """ElevenLabs TTS with character alignment → mp3 on disk + [{w, start, end}]."""
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
    return words, body["model_id"]


def edge_words():
    """edge-tts stream → mp3 on disk + [{w, start, end}]; offsets/durations are 100 ns ticks."""
    try:
        import edge_tts
    except ImportError:
        sys.exit('vo.engine "edge" needs the edge-tts package: run scripts/check_setup.sh --with edge')
    st = vo.get("settings", {})
    kw = {k: st[k] for k in ("rate", "pitch", "volume") if k in st}
    audio, words = bytearray(), []

    async def run():
        async for ch in edge_tts.Communicate(vo["script"], vo["voice"], boundary="WordBoundary", **kw).stream():
            if ch["type"] == "audio":
                audio.extend(ch["data"])
            elif ch["type"] == "WordBoundary":
                w = re.sub(r"[^\w\-']", "", ch["text"])
                if w:
                    words.append({"w": w, "start": ch["offset"] / 1e7, "end": (ch["offset"] + ch["duration"]) / 1e7})
    try:
        asyncio.run(run())
    except edge_tts.exceptions.NoAudioReceived:
        audio = b""
    if not audio or not words:
        sys.exit(f"edge-tts returned no audio for voice {vo['voice']}: list valid names with "
                 f"scripts/py scripts/voices.py <project> --engine edge --lang {vo['voice'][:2]}")
    out_mp3.write_bytes(bytes(audio))
    return words, "edge-tts"


words, model = (edge_words if engine == "edge" else eleven_words)()
for i, w in enumerate(words):
    w["i"] = i
    w["start"], w["end"] = round(w["start"], 3), round(w["end"], 3)

out_words.write_text(json.dumps({"engine": engine, "voice": vo["voice"], "model": model, "script": vo["script"],
                                 "settings": vo.get("settings", {}), "words": words}, ensure_ascii=False, indent=1))
span = words[-1]["end"]
print(f"{len(words)} words, speech ends {span:.2f}s, {len(words) / span:.2f} words/s")
for w in words:
    print(f'{w["i"]:3d} {w["start"]:6.2f} {w["end"]:6.2f} {w["w"]}')
if span > S["duration"] - 0.9:
    faster = 'raise settings.rate (e.g. "+15%")' if engine == "edge" else "raise settings.speed (≤ 1.15)"
    print(f"WARNING: speech ({span:.1f}s) leaves no tail hold in a {S['duration']}s film — cut words, "
          f"or {faster}; aim for ≈{int((S['duration'] - 2) * len(words) / span)} words")
