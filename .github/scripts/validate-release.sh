#!/usr/bin/env bash
set -euo pipefail
release_tag="${1:?A version tag is required}"
[[ "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Expected a stable version tag'; exit 1; }
source_sha="$(git rev-parse --verify "refs/tags/$release_tag^{commit}")"
git merge-base --is-ancestor "$source_sha" origin/main
# Older debug-era tags are not eligible to receive the production key.
git cat-file -e "$source_sha:.github/release-signing.json"
version="$(git show "$source_sha:package.json" | node -p "JSON.parse(require('node:fs').readFileSync(0,'utf8')).version")"
test "$release_tag" = "v$version" || { echo 'Tag/package version mismatch'; exit 1; }
printf 'source_sha=%s\ntag=%s\n' "$source_sha" "$release_tag" >> "${GITHUB_OUTPUT:?}"
echo "Validated reviewed $release_tag at $source_sha"
