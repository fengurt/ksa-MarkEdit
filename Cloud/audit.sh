#!/usr/bin/env bash
set -euo pipefail

cloud_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
allowlist="$cloud_dir/rustsec-allowlist.txt"
today=$(date -u +%F)
ignore_args=()

while IFS='|' read -r advisory review_by upstream rationale; do
  case "$advisory" in
    ''|'#'*) continue ;;
  esac
  if [[ -z "$review_by" || -z "$upstream" || -z "$rationale" ]]; then
    echo "Incomplete RustSec allowlist entry: $advisory" >&2
    exit 1
  fi
  if [[ "$review_by" < "$today" ]]; then
    echo "Expired RustSec allowlist entry: $advisory (review by $review_by)" >&2
    exit 1
  fi
  ignore_args+=(--ignore "$advisory")
done < "$allowlist"

cd "$cloud_dir"
cargo audit --deny warnings "${ignore_args[@]}"
