#!/usr/bin/env bash
set -euo pipefail

KTX_BIN="${KTX_BIN:-ktx}"
CONVERT_BIN="${CONVERT_BIN:-convert}"
SRC_DIR="${SRC_DIR:-assets-source/globe}"
OUT_DIR="${OUT_DIR:-public/textures}"

mkdir -p "$OUT_DIR"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

resize_png() {
  local src="$1"
  local width="$2"
  local height="$3"
  local out="$4"
  "$CONVERT_BIN" "$src" -resize "${width}x${height}!" "$out"
}

create_srgb() {
  local input="$1"
  local output="$2"
  local qlevel="$3"
  "$KTX_BIN" create     --format R8G8B8_SRGB     --encode basis-lz     --qlevel "$qlevel"     --clevel 5     --generate-mipmap     --mipmap-filter lanczos4     "$input" "$output"
  "$KTX_BIN" validate "$output"
}

create_linear() {
  local input="$1"
  local output="$2"
  local qlevel="$3"
  "$KTX_BIN" create     --format R8G8B8_UNORM     --assign-tf linear     --encode basis-lz     --qlevel "$qlevel"     --clevel 5     --generate-mipmap     --mipmap-filter lanczos4     "$input" "$output"
  "$KTX_BIN" validate "$output"
}

resize_png "$SRC_DIR/earth-day-8k.jpg" 4096 2048 "$WORK_DIR/day-4k.png"
resize_png "$SRC_DIR/earth-day-8k.jpg" 2048 1024 "$WORK_DIR/day-2k.png"
resize_png "$SRC_DIR/earth-night-4k.jpg" 2048 1024 "$WORK_DIR/night-2k.png"
resize_png "$SRC_DIR/earth-clouds-4k.jpg" 2048 1024 "$WORK_DIR/clouds-2k.png"
resize_png "$SRC_DIR/earth-specular.jpg" 1024 512 "$WORK_DIR/specular-1k.png"

create_srgb  "$WORK_DIR/day-4k.png"      "$OUT_DIR/earth-day-4k.ktx2"      180
create_srgb  "$WORK_DIR/day-2k.png"      "$OUT_DIR/earth-day-2k.ktx2"      170
create_srgb  "$WORK_DIR/night-2k.png"    "$OUT_DIR/earth-night-2k.ktx2"    155
create_linear "$WORK_DIR/clouds-2k.png"  "$OUT_DIR/earth-clouds-2k.ktx2"   145
create_linear "$WORK_DIR/specular-1k.png" "$OUT_DIR/earth-specular-1k.ktx2" 125

printf '\nKTX2 runtime assets:\n'
du -h   "$OUT_DIR/earth-day-4k.ktx2"   "$OUT_DIR/earth-day-2k.ktx2"   "$OUT_DIR/earth-night-2k.ktx2"   "$OUT_DIR/earth-clouds-2k.ktx2"   "$OUT_DIR/earth-specular-1k.ktx2"

ktx_bytes=$(wc -c   "$OUT_DIR/earth-day-4k.ktx2"   "$OUT_DIR/earth-day-2k.ktx2"   "$OUT_DIR/earth-night-2k.ktx2"   "$OUT_DIR/earth-clouds-2k.ktx2"   "$OUT_DIR/earth-specular-1k.ktx2" | tail -1 | awk '{print $1}')

webp_bytes=$(wc -c   "$OUT_DIR/earth-day-4k.webp"   "$OUT_DIR/earth-day-2k.webp"   "$OUT_DIR/earth-night-2k.webp"   "$OUT_DIR/earth-clouds-2k.webp"   "$OUT_DIR/earth-specular-1k.webp" | tail -1 | awk '{print $1}')

printf 'KTX2 total: %s bytes\n' "$ktx_bytes"
printf 'WebP total: %s bytes\n' "$webp_bytes"
