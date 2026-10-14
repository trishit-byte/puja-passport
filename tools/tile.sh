#!/bin/bash
# tile.sh out.png in1 in2 ... (horizontal strip)
out=$1; shift
args=(); for f in "$@"; do args+=(-i "$f"); done
"$(dirname "$0")/../.tools-ffmpeg/bin/ffmpeg" -y -loglevel error "${args[@]}" -filter_complex "hstack=inputs=$#" "$out"
