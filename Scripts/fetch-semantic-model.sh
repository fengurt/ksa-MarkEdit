#!/bin/sh
set -eu

destination=${1:-WebApp/public/models/multilingual-e5-small}
mkdir -p "$destination"

fetch() {
  remote_name=$1
  local_name=$2
  expected=$3
  temporary="$destination/.${local_name}.download"
  curl --fail --location --retry 3 \
    "https://huggingface.co/intfloat/multilingual-e5-small/resolve/main/onnx/${remote_name}" \
    --output "$temporary"
  actual=$(shasum -a 256 "$temporary" | awk '{print $1}')
  if [ "$actual" != "$expected" ]; then
    rm -f "$temporary"
    echo "Checksum mismatch for $remote_name" >&2
    exit 1
  fi
  mv "$temporary" "$destination/$local_name"
}

fetch model_qint8_avx512_vnni.onnx model_quantized.onnx dd476dd0c2514e9b9be83aeb3853fac0763e0bdf4a71645407587d77c48a2d88
fetch tokenizer.json tokenizer.json 0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39
fetch tokenizer_config.json tokenizer_config.json a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b
