#!/bin/sh
set -eu

source_mode=auto
requested_ref=HEAD
repository=fengurt/ksa-MarkEdit
team_id=${KSAMINT_EXPECTED_TEAM_ID:-}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source) source_mode=$2; shift 2 ;;
    --ref) requested_ref=$2; shift 2 ;;
    --repo) repository=$2; shift 2 ;;
    --team-id) team_id=$2; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$source_mode" in auto|ci|local) ;; *) echo "--source must be auto, ci, or local" >&2; exit 2 ;; esac

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
expected_commit=$(git -C "$root" rev-parse "$requested_ref^{commit}")
temporary=$(mktemp -d "${TMPDIR:-/tmp}/ksamint-install.XXXXXX")
cleanup() { rm -rf "$temporary"; }
trap cleanup EXIT INT TERM

build_locally=false
if [ "$source_mode" = local ]; then build_locally=true; fi
if [ "$source_mode" = auto ] && xcode-select -p 2>/dev/null | grep -q '/Xcode.app/Contents/Developer'; then
  if security find-identity -v -p codesigning | grep -q 'Developer ID Application'; then build_locally=true; fi
fi

if $build_locally; then
  echo "A notarized local build requires the release workflow; dispatching CI for $expected_commit."
fi

command -v gh >/dev/null 2>&1 || { echo "GitHub CLI is required to obtain the signed build." >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Sign in with gh auth login first." >&2; exit 1; }

gh workflow run signed-local-install.yml --repo "$repository" --ref main -f ref="$expected_commit"
run_id=
attempt=0
while [ "$attempt" -lt 120 ]; do
  run_id=$(gh run list --repo "$repository" --workflow signed-local-install.yml --limit 30 --json databaseId,displayTitle,status,conclusion --jq ".[] | select(.displayTitle == \"Signed local $expected_commit\") | .databaseId" | head -1)
  if [ -n "$run_id" ]; then
    state=$(gh run view "$run_id" --repo "$repository" --json status,conclusion --jq '.status + ":" + (.conclusion // "")')
    case "$state" in
      completed:success) break ;;
      completed:*) echo "Signed CI build failed: $state" >&2; exit 1 ;;
    esac
  fi
  attempt=$((attempt + 1))
  sleep 15
done
test -n "$run_id" || { echo "Timed out waiting for the signed CI run." >&2; exit 1; }
gh run download "$run_id" --repo "$repository" --name ksamint-MarkEdit-signed-local --dir "$temporary/artifact"

archive="$temporary/artifact/ksamint-MarkEdit-signed-local.zip"
test -f "$archive" || { echo "Signed app artifact is missing." >&2; exit 1; }
ditto -x -k "$archive" "$temporary/unpacked"
candidate="$temporary/unpacked/ksamint MarkEdit.app"
test -d "$candidate" || { echo "Signed app bundle is missing." >&2; exit 1; }

actual_commit=$(/usr/libexec/PlistBuddy -c 'Print :KSAMINTBuildCommit' "$candidate/Contents/Info.plist")
test "$actual_commit" = "$expected_commit" || { echo "Artifact commit mismatch: $actual_commit" >&2; exit 1; }
archs=$(lipo -archs "$candidate/Contents/MacOS/ksamint MarkEdit")
echo "$archs" | grep -qw arm64
echo "$archs" | grep -qw x86_64
codesign --verify --deep --strict --verbose=2 "$candidate"
spctl --assess --type execute -vv "$candidate"
xcrun stapler validate "$candidate"

actual_team=$(codesign -dvv "$candidate" 2>&1 | sed -n 's/^TeamIdentifier=//p')
if [ -z "$team_id" ]; then team_id=$actual_team; fi
test -n "$team_id" && test "$actual_team" = "$team_id" || { echo "Unexpected signing Team ID: $actual_team" >&2; exit 1; }

target="/Applications/ksamint MarkEdit.app"
running=false
if pgrep -x 'ksamint MarkEdit' >/dev/null 2>&1; then
  running=true
  osascript -e 'tell application "ksamint MarkEdit" to quit' >/dev/null 2>&1 || true
  wait_count=0
  while pgrep -x 'ksamint MarkEdit' >/dev/null 2>&1 && [ "$wait_count" -lt 20 ]; do
    sleep 1
    wait_count=$((wait_count + 1))
  done
  if pgrep -x 'ksamint MarkEdit' >/dev/null 2>&1; then
    echo "Installation deferred: the app still has a window or unsaved document open." >&2
    exit 3
  fi
fi

backup=
if [ -d "$target" ]; then
  backup="/Applications/ksamint MarkEdit.backup-$(date +%Y%m%d-%H%M%S).app"
  mv "$target" "$backup"
fi
rollback() {
  rm -rf "$target"
  if [ -n "$backup" ] && [ -d "$backup" ]; then mv "$backup" "$target"; fi
}
trap 'rollback; cleanup' HUP INT TERM

if ! ditto "$candidate" "$target"; then rollback; exit 1; fi
if ! codesign --verify --deep --strict "$target" || ! spctl --assess --type execute "$target"; then
  echo "Installed app failed verification; rolling back." >&2
  rollback
  exit 1
fi

open -a "$target"
sleep 3
if ! pgrep -x 'ksamint MarkEdit' >/dev/null 2>&1; then
  echo "Installed app failed its launch smoke test; rolling back." >&2
  rollback
  if [ -d "$target" ]; then open -a "$target"; fi
  exit 1
fi

version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$target/Contents/Info.plist")
build=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$target/Contents/Info.plist")
test -d "$target/Contents/Library/LoginItems/ConversationCaptureHelper.app"
test -d "$target/Contents/PlugIns/FinderExtension.appex"
test -d "$target/Contents/PlugIns/QuickActionExtension.appex"
echo "Installed ksamint MarkEdit $version ($build), commit $actual_commit."
if [ -n "$backup" ]; then echo "Previous app retained at $backup"; fi
