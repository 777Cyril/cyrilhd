#!/usr/bin/env bash
set -euo pipefail

if ! command -v sips >/dev/null 2>&1; then
  echo "Error: 'sips' not found. This script requires macOS."
  exit 1
fi

usage() {
  echo "Usage:"
  echo "  scripts/convert-heif.sh <input.heif|input.heic> [output.jpg]"
  echo "  scripts/convert-heif.sh <dir>"
  echo
  echo "Examples:"
  echo "  scripts/convert-heif.sh \"assets/covers/junya sticker.heif\""
  echo "  scripts/convert-heif.sh \"assets/covers\""
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

SRGB_PROFILE="/System/Library/ColorSync/Profiles/sRGB Profile.icc"

convert_one() {
  local input="$1"
  local output="${2:-}"

  if [[ -z "${output}" ]]; then
    local base="${input%.*}"
    output="${base}.jpg"
  fi

  if [[ -f "${SRGB_PROFILE}" ]]; then
    sips -s format jpeg -s formatOptions 90 --matchTo "${SRGB_PROFILE}" "$input" --out "$output" >/dev/null
  else
    sips -s format jpeg -s formatOptions 90 "$input" --out "$output" >/dev/null
  fi
  echo "Converted: $input -> $output"
}

if [[ -d "$1" ]]; then
  shopt -s nullglob
  for f in "$1"/*.heic "$1"/*.heif "$1"/*.HEIC "$1"/*.HEIF; do
    convert_one "$f"
  done
  exit 0
fi

convert_one "$1" "${2:-}"
