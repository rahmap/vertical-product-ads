# Voice-over and beat sync

The voice carries the argument; the music carries the energy. Both are measured, never estimated.

## Script length
- **Measure your voice's rate, don't assume it.** `vo.py` prints words per second. One measured
  case: ElevenLabs "Aita" (Indonesian, `eleven_multilingual_v2`, speed 1.1) ran 1.93 words/s
  (59 words in 30.6 s).
- **For a 30 s film, target the duration minus ~3 s of breaths and tail.** At 1.9 words/s that is
  ~52–56 words.
- **If `vo.py` warns that speech leaves no tail, cut words.** Don't push speed above ~1.15: it
  starts to sound rushed.
- **Spell out numbers and symbols the way they are spoken in the language** ("empat puluh delapan",
  "pe-ha" for pH). Show the digits on screen instead.
- **Sales tone:** a question hook, the product name early, one benefit per sentence, the call to
  action last ("Dapatkan sekarang!").

## A voice that sounds like a person (affiliate, ugc-style narration)
The default settings read like an announcer. For a first-person recommendation:
- **Pick the voice for the register, not the gender alone.** In `voices.py --lang id` prefer voices
  described as conversational, casual or social media over narration, news or audiobook.
- **Settings** (`vo.settings`, ElevenLabs): `stability` 0.30–0.40 (lower = more variation between
  sentences), `similarity_boost` 0.75, `style` 0.40–0.55, `use_speaker_boost` true, `speed` 1.05–1.12.
  Below 0.30 stability the delivery becomes erratic; regenerate (`--force`) for another take
  rather than lowering further.
- **Punctuation is the direction.** A comma is a short breath, a full stop a longer one, "…" a
  hesitation, a question mark lifts the pitch. Write "Jujur, awalnya aku ragu. Soalnya murah banget."
  not one long sentence. Avoid exclamation marks except on the hook.
- **Write for the mouth:** contractions ("nggak", "udah", "banget"), numbers and prices as words,
  brand names spelled the way they sound if the voice misreads them (keep the real spelling on
  screen with `captions.fix`).
- **Longer films:** the whole script is one request, so tone stays consistent across 60 s. Rate
  still varies by voice: measure it, then cut words. About 78 words for 45 s and 105 for 60 s at
  1.9 words/s.
- **Place by sentence.** One `vo.place` segment per sentence, with 0.25–0.45 s between them, so the
  pauses are a speaker's, not a reader's. A segment gap over 0.8 s needs a picture reason (a shot
  with its own sound, a sticker landing).
- Listen to `audio/vo.mp3` before placing. If you cannot hear audio, say so in the report.

## Placing sentences on the music (`vo.place`)
`place_vo.py` cuts the voice into segments in the measured silences and moves each so its `anchor`
word starts at `at`. Timing inside a segment is untouched, so words stay natural.
- **Cover every word, in order:** one segment per sentence or clause.
- **Anchor the word that should hit:** the brand name on the reveal beat, the benefit word on the
  drop, the call to action on the CTA press.
- **Leave > 0.2 s between segments** (enforced) and ≥ 0.5 s after the last word.
- **After placement, `w<i>` resolves to placed times.** Re-run `place_vo.py` whenever `place`
  changes. `make.sh` does it for you.

## Music
- **Choose a bed with an arc:** intro, a clear drop, a groove, a lift, and an ending, at about
  120 BPM. With ElevenLabs Music, describe sections by second, state the BPM, and add "No vocals"
  and "leaves room for a spoken voice-over".
- **`tempo.py` writes `grid.json`:** BPM, phase, the kick-peak lag and the key, plus a per-second
  loudness list. Read that list twice:
  - **The drop** is where loudness jumps 10+ dB. Put your big visual change there (`k<n>`).
  - **The ending:** generated tracks sometimes fade seconds earlier than the prompt asked. If the
    loudness falls away before your call to action, rerun `music.py --force` with a firmer prompt
    ("full level until second N, final chord at N+1"), then `tempo.py`.
- **Tonal SFX (`glass`, `pluck`, `chime`, `shimmer`) are pitched from the detected key,** so they
  sit in the song.
- **Licensing:** use a track you hold a licence for, or one generated on a plan whose terms cover
  the placement. Record which in the report.

## Mix
`audio.py` handles levels:
- the music sits −15 dB under the voice while she speaks, −8 dB in the gaps (40 ms attack, 350 ms
  release);
- SFX peaks sit ~10 dB under the voice peaks;
- clip sound (`footage.<name>.sound`) sits `gainDb` under the voice (default −12 dB) and drops a
  further 6 dB while she speaks;
- the mix peaks at 0.93.

`finish.sh` then masters to −14 LUFS integrated: it raises the mix by the missing gain into a
limiter at −1 dBFS and repeats until the master is within 0.2 LU of the target, so a dense mix with
loud SFX peaks still lands on target without hand-tuning. The gate measures the delivered AAC file
and accepts ±0.6 LU and a sample peak ≤ −0.5 dBFS, because AAC encoding can overshoot the limiter
slightly.

## ElevenLabs notes
- Busy (429 `system_busy`) and server (5xx) errors are retried 3 times (2, 4, 8 s) by every tool.
- **Choosing a voice:** `scripts/py scripts/voices.py <project> --lang id --gender female` lists the
  voices this key can use, with their ids. A voice labelled with your language sounds most native;
  `eleven_multilingual_v2` with `language` set speaks it either way.
- `mp3_44100_128` works on every plan; 192 kbps needs Creator or above (`vo.format`).
- `vo.py` caches: it skips the API when `audio/vo.mp3` matches the script and voice. Use `--force`
  to regenerate.
- Changing voice, model or speed changes every word time. Re-run `vo.py`, then check every `w<i>`
  reference in the scenes.

## Free voice-over: edge-tts (`vo.engine: "edge"`)
Install once: `scripts/check_setup.sh --with edge`.
```json
"vo": { "engine": "edge", "voice": "id-ID-GadisNeural", "language": "id",
        "settings": { "rate": "+10%", "pitch": "+0Hz", "volume": "+0%" }, "script": "…" }
```
- **Same flow as ElevenLabs:** `vo.py` writes `audio/vo.mp3` and `audio/vo_words.json` (the `engine`
  key records which), then `place_vo.py` and `w<i>` work unchanged.
- **Measure its rate too:** words per second differs per voice and `rate`. Measured once on the
  51-word Dior script (numbers spoken as words):

  | Voice | `rate` +0% | +10% | +20% |
  |---|---|---|---|
  | `id-ID-GadisNeural` (female) | 1.61 w/s | 1.77 w/s | 1.93 w/s |
  | `id-ID-ArdiNeural` (male) | 1.99 w/s | 2.19 w/s | 2.39 w/s |

  So a 30 s film with Gadis at +10% fits ~47–50 words; at +0% only ~43–45.
- **Licence caveat.** edge-tts is an unofficial client of Microsoft's Edge read-aloud service. The
  terms for using its output in paid ads are unclear. Use it for drafts, or accept the risk
  yourself, and write that choice in the report. For a campaign you must be sure about, use
  ElevenLabs on a plan whose terms cover it, or a recorded human voice (`dialogue`).
- It needs network access at generation time.

## Free music: local synth (`music.synth`)
```json
"music": { "file": "audio/bed.wav", "bpm": 110, "key": "A minor",
           "synth": { "style": "chill", "drop": 4.0, "end": 28.5, "seed": 7 } }
```
- `music.py` writes a procedural bed to `file`; it is generated on your machine, so it is fully
  yours to use. It is simpler than a produced track: check the loudness list from `tempo.py` for
  the drop and ending, change `seed` for another take.
- `style` `pop`, `minimal` or `chill`; `bpm` 90–140. `synth` and `prompt` cannot be combined.

## Dialogue: footage speech instead of `vo`
Used by `ugc` and `hybrid` (`styles.md`).
1. `footage.py` extracts frames. `transcribe.py` writes `audio/transcript_<name>.json` for every
   `speech: true` clip: `words: [{w, p, start, end}]` in clip seconds (`w` without punctuation, `p`
   trailing punctuation).
   - `dialogue.transcriber`: `elevenlabs` (needs a key), `whisper` (faster-whisper, offline,
     `whisperModel` default `small`; install with `scripts/check_setup.sh --with whisper`), or
     `auto` (ElevenLabs when a key exists, else whisper; a key without speech-to-text permission,
     401/403, also falls back to whisper). Set `language`.
2. **Proofread.** Speech recognition mishears brand names, numbers and non-standard Indonesian.
   Read the transcript against the script; map wrong words with `captions.fix`
   (`{"lembab": "lembap"}`).
3. **Choose segments.** Cut in the gap between words: `in` just before a word's `start`, `out` just
   after a word's `end`. A cut inside a word fails the gate (`render-and-qa.md`).
4. `place_dialogue.py` joins the segments at their `at` times into `audio/vo_placed.wav` and writes
   `audio/words.json` in film seconds; from there `w<i>`, `we<i>`, captions and `audio.py` behave as
   with `vo`.
- Footage music is not allowed (it plays under the speech): ask for clean audio (see the
  ad-concept `intake.md`).
- Only `speech: true` clips contribute speech; b-roll is muted unless its `footage` entry sets
  `sound: {gainDb}` (the clip's own audio under the voice, e.g. an unboxing; `styles.md`, Affiliate).
