#!/usr/bin/env bash
# Build with the GitHub Pages base path and publish dist/ to the gh-pages branch (no force-push).
set -euo pipefail
cd "$(dirname "$0")"
BASE=/swatfall/ npx vite build
rm -rf /tmp/swatfall-pages && git worktree prune
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch -q origin gh-pages && git worktree add -q /tmp/swatfall-pages -B gh-pages origin/gh-pages
else
  git worktree add -q --detach /tmp/swatfall-pages && (cd /tmp/swatfall-pages && git checkout -q --orphan gh-pages && git rm -rfq .)
fi
find /tmp/swatfall-pages -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r dist/. /tmp/swatfall-pages/ && touch /tmp/swatfall-pages/.nojekyll
cd /tmp/swatfall-pages && git add -A && git commit -qm "Deploy $(cd - >/dev/null; git rev-parse --short HEAD)" && git push -q origin gh-pages
cd - >/dev/null && git worktree remove --force /tmp/swatfall-pages
