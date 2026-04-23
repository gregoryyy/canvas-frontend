#!/usr/bin/env bash
# Build the canvas app and publish dist/ into the parent site's canvas/ dir.
#
#   ./release.sh <path-to-unlost.ventures> [--force]
#
# Fails fast if the canvas repo has uncommitted changes or the target is not a
# git repo. Does NOT commit or push on the target — the parent-site change is
# reviewable.

set -euo pipefail

target=""
force=0
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "error: unknown flag $arg" >&2
      exit 1
      ;;
    *)
      [[ -z "$target" ]] || { echo "error: multiple target paths given" >&2; exit 1; }
      target="$arg"
      ;;
  esac
done

if [[ -z "$target" ]]; then
  echo "usage: ./release.sh <path-to-unlost.ventures> [--force]" >&2
  exit 1
fi

canvas_repo="$(git rev-parse --show-toplevel)"

if [[ -n "$(git -C "$canvas_repo" status --porcelain)" ]]; then
  echo "error: canvas repo has uncommitted changes" >&2
  git -C "$canvas_repo" status --short >&2
  exit 1
fi

if [[ ! -d "$target" ]]; then
  echo "error: target '$target' does not exist" >&2
  exit 1
fi

if ! git -C "$target" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: '$target' is not a git repository" >&2
  exit 1
fi

target_abs="$(cd "$target" && pwd)"
target_canvas="$target_abs/canvas"

( cd "$canvas_repo" && npm run build )

mkdir -p "$target_canvas"
if [[ -n "$(ls -A "$target_canvas" 2>/dev/null)" ]]; then
  if [[ "$force" -ne 1 ]]; then
    echo
    echo "about to remove all contents of: $target_canvas"
    read -r -p "proceed? [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || { echo "aborted." >&2; exit 1; }
  fi
  find "$target_canvas" -mindepth 1 -delete
fi

cp -R "$canvas_repo/dist/." "$target_canvas/"

commit="$(git -C "$canvas_repo" rev-parse HEAD)"
timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$target_canvas/VERSION" <<EOF
commit: $commit
built:  $timestamp
EOF

echo
echo "canvas build published to: $target_canvas"
echo "  commit: $commit"
echo "  built:  $timestamp"
echo
echo "next: review and commit the parent-site change:"
echo "  cd $target_abs && git status"
