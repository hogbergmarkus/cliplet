#!/bin/sh
# Build a runtime-only bundle without touching the installed extension.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
python3 scripts/translations.py build
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT HUP INT TERM
mkdir -p "$stage/schemas" "$stage/locale/sv/LC_MESSAGES" "$root/dist"
cp metadata.json extension.js history.js storage.js prefs.js stylesheet.css LICENSE "$stage/"
cp schemas/org.gnome.shell.extensions.cliplet.gschema.xml "$stage/schemas/"
cp locale/sv/LC_MESSAGES/cliplet@hogbergmarkus.github.io.mo "$stage/locale/sv/LC_MESSAGES/"
glib-compile-schemas --strict "$stage/schemas"
gnome-extensions pack --force --out-dir="$root/dist" \
    --extra-source=history.js --extra-source=storage.js \
    --extra-source=LICENSE --extra-source=locale "$stage"
printf '%s\n' "Built dist/cliplet@hogbergmarkus.github.io.shell-extension.zip"
