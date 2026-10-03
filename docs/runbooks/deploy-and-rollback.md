# Runbook: deploying and rolling back

## Normal release

1. Merge to `main`. CI must be green.
2. The **Deploy** workflow builds images tagged with the commit SHA, deploys to staging
   (migrations → services → smoke test).
3. Check staging. Approve the `production` job in GitHub when ready.

## Turning on the search service (once per environment)

The search service (ADR-0015) is created by Terraform when `services` has a `search` entry.

1. Deploy a release that contains `dist/search-main.js` first (any release after p8-01).
2. Set `image_tag` in the tfvars to that release's SHA, then `plan` and `apply`. This creates
   the service, its private DNS name and port rule, and adds `SEARCH_SERVICE_URL` to the API
   task definition.
3. Re-run the latest **Deploy** workflow (or push): the roll-out moves `search` and `api` to the
   same release, and from then on the API sends searches to the service.

Check: `GET /api/v1/admin/search/stats` (Ops Center) reports `"service": "search-service"`. If
the service is down, searches still work through keyword search; its logs are in
`/nixzora/<env>/search`.

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
