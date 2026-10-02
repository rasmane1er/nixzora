#!/usr/bin/env bash
# Publish NIXZORA to GitHub (first time) or push new work (later). Run from anywhere:
#   bash scripts/publish-github.sh
# Uses your normal git credentials for github.com. Never commits .env files.
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE="${1:-https://github.com/rasmane1er/nixzora.git}"

# Stale copies from early phases (replaced by @nixzora/ui); not part of the app.
rm -f apps/storefront/components/Logo.tsx apps/storefront/app/page.module.css apps/admin/components/Logo.tsx

[ -d .git ] || git init -b main
git add -A

if git diff --cached --name-only | grep -E '(^|/)\.env(\.[^/]*)?$' | grep -v '\.example$'; then
  echo "Refusing to continue: a .env file is staged (see above). Nothing was pushed."
  exit 1
fi

if ! git diff --cached --quiet; then
  git commit -q -m "NIXZORA: platform, web apps, mobile app and AWS infrastructure (phases 0–5)" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" \
    -m "Claude-Session: https://claude.ai/code/session_01M6cj4uGbuujv5PEz5cAZLe"
fi

git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "$REMOTE" || git remote add origin "$REMOTE"
git push -u origin main
echo "Pushed to $REMOTE"
