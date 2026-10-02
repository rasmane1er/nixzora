# ADR-0007: Hosting on AWS with ECS Fargate, provisioned by Terraform

- Status: Accepted
- Date: 2027-02-15

## Context

v0.5 needs a public, secure, affordable demo that one person can operate, and that can grow
into the Phase 8 scale targets without a rewrite. The roadmap already chose AWS.

## Decision

| Concern         | Choice                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------- |
| Compute         | ECS on Fargate (ARM64/Graviton), one service each for API, storefront and Ops Center         |
| Traffic         | One Application Load Balancer, host-based routing (`api.`, `ops.`, apex), TLS 1.2+ only      |
| Edge protection | AWS WAF: managed common/SQLi/bad-input/IP-reputation rules, per-IP rate limits               |
| Data            | RDS PostgreSQL 16 (TLS enforced, encrypted, PITR, Multi-AZ in production); ElastiCache Redis |
|                 | with TLS and an auth token                                                                   |
| Media           | Private S3 bucket behind CloudFront with origin access control                               |
| Secrets         | Secrets Manager; the database password is managed and rotated by RDS                         |
| Email           | Amazon SES with DKIM and DMARC                                                               |
| Backups         | RDS point-in-time recovery plus AWS Backup (daily 35 days; monthly 1 year in production)     |
| Delivery        | GitHub Actions → ECR → migration task → rolling ECS deploy with automatic rollback           |
| Identity for CI | GitHub OIDC role scoped to this repository's main branch and environments; no stored keys    |
| Infrastructure  | Terraform (OpenTofu-compatible), one reusable module, staging and production roots           |

Kubernetes (EKS) is deliberately postponed to Phase 8: Fargate gives isolation, autoscaling and
zero server patching with far less to operate.

## Consequences

- Rough monthly cost: staging ≈ $90–120 (one NAT gateway, smallest instances); production
  ≈ $350–450 (Multi-AZ database, two NAT gateways, two tasks per service).
- Releases are immutable images tagged with the git SHA; the same image is promoted from staging
  to production after approval.
- A failed health check rolls a release back automatically; database migrations must therefore
  be backward compatible with the previous release (expand, then contract).
- `terraform test` plans both environments against mocked AWS in CI, so broken infrastructure
  code is caught before anyone runs `apply`.
