#!/usr/bin/env bash
# check_setup.sh — verify (and where safe, install) what the skill needs. Run once after installing the skill.
#   Node ≥ 20, npm deps (playwright, ajv), Playwright Chromium, ffmpeg/ffprobe, Python 3 with numpy.
#   Creates <skill>/.venv with numpy when no Python with numpy exists. ElevenLabs key is optional.
#   --with edge|whisper|all  also pip-installs the free extras: edge-tts (voice-over) / faster-whisper (transcription).
set -uo pipefail
WITH=""
if [[ "${1:-}" == "--with" ]]; then
  WITH="${2:-}"
  case "$WITH" in edge|whisper|all) ;; *) echo "usage: check_setup.sh [--with edge|whisper|all]" >&2; exit 2 ;; esac
fi
HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(dirname "$HERE")"
ok() { printf '  ✓ %s\n' "$1"; }
bad() { printf '  ✗ %s\n' "$1"; FAIL=1; }
FAIL=0

echo "vertical-product-ads setup ($SKILL)"
if command -v node >/dev/null; then
  v=$(node -p 'process.versions.node.split(".")[0]'); [[ $v -ge 20 ]] && ok "node $(node -v)" || bad "node $(node -v): need ≥ 20"
else bad "node not found"; fi

if [[ ! -d "$SKILL/node_modules/playwright" || ! -d "$SKILL/node_modules/ajv" ]]; then
  echo "  … npm install in $SKILL"; (cd "$SKILL" && npm install --silent) || bad "npm install failed"
fi
[[ -d "$SKILL/node_modules/playwright" ]] && ok "playwright $(node -p "require('$SKILL/node_modules/playwright/package.json').version")"

if (cd "$SKILL" && node -e "import('playwright').then(async p=>{const b=await p.chromium.launch();await b.close()}).catch(()=>process.exit(1))") 2>/dev/null; then
  ok "chromium launches"
else
  echo "  … installing Playwright Chromium"; (cd "$SKILL" && npx playwright install chromium) && ok "chromium installed" || bad "chromium install failed"
fi

for b in ffmpeg ffprobe; do command -v $b >/dev/null && ok "$b $($b -version | head -1 | awk '{print $3}')" || bad "$b not found (brew install ffmpeg / apt install ffmpeg)"; done

PY=""
for c in "${PYTHON:-}" "$SKILL/.venv/bin/python" python3; do
  [[ -n "$c" ]] && command -v "$c" >/dev/null 2>&1 && "$c" -c "import numpy" 2>/dev/null && { PY="$c"; break; }
done
if [[ -z "$PY" ]] && command -v python3 >/dev/null; then
  echo "  … creating $SKILL/.venv with numpy"
  python3 -m venv "$SKILL/.venv" && "$SKILL/.venv/bin/python" -m pip -q install numpy && PY="$SKILL/.venv/bin/python"
fi
[[ -n "$PY" ]] && ok "python with numpy: $PY" || bad "python3 with numpy not available"

# optional free extras; `python -m pip`, not the pip script, whose shebang breaks when the venv is moved
extra() { # <flag> <module> <package> <what it gives>
  if [[ -n "$PY" ]] && "$PY" -c "import $2" 2>/dev/null; then ok "$3 ($4)"; return; fi
  if [[ -n "$PY" && ( "$WITH" == "$1" || "$WITH" == all ) ]]; then
    echo "  … installing $3"
    "$PY" -m pip -q install "$3" && ok "$3 installed ($4)" || bad "pip install $3 failed"
  else printf '  · %s not installed (%s): scripts/check_setup.sh --with %s\n' "$3" "$4" "$1"; fi
}
extra edge edge_tts edge-tts "free voice-over, vo.engine edge"
extra whisper faster_whisper faster-whisper "local transcription for dialogue footage"

# ElevenLabs key: report WHERE it is and whether the file is safe, never the value
keyfile=""; d="$PWD"
while :; do
  if [[ -f "$d/.env" ]] && grep -qE '^(export[[:space:]]+)?ELEVENLABS_API_KEY=.' "$d/.env"; then keyfile="$d/.env"; break; fi
  [[ "$d" == "/" ]] && break; d="$(dirname "$d")"
done
if [[ -n "${ELEVENLABS_API_KEY:-}" ]]; then ok "ELEVENLABS_API_KEY set in the environment (value not shown)"
elif [[ -n "$keyfile" ]]; then
  ok "ELEVENLABS_API_KEY found in $keyfile (value not shown)"
  perm=$(stat -f %Lp "$keyfile" 2>/dev/null || stat -c %a "$keyfile")
  [[ "$perm" == 600 || "$perm" == 400 ]] || printf '  ! %s is readable by others (mode %s): chmod 600 "%s"\n' "$keyfile" "$perm" "$keyfile"
  kd="$(dirname "$keyfile")"
  if git -C "$kd" rev-parse --is-inside-work-tree >/dev/null 2>&1 && ! git -C "$kd" check-ignore -q "$keyfile"; then
    printf '  ! %s is not git-ignored: add .env to .gitignore before committing\n' "$keyfile"
  fi
else printf '  · no ElevenLabs key (optional: free voice/music/transcription work without it). To add one, run in YOUR terminal: %s/scripts/set_key.sh\n' "$SKILL"; fi

[[ $FAIL -eq 0 ]] && echo "ready" || { echo "fix the ✗ items above"; exit 1; }
