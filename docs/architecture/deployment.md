# Deployment architecture

```mermaid
flowchart LR
  user((Shopper / staff)) -->|HTTPS| waf[AWS WAF]
  waf --> alb[Application Load Balancer]
  user -->|images| cf[CloudFront] --> s3[(S3 media, private)]
  subgraph vpc[VPC, 2 AZs]
    subgraph private[Private subnets]
      sf[storefront · Fargate]
      api[api · Fargate]
      search[search · Fargate<br/>no load balancer]
      ai[ai · Fargate<br/>model gateway]
      ops[admin · Fargate]
      rds[(RDS PostgreSQL 16)]
      redis[(ElastiCache Redis)]
    end
    alb -->|apex| sf
    alb -->|api.| api
    alb -->|ops.| ops
    sf --> api
    ops --> api
    api -->|private DNS :4100, internal key| search
    api --> rds
    api --> redis
    search --> rds
    search --> redis
  end
  api -->|private DNS :4200| ai
  search -->|embeddings| ai
  ai --> voyage[Voyage AI]
  ai --> anthropic[Anthropic]
  api -->|presigned PUT| s3
  api --> ses[Amazon SES]
  api --> stripe[Stripe]
  stripe -->|signed webhooks| alb
  gh[GitHub Actions] -->|OIDC| ecr[ECR] --> api
```

- Infrastructure code: `infra/terraform` (`bootstrap/` once per account, `modules/platform/` per
  environment, `environments/{staging,production}/` roots). CI runs `fmt`, `validate` and
  `terraform test`, which plans both environments against mocked AWS.
- The search service ([ADR-0015](../adr/0015-search-service.md)) is the API image started with
  `dist/search-main.js`, found through Cloud Map DNS; remove `search` from `services` to run
  search inside the API again.
- The AI service ([ADR-0016](../adr/0016-ai-service.md)) is the only task holding the model
  provider keys (`dist/ai-main.js`, `ai.<env>.internal:4200`).
- The notifications worker ([ADR-0017](../adr/0017-notifications-worker.md)) delivers the
  outbox (emails, push, indexing) and runs the sweepers and payouts (`dist/worker-main.js`, no
  inbound traffic); the API then runs with `BACKGROUND_JOBS=false`.
- Release pipeline: `.github/workflows/deploy.yml` → `deploy-environment.yml` →
  `scripts/deploy/{migrate,roll-out,smoke-test}.sh`.
- Runbooks: [first deploy](../runbooks/first-deploy.md) · [deploy and roll back](../runbooks/deploy-and-rollback.md) ·
  [restore the database](../runbooks/restore-database.md) · [incident response](../runbooks/incident-response.md) ·
  [rotate secrets](../runbooks/rotate-secrets.md)
