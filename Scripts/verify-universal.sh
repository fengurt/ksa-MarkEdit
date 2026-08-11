#!/bin/bash

set -euo pipefail

app="${1:?usage: verify-universal.sh /path/to/app}"
failures=0

while IFS= read -r -d '' file; do
  if file "$file" | grep -q 'Mach-O'; then
    archs="$(lipo -archs "$file")"
    if [[ "$archs" != *arm64* || "$archs" != *x86_64* ]]; then
      echo "Missing universal architectures: $file ($archs)" >&2
      failures=$((failures + 1))
    fi
  fi
done < <(find "$app" -type f -print0)

if [[ "$failures" -ne 0 ]]; then
  exit 1
fi

echo "Every Mach-O in $app contains arm64 and x86_64."
