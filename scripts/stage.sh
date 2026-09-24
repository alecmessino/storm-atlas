#!/usr/bin/env bash
# Build a staging tree in the layout the Atlas gates were written against:
#   stage/docs/storm-atlas/  = docs/ (the published site) + src/
#   stage/scripts/           = scripts/
#   stage/node_modules       = installed here (esbuild's chunk names depend on a real node_modules at the root)
# The published site stays flat in docs/, served at the Pages root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ST="$ROOT/stage"
rm -rf "$ST/docs" "$ST/scripts"
mkdir -p "$ST/docs/storm-atlas"
cp -r "$ROOT/docs/." "$ST/docs/storm-atlas/"
cp -r "$ROOT/src" "$ST/docs/storm-atlas/src"
cp -r "$ROOT/scripts" "$ST/scripts"
if [ ! -d "$ST/node_modules/esbuild" ]; then
  (cd "$ST" && npm i --silent --no-fund --no-audit --no-save --no-package-lock \
     esbuild@0.25.10 react@18.3.1 react-dom@18.3.1 playwright@1.49.1)
fi
echo "$ST"
