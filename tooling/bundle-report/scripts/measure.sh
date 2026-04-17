#!/bin/bash
# Measure the gzipped size of the built browser bundle.
# Stdout is captured as the bundle-report artifact on main; PRs diff against it.
set -e

cd "$(dirname "$0")/../../.."

TARGETS=(
  "packages/browser/dist/array.js"
  "packages/browser/dist/array.full.js"
  "packages/browser/dist/recorder.js"
)

echo "path,raw_bytes,gzip_bytes"
for f in "${TARGETS[@]}"; do
  if [[ -f "$f" ]]; then
    raw=$(wc -c <"$f")
    gz=$(gzip -c "$f" | wc -c)
    echo "$f,$raw,$gz"
  else
    echo "$f,0,0"
  fi
done
