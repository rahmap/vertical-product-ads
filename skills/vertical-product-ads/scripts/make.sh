#!/usr/bin/env bash
# make.sh <project> preview          → validate, audio, cues, mix, safe-zone gate, beat contact sheet, draft MP4
# make.sh <project> final <out.mp4>  → the same gates, then the full render and the mastered delivery
#
# The two modes exist so a human or agent looks at snaps/sheet.png and renders/draft.mp4 between them.
# Every step is idempotent; API calls and model runs (vo.py, music.py, sfx.py, transcribe.py, footage.py) are skipped when their output is already current.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
P="$(cd "${1:?usage: make.sh <project> preview|final [out.mp4]}" && pwd)"
MODE="${2:?usage: make.sh <project> preview|final [out.mp4]}"

PYTHON="$("$HERE/py" --which)" || exit 1
export PYTHON
has() { node -e 'const s=require(process.argv[1]);process.exit(s[process.argv[2]]?0:1)' "$P/scenes.json" "$1"; }
step() { printf '\n── %s\n' "$1"; }
T0=$(date +%s)

step "validate";       node "$HERE/validate.mjs" "$P"
if has footage; then step "footage frames"; "$PYTHON" "$HERE/footage.py" "$P"; fi
if has music; then step "music";  "$PYTHON" "$HERE/music.py" "$P"; fi
if has sfx; then step "sound effects"; "$PYTHON" "$HERE/sfx.py" "$P"; fi
if has dialogue; then
  step "transcribe";   "$PYTHON" "$HERE/transcribe.py" "$P" | tail -3
  step "place dialogue"; "$PYTHON" "$HERE/place_dialogue.py" "$P"
elif has vo; then
  step "voice-over";   "$PYTHON" "$HERE/vo.py" "$P" | tail -3
  step "place voice";  "$PYTHON" "$HERE/place_vo.py" "$P"
fi
step "beat grid";      "$PYTHON" "$HERE/tempo.py" "$P" | head -1
step "cues";           node "$HERE/events.mjs" "$P"
step "mix";            "$PYTHON" "$HERE/audio.py" "$P"
step "layout gate";    node "$HERE/qa_safe.mjs" "$P"

case "$MODE" in
  preview)
    step "contact sheet (one frame per beat)"
    rm -rf "$P/snaps"; node "$HERE/snap.mjs" "$P" --beats --sheet 8 >/dev/null
    step "draft (half size, real speed, with sound)"
    node "$HERE/render.mjs" "$P" --draft | tail -1
    printf '\nPreview built in %ss. REVIEW NOW: %s/snaps/sheet.png and %s/renders/draft.mp4\n' "$(( $(date +%s) - T0 ))" "$P" "$P"
    ;;
  final)
    OUT="${3:?usage: make.sh <project> final <out.mp4>}"
    step "render";       node "$HERE/render.mjs" "$P" | tail -1
    step "finish";       "$HERE/finish.sh" "$P" "$OUT"
    printf '\nDONE in %ss: %s\n' "$(( $(date +%s) - T0 ))" "$OUT"
    ;;
  *) echo "mode must be preview or final" >&2; exit 2 ;;
esac
