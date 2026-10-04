#!/usr/bin/env bash
# Disaster-recovery drill (docs/runbooks/disaster-recovery.md). Restores the database to a
# point in time on a NEW, temporary instance, proves the copy is usable with the release's own
# check (dist/cli/verify-restore.js, run as a one-off task of the migrate image), checks that
# AWS Backup has a recent recovery point and that a deleted media file can be brought back, then
# writes a report with the times and deletes what it created. Production data is only read.
#
#   ENV=staging scripts/dr/restore-drill.sh              # from CloudShell, in a clone of the repo
#   ENV=staging RESTORE_TIME=2027-03-01T14:05:00Z KEEP=1 scripts/dr/restore-drill.sh
#
# Settings:
#   ENV               staging | production                 (default staging)
#   RESTORE_TIME      UTC point to restore to              (default: latest restorable time)
#   EXPECT_MIGRATION  newest migration the copy must have  (default: not checked)
#   KEEP=1            keep the restored instance afterwards (it costs money: delete it yourself)
#   SKIP_MEDIA=1      skip the media-file recovery check
#   COPY_REGION       region holding the backup copies (default: none checked; production: us-west-2)
# Needs: aws, jq; credentials allowed to restore RDS instances and run ECS tasks.
set -euo pipefail

ENV="${ENV:-staging}"
PREFIX="nixzora-${ENV}"
CLUSTER="${PREFIX}"
STAMP="$(date -u +%Y%m%d%H%M)"
DRILL="${PREFIX}-drill-${STAMP}"
REPORT_DIR="${REPORT_DIR:-docs/dr-drills}"
REPORT="${REPORT_DIR}/$(date -u +%Y-%m-%d)-${ENV}.md"
started=$(date +%s)
created=""

say() { printf '\n== %s (%ss)\n' "$1" "$(($(date +%s) - started))"; }
since() { echo $(($(date +%s) - started)); }

cleanup() {
  if [[ -n "$created" && "${KEEP:-0}" != "1" ]]; then
    say "Deleting the temporary instance ${created}"
    aws rds delete-db-instance --db-instance-identifier "$created" \
      --skip-final-snapshot --delete-automated-backups >/dev/null || true
  elif [[ -n "$created" ]]; then
    echo "KEEP=1: ${created} is still running. Delete it when done:"
    echo "  aws rds delete-db-instance --db-instance-identifier ${created} --skip-final-snapshot"
  fi
}
trap cleanup EXIT

# ── 1. The source instance ──────────────────────────────────────────────────────────────────
say "Reading ${PREFIX}"
source=$(aws rds describe-db-instances --db-instance-identifier "$PREFIX" --query 'DBInstances[0]')
subnet_group=$(jq -r '.DBSubnetGroup.DBSubnetGroupName' <<<"$source")
security_groups=$(jq -r '[.VpcSecurityGroups[].VpcSecurityGroupId] | join(" ")' <<<"$source")
instance_class=$(jq -r '.DBInstanceClass' <<<"$source")
secret_arn=$(jq -r '.MasterUserSecret.SecretArn // empty' <<<"$source")
latest=$(jq -r '.LatestRestorableTime' <<<"$source")
restore_time="${RESTORE_TIME:-$latest}"
echo "Restoring to ${restore_time} (latest restorable: ${latest})"

# ── 2. Point-in-time restore to a new instance ──────────────────────────────────────────────
say "Restoring into ${DRILL}"
# shellcheck disable=SC2086 # several security group ids, one per word
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier "$PREFIX" \
  --target-db-instance-identifier "$DRILL" \
  --restore-time "$restore_time" \
  --db-subnet-group-name "$subnet_group" \
  --vpc-security-group-ids $security_groups \
  --db-instance-class "$instance_class" \
  --no-multi-az --no-publicly-accessible --no-deletion-protection \
  --tags Key=purpose,Value=dr-drill Key=project,Value=nixzora >/dev/null
created="$DRILL"
aws rds wait db-instance-available --db-instance-identifier "$DRILL"
restored_after=$(since)
echo "Available after ${restored_after}s"

# The copy keeps the password it had at the restore point; give it today's, so the verify task
# (which reads the database secret) can sign in even if the password was rotated since.
if [[ -n "$secret_arn" ]]; then
  say "Setting the copy's password from the database secret"
  password=$(aws secretsmanager get-secret-value --secret-id "$secret_arn" \
    --query SecretString --output text | jq -r .password)
  managed=$(aws rds describe-db-instances --db-instance-identifier "$DRILL" \
    --query 'DBInstances[0].MasterUserSecret.SecretArn' --output text)
  extra=()
  [[ "$managed" != "None" ]] && extra=(--no-manage-master-user-password)
  aws rds modify-db-instance --db-instance-identifier "$DRILL" "${extra[@]}" \
    --master-user-password "$password" --apply-immediately >/dev/null
  unset password
  for _ in $(seq 1 30); do # wait for the change to start, then to finish
    status=$(aws rds describe-db-instances --db-instance-identifier "$DRILL" \
      --query 'DBInstances[0].DBInstanceStatus' --output text)
    [[ "$status" != "available" ]] && break
    sleep 5
  done
  aws rds wait db-instance-available --db-instance-identifier "$DRILL"
fi
host=$(aws rds describe-db-instances --db-instance-identifier "$DRILL" \
  --query 'DBInstances[0].Endpoint.Address' --output text)

# ── 3. Is the copy usable? The release's own check, from inside the VPC ─────────────────────
say "Checking the copy from a one-off task"
args=("node" "dist/cli/verify-restore.js" "--restore-time" "$restore_time")
[[ -n "${EXPECT_MIGRATION:-}" ]] && args+=("--expect-migration" "$EXPECT_MIGRATION")
overrides=$(jq -n --arg host "$host" --argjson command "$(printf '%s\n' "${args[@]}" | jq -R . | jq -s .)" \
  '{containerOverrides: [{name: "migrate", command: $command,
    environment: [{name: "DATABASE_HOST", value: $host}]}]}')
network=$(aws ecs describe-services --cluster "$CLUSTER" --services api \
  --query 'services[0].networkConfiguration' --output json)
task=$(aws ecs run-task --cluster "$CLUSTER" --task-definition "${PREFIX}-migrate" \
  --launch-type FARGATE --network-configuration "$network" --overrides "$overrides" \
  --started-by "dr-drill-${STAMP}" --query 'tasks[0].taskArn' --output text)
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$task"
code=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$task" \
  --query 'tasks[0].containers[0].exitCode' --output text)
verified_after=$(since)
check=$(aws logs get-log-events --log-group-name "/nixzora/${ENV}/migrate" \
  --log-stream-name "migrate/migrate/${task##*/}" --query 'events[].message' --output json \
  | jq -r '.[]' || true)
echo "$check"

# ── 4. AWS Backup: a recent recovery point exists (older mistakes than the PITR window) ─────
say "Checking AWS Backup"
newest_backup=$(aws backup list-recovery-points-by-backup-vault --backup-vault-name "$PREFIX" \
  --query 'max_by(RecoveryPoints, &CreationDate).CreationDate' --output text 2>/dev/null || echo None)
backup_ok=no
if [[ "$newest_backup" != "None" && -n "$newest_backup" ]]; then
  age_h=$(( ($(date +%s) - $(date -d "$newest_backup" +%s)) / 3600 ))
  [[ $age_h -le 26 ]] && backup_ok=yes
  echo "Newest recovery point: ${newest_backup} (${age_h} h old)"
else
  echo "No recovery point found in vault ${PREFIX}"
fi

# ── 4b. The copy in the second region (p9-10), when there is one ────────────────────────────
copy_ok=skipped
newest_copy=None
if [[ -n "${COPY_REGION:-}" ]]; then
  say "Checking the backup copy in ${COPY_REGION}"
  newest_copy=$(aws backup list-recovery-points-by-backup-vault --region "$COPY_REGION" \
    --backup-vault-name "${PREFIX}-copy" \
    --query 'max_by(RecoveryPoints, &CreationDate).CreationDate' --output text 2>/dev/null || echo None)
  copy_ok=no
  if [[ "$newest_copy" != "None" && -n "$newest_copy" ]]; then
    copy_age_h=$(( ($(date +%s) - $(date -d "$newest_copy" +%s)) / 3600 ))
    # Copies start after the backup finishes, so allow a few more hours than for the original.
    [[ $copy_age_h -le 30 ]] && copy_ok=yes
    echo "Newest copy: ${newest_copy} (${copy_age_h} h old)"
  else
    echo "No recovery point found in ${PREFIX}-copy (${COPY_REGION})"
  fi
fi

# ── 5. A deleted media file comes back (bucket versioning) ──────────────────────────────────
media_ok=skipped
if [[ "${SKIP_MEDIA:-0}" != "1" ]]; then
  say "Deleting and recovering a test media file"
  account=$(aws sts get-caller-identity --query Account --output text)
  bucket="${PREFIX}-media-${account}"
  key="dr-drill/${STAMP}.txt"
  echo "dr drill ${STAMP}" | aws s3 cp - "s3://${bucket}/${key}" >/dev/null
  version=$(aws s3api head-object --bucket "$bucket" --key "$key" --query VersionId --output text)
  aws s3 rm "s3://${bucket}/${key}" >/dev/null
  aws s3api copy-object --bucket "$bucket" --key "$key" \
    --copy-source "${bucket}/${key}?versionId=${version}" >/dev/null
  if aws s3 cp "s3://${bucket}/${key}" - | grep -q "dr drill ${STAMP}"; then media_ok=yes; else media_ok=no; fi
  # Leave nothing behind: every version and delete marker of the test file.
  aws s3api list-object-versions --bucket "$bucket" --prefix "$key" \
    --query '[Versions[].{Key:Key,VersionId:VersionId}, DeleteMarkers[].{Key:Key,VersionId:VersionId}][]' \
    --output json | jq -c '.[]' | while read -r object; do
    aws s3api delete-object --bucket "$bucket" --key "$(jq -r .Key <<<"$object")" \
      --version-id "$(jq -r .VersionId <<<"$object")" >/dev/null
  done
fi

# ── 6. Report ───────────────────────────────────────────────────────────────────────────────
total=$(since)
gap=$(jq -r '.dataGapSeconds // "unknown"' <<<"$check" 2>/dev/null || echo unknown)
verdict=$([[ "$code" == "0" && "$backup_ok" == "yes" && "$media_ok" != "no" && "$copy_ok" != "no" ]] && echo PASSED || echo FAILED)
mkdir -p "$REPORT_DIR"
cat >"$REPORT" <<EOF
# Disaster-recovery drill: ${ENV}, $(date -u +%Y-%m-%d)

- Result: **${verdict}**
- Restore point: ${restore_time} (latest restorable then: ${latest})
- Database restored and available after **$((restored_after / 60)) min $((restored_after % 60)) s**
- Copy verified after **$((verified_after / 60)) min $((verified_after % 60)) s** (time to recover, RTO)
- Newest write in the copy was ${gap} s before the restore point (data lost, RPO)
- Restore check exit code: ${code}
- AWS Backup newest recovery point: ${newest_backup} (recent enough: ${backup_ok})
- Copy in the second region${COPY_REGION:+ (${COPY_REGION})}: ${newest_copy} (recent enough: ${copy_ok})
- Deleted media file recovered: ${media_ok}
- Drill took $((total / 60)) min in total; temporary instance ${DRILL} $([[ "${KEEP:-0}" == "1" ]] && echo kept || echo deleted)

## Restore check

\`\`\`json
${check}
\`\`\`
EOF
say "Report written to ${REPORT}: ${verdict}"
[[ "$verdict" == "PASSED" ]]
