#!/bin/bash
# Crée /Applications/Édito.app, qui lance desktop/launch.sh de ce dossier.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="/Applications/Édito.app"
rm -rf "$APP"
chmod +x "$ROOT/desktop/launch.sh"
# Applet AppleScript : macOS lui demande l'accès au dossier du projet (Bureau), ce qu'un simple script refuse sans rien dire.
osacompile -o "$APP" -e "do shell script quoted form of \"$ROOT/desktop/launch.sh\" & \" > /dev/null 2>&1\""
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier local.edito.app" "$APP/Contents/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string local.edito.app" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$APP/Contents/Info.plist"

# Icône à partir de brand/app-icon.png, si le fichier existe.
ICON="$ROOT/brand/app-icon.png"
if [ -f "$ICON" ]; then
  TMP="$(mktemp -d)"; SET="$TMP/AppIcon.iconset"; mkdir "$SET"
  for s in 16 32 128 256 512; do
    sips -s format png -z $s $s "$ICON" --out "$SET/icon_${s}x${s}.png" >/dev/null
    sips -s format png -z $((s*2)) $((s*2)) "$ICON" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$SET" -o "$APP/Contents/Resources/applet.icns"
  rm -rf "$TMP"
fi
codesign --force --deep -s - "$APP"
touch "$APP"
echo "App créée : $APP"
