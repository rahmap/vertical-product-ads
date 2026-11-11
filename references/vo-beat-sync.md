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
- the mix peaks at 0.93.

`finish.sh` then masters to −14 LUFS integrated, with the limiter set to −1 dBTP. The gate measures
the delivered AAC file and accepts ±0.6 LU and a sample peak ≤ −0.5 dBFS, because AAC encoding can
overshoot the limiter slightly.

## ElevenLabs notes
- **Choosing a voice:** `scripts/py scripts/voices.py <project> --lang id --gender female` lists the
  voices this key can use, with their ids. A voice labelled with your language sounds most native;
  `eleven_multilingual_v2` with `language` set speaks it either way.
- `mp3_44100_128` works on every plan; 192 kbps needs Creator or above (`vo.format`).
- `vo.py` caches: it skips the API when `audio/vo.mp3` matches the script and voice. Use `--force`
  to regenerate.
- Changing voice, model or speed changes every word time. Re-run `vo.py`, then check every `w<i>`
  reference in the scenes.
