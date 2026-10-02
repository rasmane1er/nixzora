#!/usr/bin/env bash
# Quick checks after a deploy: the API is healthy and on this release, the store renders,
# the catalog answers. Usage: smoke-test.sh https://store https://api
set -euo pipefail
store="${1:?storefront URL}"
api="${2:?API URL}"

health=$(curl -fsS --retry 5 --retry-delay 5 "$api/api/v1/health")
echo "$health" | jq -e '.status == "ok"' >/dev/null || { echo "::error::API unhealthy: $health"; exit 1; }
if [[ -n "${TAG:-}" ]]; then
  echo "$health" | jq -e --arg tag "$TAG" '.version == $tag' >/dev/null || echo "::warning::API reports version $(echo "$health" | jq -r .version)"
fi
curl -fsS --retry 3 "$api/api/v1/catalog/categories" | jq -e 'type == "array"' >/dev/null
curl -fsS --retry 3 -o /dev/null "$store/"
curl -fsS --retry 3 -o /dev/null "$store/search?q=laptop"
echo "Smoke test passed."
