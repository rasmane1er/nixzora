# ───────────── Kubernetes: EKS Auto Mode (ADR-0021) ─────────────
# An alternative runtime for the same images and settings as ECS. Auto Mode runs the nodes
# (Karpenter-based autoscaling, Bottlerocket, patched by AWS), the VPC CNI with network policies,
# EKS Pod Identity and the load balancer controller, so the cluster needs no add-on management.
# Pods reuse the ECS task roles through Pod Identity associations: one set of permissions for
# both platforms. Off unless var.kubernetes.enabled.

locals {
  eks_enabled = var.kubernetes.enabled
  # Service accounts created by the chart ("<release>-<name>") → the role each one uses.
  eks_pod_roles = local.eks_enabled ? merge(
    {
      api = aws_iam_role.api_task.arn
      web = aws_iam_role.web_task.arn
    },
    local.search_enabled ? { search = aws_iam_role.search_task[0].arn } : {},
    local.ai_enabled ? { ai = aws_iam_role.ai_task[0].arn } : {},
  ) : {}
}

data "aws_iam_policy_document" "eks_cluster_assume" {
  statement {
    actions = ["sts:AssumeRole", "sts:TagSession"]
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eks_cluster" {
  count              = local.eks_enabled ? 1 : 0
  name               = "${local.prefix}-eks-cluster"
  assume_role_policy = data.aws_iam_policy_document.eks_cluster_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "eks_cluster" {
  for_each = local.eks_enabled ? toset([
    "AmazonEKSClusterPolicy",
    "AmazonEKSComputePolicy",
    "AmazonEKSBlockStoragePolicy",
    "AmazonEKSLoadBalancingPolicy",
    "AmazonEKSNetworkingPolicy",
  ]) : toset([])
  role       = aws_iam_role.eks_cluster[0].name
  policy_arn = "arn:aws:iam::aws:policy/${each.key}"
}

data "aws_iam_policy_document" "eks_node_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eks_node" {
  count              = local.eks_enabled ? 1 : 0
  name               = "${local.prefix}-eks-node"
  assume_role_policy = data.aws_iam_policy_document.eks_node_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "eks_node" {
  for_each   = local.eks_enabled ? toset(["AmazonEKSWorkerNodeMinimalPolicy", "AmazonEC2ContainerRegistryPullOnly"]) : toset([])
  role       = aws_iam_role.eks_node[0].name
  policy_arn = "arn:aws:iam::aws:policy/${each.key}"
}

# Kubernetes secrets encrypted with a key of our own, on top of EBS encryption.
resource "aws_kms_key" "eks" {
  count               = local.eks_enabled ? 1 : 0
  description         = "${local.prefix} EKS secrets"
  enable_key_rotation = true
  tags                = local.tags
}

resource "aws_cloudwatch_log_group" "eks" {
  count             = local.eks_enabled ? 1 : 0
  name              = "/aws/eks/${local.prefix}/cluster"
  retention_in_days = var.environment == "production" ? 90 : 14
  tags              = local.tags
}

resource "aws_eks_cluster" "main" {
  count    = local.eks_enabled ? 1 : 0
  name     = local.prefix
  version  = var.kubernetes.version
  role_arn = aws_iam_role.eks_cluster[0].arn

  # Auto Mode: AWS runs the core add-ons, compute, storage and load balancing.
  bootstrap_self_managed_addons = false
  compute_config {
    enabled       = true
    node_pools    = ["general-purpose", "system"]
    node_role_arn = aws_iam_role.eks_node[0].arn
  }
  kubernetes_network_config {
    elastic_load_balancing {
      enabled = true
    }
  }
  storage_config {
    block_storage {
      enabled = true
    }
  }

  access_config {
    authentication_mode                         = "API"
    bootstrap_cluster_creator_admin_permissions = true
  }

  vpc_config {
    subnet_ids              = aws_subnet.private[*].id
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = var.kubernetes.public_access_cidrs
  }

  encryption_config {
    resources = ["secrets"]
    provider {
      key_arn = aws_kms_key.eks[0].arn
    }
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator"]

  tags = local.tags

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster,
    aws_cloudwatch_log_group.eks,
  ]
}

# Pods → the same IAM roles as the ECS tasks (S3 media, SES, MSK…).
resource "aws_eks_pod_identity_association" "app" {
  for_each        = local.eks_pod_roles
  cluster_name    = aws_eks_cluster.main[0].name
  namespace       = var.kubernetes.namespace
  service_account = "${var.kubernetes.release}-${each.key}"
  role_arn        = each.value
  tags            = local.tags
}

# External Secrets Operator: reads the app's secrets from Secrets Manager into Kubernetes.
data "aws_iam_policy_document" "external_secrets" {
  count = local.eks_enabled ? 1 : 0
  statement {
    actions = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = concat(
      [
        aws_secretsmanager_secret.app.arn,
        aws_secretsmanager_secret.redis.arn,
        aws_secretsmanager_secret.internal.arn,
        aws_secretsmanager_secret.ai.arn,
      ],
      [local.db_secret],
    )
  }
}

resource "aws_iam_role" "external_secrets" {
  count              = local.eks_enabled ? 1 : 0
  name               = "${local.prefix}-eks-external-secrets"
  assume_role_policy = data.aws_iam_policy_document.app_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy" "external_secrets" {
  count  = local.eks_enabled ? 1 : 0
  role   = aws_iam_role.external_secrets[0].id
  policy = data.aws_iam_policy_document.external_secrets[0].json
}

resource "aws_eks_pod_identity_association" "external_secrets" {
  count           = local.eks_enabled ? 1 : 0
  cluster_name    = aws_eks_cluster.main[0].name
  namespace       = "external-secrets"
  service_account = "external-secrets"
  role_arn        = aws_iam_role.external_secrets[0].arn
  tags            = local.tags
}

# Pods reach PostgreSQL, Redis and (when on) Kafka through the cluster security group.
resource "aws_vpc_security_group_ingress_rule" "eks_data" {
  for_each                     = local.eks_enabled ? { postgres = 5432, redis = 6379 } : {}
  security_group_id            = aws_security_group.data.id
  description                  = "${each.key} from EKS pods"
  referenced_security_group_id = aws_eks_cluster.main[0].vpc_config[0].cluster_security_group_id
  from_port                    = each.value
  to_port                      = each.value
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "eks_kafka" {
  count                        = local.eks_enabled && local.msk_enabled ? 1 : 0
  security_group_id            = aws_security_group.kafka[0].id
  description                  = "Kafka (TLS, IAM auth) from EKS pods"
  referenced_security_group_id = aws_eks_cluster.main[0].vpc_config[0].cluster_security_group_id
  from_port                    = 9098
  to_port                      = 9098
  ip_protocol                  = "tcp"
}

# The deploy role may install the chart in the app namespace, and nothing else.
resource "aws_eks_access_entry" "deploy" {
  count         = local.eks_enabled && var.kubernetes.deploy_role_arn != "" ? 1 : 0
  cluster_name  = aws_eks_cluster.main[0].name
  principal_arn = var.kubernetes.deploy_role_arn
  tags          = local.tags
}

resource "aws_eks_access_policy_association" "deploy" {
  count         = local.eks_enabled && var.kubernetes.deploy_role_arn != "" ? 1 : 0
  cluster_name  = aws_eks_cluster.main[0].name
  principal_arn = aws_eks_access_entry.deploy[0].principal_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSAdminPolicy"
  access_scope {
    type       = "namespace"
    namespaces = [var.kubernetes.namespace]
  }
}
