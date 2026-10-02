#!/usr/bin/env bash
# Runs "prisma migrate deploy" as a one-off Fargate task with the release's migrate image,
# waits for it, prints its logs and fails the deploy if the migration failed.
# Needs: CLUSTER, PREFIX, REGISTRY, TAG (and AWS credentials).
set -euo pipefail

family="${PREFIX}-migrate"
image="${REGISTRY}/nixzora/api:${TAG}-migrate"

# New revision of the migrate task with this release's image.
current=$(aws ecs describe-task-definition --task-definition "$family" --query taskDefinition)
next=$(echo "$current" | jq --arg image "$image" '
  .containerDefinitions[0].image = $image
  | {family, taskRoleArn, executionRoleArn, networkMode, containerDefinitions,
     requiresCompatibilities, cpu, memory, runtimePlatform}')
arn=$(aws ecs register-task-definition --cli-input-json "$next" --query taskDefinition.taskDefinitionArn --output text)

# Same private subnets and security group as the API service.
network=$(aws ecs describe-services --cluster "$CLUSTER" --services api \
  --query 'services[0].networkConfiguration' --output json)

task=$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$arn" --launch-type FARGATE \
  --network-configuration "$network" --started-by "github-${TAG:0:12}" \
  --query 'tasks[0].taskArn' --output text)
echo "Migration task: $task"

aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$task"
code=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$task" \
  --query 'tasks[0].containers[0].exitCode' --output text)

stream="migrate/migrate/${task##*/}"
aws logs get-log-events --log-group-name "/nixzora/${PREFIX#nixzora-}/migrate" --log-stream-name "$stream" \
  --query 'events[].message' --output text || true

if [[ "$code" != "0" ]]; then
  echo "::error::Migration failed with exit code $code. Services were not updated."
  exit 1
fi
echo "Migrations applied."
