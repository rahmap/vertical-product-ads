"""Word-level transcript of every speech clip that dialogue.segments uses.

usage: python3 transcribe.py <project> [--force] [--engine elevenlabs|whisper]
dialogue.transcriber "auto" (default): ElevenLabs Speech-to-Text when a key is found, else local faster-whisper.
writes audio/transcript_<name>.json {file,size,mtime,engine,model,language,words:[{w,p,start,end}]}, clip seconds.
Cached on clip size + mtime + engine + model + language. Transcripts are machine output: read the printed words,
and fix mis-heard spellings with captions.fix (place_dialogue.py keeps timings, not corrections).
"""
import io, json, re, subprocess, sys, tempfile, urllib.error, urllib.request, uuid

from lib.common import project, scenes, api_key, fetch

P = project(sys.argv)
S = scenes(P)
dlg = S.get("dialogue")
if not dlg:
    sys.exit('scenes.json has no "dialogue" block')
args = sys.argv[2:]
engine = args[args.index("--engine") + 1] if "--engine" in args else dlg.get("transcriber", "auto")
if engine not in ("auto", "elevenlabs", "whisper"):
    sys.exit("engine must be auto, elevenlabs or whisper")
auto = engine == "auto"
if auto:
    engine = "elevenlabs" if api_key(P, required=False) else "whisper"
    if engine == "whisper":
        print("no ELEVENLABS_API_KEY found: transcribing locally with faster-whisper")
lang = dlg.get("language")
model = "scribe_v1" if engine == "elevenlabs" else (dlg.get("whisperModel") or "small")
footage = S.get("footage") or {}
used = sorted({s["footage"] for s in dlg["segments"]})
for n in used:
    if n not in footage:
        sys.exit(f"dialogue segment uses footage {n!r}, which is not in scenes.json footage")
    if not footage[n].get("speech"):
        sys.exit(f"footage.{n} must have speech: true to be used in dialogue")


def words_from(items):
    """[(text, start, end)] → [{w, p, start, end}]: split edge punctuation off the word."""
    out = []
    for text, s, e in items:
        m = re.match(r"^\W*(.*?)(\W*)$", text.strip(), re.S)
        if m.group(1):
            out.append({"w": m.group(1), "p": m.group(2), "start": round(s, 3), "end": round(e, 3)})
    return out


def speech_wav(src, tmp):
    wav = f"{tmp}/speech.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", wav],
                   check=True)
    return wav


def run_elevenlabs(wav):
    b = uuid.uuid4().hex
    fields = {"model_id": model, "timestamps_granularity": "word"}
    if lang:
        fields["language_code"] = lang
    body = io.BytesIO()
    for k, v in fields.items():
        body.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    body.write(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="speech.wav"\r\n'
               f'Content-Type: audio/wav\r\n\r\n'.encode())
    body.write(open(wav, "rb").read())
    body.write(f"\r\n--{b}--\r\n".encode())
    req = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body.getvalue(), method="POST",
                                 headers={"xi-api-key": api_key(P), "Content-Type": f"multipart/form-data; boundary={b}"})
    try:
        res = json.loads(fetch(req, 600)[0])
    except urllib.error.HTTPError as e:
        msg = f"ElevenLabs {e.code}: {e.read().decode()[:400]}"
        if auto and e.code in (401, 403):   # key without speech-to-text permission: auto means "best available"
            print(f"{msg}\n  → transcriber auto: falling back to faster-whisper")
            return None
        sys.exit(msg)
    return words_from((w["text"], w["start"], w["end"]) for w in res["words"] if w.get("type") == "word"), \
        res.get("language_code") or lang


def run_whisper(wav):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper is not installed: run scripts/check_setup.sh --with whisper")
    print(f"  loading faster-whisper '{model}' (first use downloads the model)")
    segs, info = WhisperModel(model, device="cpu", compute_type="int8").transcribe(
        wav, language=lang, word_timestamps=True)
    return words_from((w.word, w.start, w.end) for s in segs for w in (s.words or [])), info.language


for name in used:
    src = P / footage[name]["file"]
    if not src.exists():
        sys.exit(f"footage.{name}: {footage[name]['file']} does not exist")
    st = src.stat()
    out = P / f"audio/transcript_{name}.json"
    if out.exists() and "--force" not in args:
        t = json.loads(out.read_text())
        same = (t["size"], t["mtime"], t.get("requested")) == (st.st_size, st.st_mtime, lang)
        if same and (auto or (t["engine"], t["model"]) == (engine, model)):   # auto takes whichever engine produced it
            print(f"{name}: cached ({t['engine']}, {len(t['words'])} words; --force to redo)")
            words = t["words"]
            for i, w in enumerate(words):
                print(f'{i:3d} {w["start"]:7.2f} {w["end"]:7.2f} {w["w"]}{w["p"]}')
            continue
    with tempfile.TemporaryDirectory() as tmp:
        wav = speech_wav(src, tmp)
        got = run_elevenlabs(wav) if engine == "elevenlabs" else None
        if got is None:
            if engine == "elevenlabs":
                engine, model = "whisper", dlg.get("whisperModel") or "small"
            got = run_whisper(wav)
        words, detected = got
    if not words:
        sys.exit(f"{name}: no words recognised (is the clip's audio speech?)")
    out.write_text(json.dumps({"file": footage[name]["file"], "size": st.st_size, "mtime": st.st_mtime, "engine": engine,
                               "model": model, "language": detected, "requested": lang, "words": words},
                              ensure_ascii=False, indent=1))
    print(f"{name}: {len(words)} words ({engine} {model}, language {detected}) → {out.relative_to(P)}")
    for i, w in enumerate(words):
        print(f'{i:3d} {w["start"]:7.2f} {w["end"]:7.2f} {w["w"]}{w["p"]}')

print("Proofread the words above: speech-to-text mishears names and spellings. "
      'Fix them for display with captions.fix {"heard": "intended"}; timings are kept.')
