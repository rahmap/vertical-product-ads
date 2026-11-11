#!/usr/bin/env bash
# set_key.sh [folder] — store ELEVENLABS_API_KEY in <folder>/.env (default: the current folder) without it ever
# appearing on screen, in shell history, or in an agent chat. Run it YOURSELF, in your own terminal:
#
#   .claude/skills/vertical-product-ads/scripts/set_key.sh          # writes ./.env
#
# The tools find the key by walking up from the ad project to the nearest .env, so the workspace root is the
# usual place. The file is made readable by you only (chmod 600) and added to that folder's .gitignore.
set -euo pipefail
DIR="$(cd "${1:-.}" && pwd)"
ENV="$DIR/.env"
NAME=ELEVENLABS_API_KEY

if [[ ! -t 0 ]]; then
  echo "set_key.sh must be run in an interactive terminal (it reads the key with hidden input)." >&2
  echo "Do not pipe the key in, and do not paste it into an agent chat." >&2
  exit 2
fi

printf 'Paste your ElevenLabs API key (input is hidden), then Enter: '
IFS= read -rs KEY
printf '\n'
KEY="${KEY//[[:space:]]/}"
[[ -n "$KEY" ]] || { echo "no key entered; nothing changed" >&2; exit 1; }

umask 077
touch "$ENV"
TMP="$(mktemp "$DIR/.env.XXXXXX")"
grep -v -E "^(export[[:space:]]+)?$NAME=" "$ENV" > "$TMP" || true   # drop any old value
printf '%s=%s\n' "$NAME" "$KEY" >> "$TMP"
mv "$TMP" "$ENV"
chmod 600 "$ENV"
unset KEY

GI="$DIR/.gitignore"
if ! { [[ -f "$GI" ]] && grep -qxE '/?\.env' "$GI"; }; then
  printf '.env\n' >> "$GI"
  echo "added .env to $GI"
fi
if git -C "$DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 && git -C "$DIR" ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "WARNING: .env is already committed to git in $DIR. Remove it from history and rotate the key." >&2
fi
echo "saved $NAME to $ENV (permissions 600, value not shown)"
