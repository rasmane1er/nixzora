# Runbook: deploying and rolling back

## Normal release

1. Merge to `main`. CI must be green.
2. The **Deploy** workflow builds images tagged with the commit SHA, deploys to staging
   (migrations → services → smoke test).
3. Check staging. Approve the `production` job in GitHub when ready.

## Automatic rollback

Each ECS service has the deployment circuit breaker on. If new tasks fail health checks,
ECS returns to the previous task definition by itself and the workflow fails with
"rolled back". Look at `/nixzora/<env>/<service>` in CloudWatch Logs for the reason.

## Manual rollback (bad behavior that passes health checks)

Re-deploy the previous good commit: **Actions → Deploy → Run workflow** on that commit
(or `git revert` the bad change and merge). Images are immutable, so the old SHA is still in ECR.

```bash
# Quick alternative from a terminal: point a service at the previous revision.
aws ecs describe-services --cluster nixzora-production --services api --query 'services[0].deployments'
aws ecs update-service --cluster nixzora-production --service api --task-definition nixzora-production-api:<previous revision>
```

## Migrations

Migrations run before services update and must work with the **previous** release too:
add columns/tables first (expand), ship code that uses them, remove old ones in a later release
(contract). A failed migration stops the deploy before any service changes.
