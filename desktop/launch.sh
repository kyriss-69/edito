#!/bin/bash
# Lance Édito en app de bureau : compile si besoin, démarre le serveur, ouvre une fenêtre Chrome sans barre d'adresse.
# Le serveur s'arrête quand la fenêtre est fermée.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3210
URL="http://localhost:$PORT"
SUPPORT="$HOME/Library/Application Support/Edito"
LOG="$HOME/Library/Logs/Edito.log"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
export PATH="$HOME/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p "$SUPPORT"
cd "$ROOT"

fail() {
  osascript -e "display alert \"Édito n'a pas pu démarrer\" message \"$1\n\nDétails : $LOG\" as critical" >/dev/null
  exit 1
}
notify() { osascript -e "display notification \"$1\" with title \"Édito\"" >/dev/null; }

[ -x "$CHROME" ] || fail "Google Chrome est introuvable."
command -v npm >/dev/null || fail "Node.js est introuvable."

# Déjà ouvert : on remet la fenêtre au premier plan.
if curl -sf -o /dev/null "$URL"; then
  "$CHROME" --user-data-dir="$SUPPORT/chrome" --app="$URL" >/dev/null 2>&1 &
  exit 0
fi

: > "$LOG"
# Recompile si le code a changé depuis la dernière compilation.
if [ ! -f .next/BUILD_ID ] || [ -n "$(find src drizzle brand package.json next.config.ts -newer .next/BUILD_ID -print -quit)" ]; then
  notify "Mise à jour de l'app, ça peut prendre une minute…"
  npm run build >>"$LOG" 2>&1 || fail "La compilation a échoué."
fi

npm run start -- -p "$PORT" >>"$LOG" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; pkill -P $SERVER 2>/dev/null' EXIT

for _ in $(seq 1 120); do
  curl -sf -o /dev/null "$URL" && break
  kill -0 $SERVER 2>/dev/null || fail "Le serveur s'est arrêté."
  sleep 0.5
done

# Profil Chrome dédié : la commande reste active tant que la fenêtre est ouverte.
"$CHROME" --user-data-dir="$SUPPORT/chrome" --app="$URL" --no-first-run --no-default-browser-check \
  --window-size=1440,900 >>"$LOG" 2>&1
