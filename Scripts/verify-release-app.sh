#!/bin/bash
set -eu

app=${1:?usage: verify-release-app.sh APP TEAM_ID COMMIT}
expected_team=${2:?missing Team ID}
expected_commit=${3:?missing commit}

test -d "$app"
codesign --verify --deep --strict --verbose=2 "$app"

actual_commit=$(/usr/libexec/PlistBuddy -c 'Print :KSAMINTBuildCommit' "$app/Contents/Info.plist")
test "$actual_commit" = "$expected_commit" || {
  echo "Build commit mismatch: expected $expected_commit, found $actual_commit" >&2
  exit 1
}

for bundle in \
  "$app" \
  "$app/Contents/Library/LoginItems/ConversationCaptureHelper.app" \
  "$app/Contents/PlugIns/FinderExtension.appex" \
  "$app/Contents/PlugIns/PreviewExtension.appex" \
  "$app/Contents/PlugIns/QuickActionExtension.appex"
do
  test -d "$bundle"
  team=$(codesign -dvv "$bundle" 2>&1 | sed -n 's/^TeamIdentifier=//p')
  test "$team" = "$expected_team" || {
    echo "Unexpected Team ID for $bundle: $team" >&2
    exit 1
  }
  test -f "$bundle/Contents/embedded.provisionprofile"
  security cms -D -i "$bundle/Contents/embedded.provisionprofile" >/dev/null
done

find "$app" -type f -perm -111 -print0 | while IFS= read -r -d '' executable; do
  if file "$executable" | grep -q 'Mach-O'; then
    archs=$(lipo -archs "$executable")
    echo "$archs" | grep -qw arm64
    if echo "$archs" | grep -qw x86_64; then
      echo "Intel slice found in ARM64 release: $executable" >&2
      exit 1
    fi
  fi
done

echo "Verified ARM64 release app for commit $expected_commit and Team ID $expected_team."
