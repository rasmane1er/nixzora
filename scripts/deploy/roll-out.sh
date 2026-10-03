#!/usr/bin/env bash
# Points each ECS service at this release's image and waits until it is stable.
# The services use the deployment circuit breaker: a release that fails health checks is
# rolled back automatically, and this script then fails.
#
# Usage: roll-out.sh search=api worker=api api storefront admin   Needs: CLUSTER, PREFIX, REGISTRY, TAG.
# "service=repository" runs another repository's image (the search service is the API image
# started with a different command, ADR-0015). Services not created in this environment yet
# are skipped with a notice.
set -euo pipefail

started=()
for spec in "$@"; do
  service="${spec%%=*}"
  repo="${spec#*=}"
  status=$(aws ecs describe-services --cluster "$CLUSTER" --services "$service" \
    --query 'services[0].status' --output text 2>/dev/null || true)
  if [[ "$status" != "ACTIVE" ]]; then
    echo "::notice::$service is not set up in $CLUSTER yet; skipping it."
    continue
  fi
  family="${PREFIX}-${service}"
  image="${REGISTRY}/nixzora/${repo}:${TAG}"
  current=$(aws ecs describe-task-definition --task-definition "$family" --query taskDefinition)
  next=$(echo "$current" | jq --arg image "$image" --arg tag "$TAG" '
    .containerDefinitions[0].image = $image
    | .containerDefinitions[0].environment |= map(if .name == "APP_VERSION" then .value = $tag else . end)
    | {family, taskRoleArn, executionRoleArn, networkMode, containerDefinitions,
       requiresCompatibilities, cpu, memory, runtimePlatform}')
  arn=$(aws ecs register-task-definition --cli-input-json "$next" --query taskDefinition.taskDefinitionArn --output text)
  aws ecs update-service --cluster "$CLUSTER" --service "$service" --task-definition "$arn" >/dev/null
  echo "Updating $service → $arn"
  started+=("$service")
done

for service in "${started[@]}"; do
  echo "Waiting for $service…"
  aws ecs wait services-stable --cluster "$CLUSTER" --services "$service"
  running=$(aws ecs describe-services --cluster "$CLUSTER" --services "$service" \
    --query 'services[0].deployments[?status==`PRIMARY`].taskDefinition' --output text)
  if [[ "$running" != *"${PREFIX}-${service}:"* ]] || \
     [[ $(aws ecs describe-task-definition --task-definition "$running" --query 'taskDefinition.containerDefinitions[0].image' --output text) != *":${TAG}" ]]; then
    echo "::error::$service rolled back (new tasks failed health checks)."
    exit 1
  fi
  echo "$service is running ${TAG:0:12}."
done
