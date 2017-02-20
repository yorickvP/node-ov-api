#!/usr/bin/env bash
set -e
rm -rf docs/
git worktree prune
git worktree add docs/ gh-pages
npm run docs
cd docs
git add .
git commit -m "update docs"
cd ..
git push -f origin gh-pages
