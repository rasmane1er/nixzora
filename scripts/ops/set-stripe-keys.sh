#!/usr/bin/env bash
# Puts the Stripe keys into the environment's app secret (nixzora/<env>/app) without them ever
# appearing on screen, in shell history or in Terraform state. Run it before switching the
# environment to PAYMENTS_PROVIDER=stripe (docs/runbooks/first-deploy.md, step 5).
#
#   ENV=staging scripts/ops/set-stripe-keys.sh       # from CloudShell, in a clone of the repo
#
# Paste each value when asked (input is hidden). Press Enter on an empty prompt to keep the
# value already stored. Values are checked against the shapes the API expects.
# Needs: aws, jq.
set -euo pipefail

ENV="${ENV:-staging}"
SECRET_ID="nixzora/${ENV}/app"
umask 077
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

aws secretsmanager get-secret-value --secret-id "$SECRET_ID" \
  --query SecretString --output text >"$work/current.json"

ask() {
  local key=$1 pattern=$2 label=$3 value
  while true; do
    read -r -s -p "$label ($key, Enter to keep): " value
    echo
    if [[ -z "$value" ]]; then
      echo "  kept"
      return
    fi
    if [[ "$value" =~ $pattern ]]; then
      jq --arg k "$key" --arg v "$value" '.[$k] = $v' "$work/current.json" >"$work/next.json"
      mv "$work/next.json" "$work/current.json"
      echo "  set (${#value} characters)"
      return
    fi
    echo "  that does not look like a $key value; try again"
  done
}

expected_mode="test"
[[ "$ENV" == "production" ]] && expected_mode='(test|live)'

ask STRIPE_SECRET_KEY "^(sk|rk)_${expected_mode}_" "Stripe secret key"
ask STRIPE_PUBLISHABLE_KEY "^pk_${expected_mode}_" "Stripe publishable key"
ask STRIPE_WEBHOOK_SECRET '^whsec_' "Signing secret of the payments webhook"
ask STRIPE_CONNECT_WEBHOOK_SECRET '^whsec_' "Signing secret of the Connect webhook"

# Both keys must come from the same Stripe mode, or every payment fails.
mode() { jq -r --arg k "$1" '.[$k] // ""' "$work/current.json" | sed -E 's/^[a-z]+_(test|live)_.*/\1/'; }
if [[ -n "$(mode STRIPE_SECRET_KEY)" && "$(mode STRIPE_SECRET_KEY)" != "$(mode STRIPE_PUBLISHABLE_KEY)" ]]; then
  echo "The secret and publishable keys are from different modes (test vs live). Nothing saved." >&2
  exit 1
fi

aws secretsmanager put-secret-value --secret-id "$SECRET_ID" \
  --secret-string "file://$work/current.json" >/dev/null
echo "Saved to $SECRET_ID. Stored Stripe keys:"
jq -r 'to_entries[] | select(.key | startswith("STRIPE_")) |
  "  \(.key): \(if .value == "" then "(empty)" else "set" end)"' "$work/current.json"
