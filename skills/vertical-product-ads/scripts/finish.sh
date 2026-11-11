#!/usr/bin/env bash
# finish.sh <project> <out.mp4> — master the AUDIO, mux it onto the already-final picture, verify, QA.
#
#   1. gain + alimiter (level=disabled: no makeup gain) on audio/mix.wav, iterated until the master is within
#      0.2 LU of the target. loudnorm's linear mode can't add gain once the true peak would pass -1 dBTP, and the
#      limiter then costs loudness: a dense mix missed the target by 0.8 LU. Iterating the gain absorbs both.
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

lufs() { ffmpeg -hide_banner -i "$1" -af ebur128=framelog=quiet -f null - 2>&1 | awk '/^ +I:/ {print $2}' | tail -1; }
M_I=$(lufs "$MIX")
echo "── loudness · the mix reads I ${M_I} LUFS; gain + limiter on the audio only"
GAIN=$(node -e 'console.log((process.argv[1] - process.argv[2]).toFixed(2))' -- "$TARGET" "$M_I")
for pass in 1 2 3 4 5; do
  ffmpeg -hide_banner -v error -y -i "$MIX" -af "volume=${GAIN}dB,alimiter=limit=0.891:level=disabled:attack=5:release=50" \
    -ar 48000 -c:a pcm_f32le "$MASTER"
  GOT=$(lufs "$MASTER")
  echo "   pass ${pass}: gain ${GAIN} dB → I ${GOT} LUFS"
  node -e 'process.exit(Math.abs(process.argv[1] - process.argv[2]) <= 0.2 ? 0 : 1)' -- "$GOT" "$TARGET" && break
  GAIN=$(node -e 'console.log((+process.argv[1] + (process.argv[2] - process.argv[3])).toFixed(2))' -- "$GAIN" "$TARGET" "$GOT")
done

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
