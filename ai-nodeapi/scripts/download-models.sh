#!/usr/bin/env bash
# Downloads the speech models used by speech_client.ts into ./models
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p models && cd models
BASE=https://github.com/k2-fsa/sherpa-onnx/releases/download
[ -d sherpa-onnx-whisper-base ] || { curl -fSL "$BASE/asr-models/sherpa-onnx-whisper-base.tar.bz2" | tar xj; }
[ -d vits-piper-en_US-lessac-medium ] || { curl -fSL "$BASE/tts-models/vits-piper-en_US-lessac-medium.tar.bz2" | tar xj; }
echo "models ready in $(pwd)"
