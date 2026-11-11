#!/usr/bin/env bash
# finish.sh <project> <out.mp4> — master the AUDIO, mux it onto the already-final picture, verify, QA.
#
#   1. two-pass loudnorm on audio/mix.wav (linear) + alimiter with level=disabled (no makeup gain)
#   2. mux with -c:v copy: the video was encoded once, at final quality, by render.mjs
#   3. measure the delivered file (never trust the filter graph's own report) and gate on it
#   4. storyboard + seam scan (qa_video.py)
#
# Target: scenes.audio.lufs or -14 LUFS integrated, true peak ≤ -1 dBTP (what social platforms normalise to).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
P="$(cd "${1:?usage: finish.sh <project> <out.mp4>}" && pwd)"
OUT="${2:?usage: finish.sh <project> <out.mp4>}"
mkdir -p "$(dirname "$OUT")"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
VIDEO="$P/renders/video_noaudio.mp4"; MIX="$P/audio/mix.wav"; MASTER="$P/audio/master.wav"
[[ -f "$VIDEO" ]] || { echo "missing $VIDEO (run render.mjs)" >&2; exit 1; }
[[ -f "$MIX" ]] || { echo "missing $MIX (run audio.py)" >&2; exit 1; }
TARGET="$(node -e 'const s=require(process.argv[1]);process.stdout.write(String((s.audio&&s.audio.lufs)||-14))' "$P/scenes.json")"

echo "── loudness pass 1 · measuring the mix"
MEASURE=$(ffmpeg -hide_banner -i "$MIX" -af "loudnorm=I=${TARGET}:TP=-1.0:LRA=7:print_format=json" -f null - 2>&1 || true)
read -r M_I M_TP M_LRA M_THRESH <<EOF
$(printf '%s' "$MEASURE" | node -e '
let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
  const m = s.match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
  if (!m) { console.error("could not parse loudnorm output"); process.exit(1); }
  const j = JSON.parse(m[0]);
  process.stdout.write([j.input_i, j.input_tp, j.input_lra, j.input_thresh].join(" "));
});')
EOF
echo "   I ${M_I} LUFS · TP ${M_TP} dBTP · LRA ${M_LRA}"

AF="loudnorm=I=${TARGET}:TP=-1.0:LRA=7:linear=true:measured_I=${M_I}:measured_TP=${M_TP}:measured_LRA=${M_LRA}:measured_thresh=${M_THRESH}"
AF="${AF},alimiter=limit=0.891:level=disabled:attack=5:release=50"
echo "── loudness pass 2 · correcting + limiting the audio only"
ffmpeg -hide_banner -v error -y -i "$MIX" -af "$AF" -ar 48000 -c:a pcm_f32le "$MASTER"

echo "── mux · picture copied, not re-encoded"
ffmpeg -hide_banner -v error -y -i "$VIDEO" -i "$MASTER" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k \
  -movflags +faststart -shortest "$OUT"

echo "── verify · the delivered file"
READ=$(ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true:framelog=quiet -f null - 2>&1)
I=$(printf '%s' "$READ" | awk '/^ +I:/ {print $2}' | tail -1)
PK=$(printf '%s' "$READ" | awk '/^ +Peak:/ {print $2}' | tail -1)
echo "   I ${I} LUFS (target ${TARGET}) · peak ${PK} dBFS · $(du -h "$OUT" | cut -f1)"
node -e 'const [i,p,t]=process.argv.slice(1).map(Number); if (Math.abs(i-t)>0.6||p>-0.5){console.error(`LOUDNESS FAIL: I ${i} (target ${t}±0.6), peak ${p} (must be ≤ -0.5)`);process.exit(1)}' -- "$I" "$PK" "$TARGET"

echo "── QA · storyboard and chunk seams"
"$HERE/py" "$HERE/qa_video.py" "$P" "$OUT"
echo "── delivered: $OUT"
