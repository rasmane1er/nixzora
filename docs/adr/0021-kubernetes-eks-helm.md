# ADR-0021: Kubernetes on EKS (Auto Mode) with a Helm chart, next to ECS

- Status: Accepted (built; staging stays on ECS until switched)
- Date: 2026-10-05
- Roadmap: p8-05 (EKS cluster, Helm charts, autoscaling)
- Builds on: ADR-0005 (ECS Fargate), ADR-0015 (search service), ADR-0016 (AI service),
  ADR-0017 (notifications worker), ADR-0020 (event streaming)

## Context

NIXZORA runs on ECS Fargate: six services from three images, configured by Terraform. That works
and stays the default. Phase 8 also asks for a Kubernetes deployment, because it is the common
runtime for teams that run several services, and it gives finer autoscaling, pod-level network
policies and a portable packaging format (Helm) for the same images.

## Decision

**EKS in Auto Mode, created by the same Terraform module, off by default**
(`kubernetes = { enabled = true }`). Auto Mode means AWS runs the nodes (Bottlerocket, scaled by
its built-in Karpenter), the VPC CNI with network policy enforcement, EKS Pod Identity, block
storage and the load balancer controller. We manage no node groups, no add-on versions and no
controller IAM policies. The control plane is in the private subnets with a public endpoint
(restricted by `public_access_cidrs`), API authentication mode with access entries, secrets
encrypted with a dedicated KMS key, and audit logs in CloudWatch.

**One set of permissions for both runtimes.** The ECS task roles (API, search, AI, web) also
trust `pods.eks.amazonaws.com`, and Pod Identity associations map the chart's service accounts
(`nixzora-api`, `nixzora-search`, `nixzora-ai`, `nixzora-web`) to them. Pods reach PostgreSQL,
Redis and Kafka through the cluster security group. The GitHub deploy role gets an access entry
scoped to the `nixzora` namespace only.

**One Helm chart for every workload** (`infra/helm/nixzora`):

| Piece        | How                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workloads    | api, worker, search, ai, storefront, admin as Deployments from the same images and commands as ECS; any one can be turned off                            |
| Settings     | One ConfigMap built from values (same variable names as the ECS task definitions); in-cluster URLs for search and AI; a checksum rolls pods on change    |
| Secrets      | External Secrets Operator reads the existing Secrets Manager entries; the model provider keys are mounted only in the AI pods                            |
| Autoscaling  | HorizontalPodAutoscaler per workload on CPU (scale out after 60 s, in after 5 min); Auto Mode adds nodes as pods need them                               |
| Availability | Rolling updates with no unavailable pods, spread over zones and nodes, PodDisruptionBudgets when two or more replicas, startup/readiness/liveness probes |
| Traffic      | One internet-facing ALB (Auto Mode IngressClass `alb`), HTTPS only, TLS 1.3 policy, optional WAF ACL, pods registered by IP                              |
| Migrations   | A pre-install/pre-upgrade Job runs `prisma migrate deploy` with the `<tag>-migrate` image; a failure stops the release                                   |
| Pod security | Namespace enforces "restricted": non-root, read-only root filesystem, all capabilities dropped, RuntimeDefault seccomp                                   |
| Network      | Default deny; public apps accept the VPC (ALB, kubelet); the API also accepts the web pods; search and AI only the API and worker                        |

**Checked without a cluster.** CI runs `helm lint --strict`, renders the chart with the default
and staging values and validates every manifest with kubeconform (Kubernetes 1.31 schemas), and
`terraform test` plans the module with Kubernetes on and off. Where Helm cannot be installed,
`infra/helm/tools/render/check.py` renders the chart with a small Go stand-in for `helm template`
and validates against the same schemas.

## Costs and switching

EKS adds about 73 USD a month for the control plane, plus the nodes (Auto Mode picks instance
sizes; roughly the same compute as the Fargate tasks) and the Auto Mode management fee (about
12% of node cost). Running both platforms during a move doubles compute, so the plan is: turn on,
install the chart, test on the ALB's own address, move DNS from the ECS load balancer to the
EKS one, then scale the ECS services to zero. The runbook (`docs/runbooks/kubernetes.md`) has
the steps and the way back.

## Consequences

- The same images run on either platform; nothing in the application changed.
- Kubernetes brings more moving parts (the operator for secrets, Helm releases) and more cost;
  ECS stays the default until there is a reason to switch.
- Deploying with Helm from GitHub Actions (`helm upgrade --install --wait`) is a follow-up once
  the cluster exists; until then the chart is installed by hand per the runbook.
