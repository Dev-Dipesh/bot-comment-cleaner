#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$ROOT_DIR/dist"
ZIP_PATH="$DIST_DIR/bot-comment-cleaner.zip"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cd "$ROOT_DIR"
zip -r "$ZIP_PATH" . \
  -x "./dist/*" \
  -x "./.git/*" \
  -x "./.DS_Store" \
  -x "./*.zip"

echo "Created $ZIP_PATH"
