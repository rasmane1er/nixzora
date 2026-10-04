#!/usr/bin/env bash
# Practice incident (p9-11, docs/runbooks/incident-response.md). Pages whoever is on call with a
# drill alarm, posts a message on the public status page, measures how long each step takes,
# puts everything back, and writes docs/incident-drills/<date>-<env>.md.
#
#   ENV=staging scripts/ops/incident-drill.sh        # from CloudShell, in a clone of the repo
#
# Settings:
#   ENV         staging | production      (default staging)
#   ALARM       alarm to trip              (default <prefix>-alb-5xx)
#   DOMAIN      domain_name of the stack   (default: read from the status probe's settings)
# Needs: aws, jq, curl. Nothing real breaks: the alarm state is set by hand and goes back to OK.
set -euo pipefail

ENV="${ENV:-staging}"
PREFIX="nixzora-${ENV}"
ALARM="${ALARM:-${PREFIX}-alb-5xx}"
NOTE_PARAM="/nixzora/${ENV}/status-note"
REPORT_DIR="${REPORT_DIR:-docs/incident-drills}"
REPORT="${REPORT_DIR}/$(date -u +%Y-%m-%d)-${ENV}.md"
started=$(date +%s)
since() { echo $(($(date +%s) - started)); }

restore() {
  aws cloudwatch set-alarm-state --alarm-name "$ALARM" --state-value OK \
    --state-reason "Incident drill finished" >/dev/null 2>&1 || true
  aws ssm put-parameter --name "$NOTE_PARAM" --value "-" --type String --overwrite >/dev/null 2>&1 || true
}
trap restore EXIT

store_url=$(aws lambda get-function-configuration --function-name "${PREFIX}-status-probe" \
  --query 'Environment.Variables.STOREFRONT_URL' --output text)
status_url="${store_url/:\/\//://status.}status.json"

echo "== Drill on ${ENV}: tripping ${ALARM}"
aws cloudwatch set-alarm-state --alarm-name "$ALARM" --state-value ALARM \
  --state-reason "INCIDENT DRILL: practice only, nothing is broken" >/dev/null
read -r -p "Press Enter as soon as your phone (or email) shows the page... "
paged_after=$(since)

echo "== Posting a message on the status page"
aws ssm put-parameter --name "$NOTE_PARAM" --type String --overwrite \
  --value "Practice drill: this message is a test. Everything is working." >/dev/null
shown_after=""
for _ in $(seq 1 36); do # up to 3 minutes: the probe runs every minute, CloudFront caches 30 s
  if curl -fsS "$status_url" | jq -e '.note | strings | test("Practice drill")' >/dev/null 2>&1; then
    shown_after=$(since)
    break
  fi
  sleep 5
done
echo "Message visible after: ${shown_after:-not within 3 minutes}"

read -r -p "Note anything that went wrong or was unclear (one line, Enter to skip): " notes
restore
trap - EXIT
total=$(since)

mkdir -p "$REPORT_DIR"
cat >"$REPORT" <<REPORT
# Incident drill: ${ENV}, $(date -u +%Y-%m-%d)

- Alarm tripped: \`${ALARM}\`
- Page noticed after: **${paged_after} s**
- Status page message visible after: **${shown_after:-not within 3 minutes} s** (${status_url%status.json})
- Drill took ${total} s; alarm back to OK and the status message cleared
- Notes: ${notes:-none}

Targets: page noticed within 5 minutes; status message up within 3 minutes of deciding to post it.
REPORT
echo "== Report written to ${REPORT}"
