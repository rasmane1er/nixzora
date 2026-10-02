# One-time, account-level setup (run locally with admin credentials, state kept locally
# or moved into the bucket it creates):
#   - S3 bucket for Terraform state (native S3 locking, no DynamoDB table needed)
#   - ECR repositories shared by staging and production (the same image is promoted)
#   - GitHub Actions OIDC trust and a least-privilege deploy role (no long-lived AWS keys)
terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.14"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "name" {
  type    = string
  default = "nixzora"
}

variable "github_repository" {
  description = "owner/repo allowed to deploy, e.g. rganemtore/nixzora."
  type        = string
}

variable "github_repository_ids" {
  description = <<-EOT
    Numeric GitHub owner and repository ids. GitHub's OIDC tokens identify a repository as
    "repo:owner@OWNER_ID/name@REPO_ID:…"; ids never change hands, so a renamed or re-registered
    account with the same name cannot deploy. Find them with:
    curl -s https://api.github.com/repos/OWNER/REPO | jq '.owner.id, .id'
  EOT
  type        = object({ owner_id = string, repo_id = string })
  default     = null
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = { Project = var.name, ManagedBy = "terraform", Stack = "bootstrap" }
  }
}

data "aws_caller_identity" "current" {}

# ───────────── Terraform state ─────────────

resource "aws_s3_bucket" "state" {
  bucket = "${var.name}-terraform-state-${data.aws_caller_identity.current.account_id}"
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ───────────── Container images ─────────────

resource "aws_ecr_repository" "app" {
  for_each             = toset(["api", "storefront", "admin"])
  name                 = "${var.name}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each   = aws_ecr_repository.app
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 50 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 50
      }
      action = { type = "expire" }
    }]
  })
}

# ───────────── GitHub Actions deploy role ─────────────

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

locals {
  github_owner = split("/", var.github_repository)[0]
  github_name  = split("/", var.github_repository)[1]
  github_subjects = concat(
    [var.github_repository],
    var.github_repository_ids == null ? [] : [
      "${local.github_owner}@${var.github_repository_ids.owner_id}/${local.github_name}@${var.github_repository_ids.repo_id}",
    ],
  )
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Only the main branch and the protected environments of this repository, in both the
    # name-based and the immutable-id subject formats GitHub issues.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        for pair in setproduct(local.github_subjects, ["ref:refs/heads/main", "environment:staging", "environment:production"]) :
        "repo:${pair[0]}:${pair[1]}"
      ]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

resource "aws_iam_role_policy" "deploy" {
  role = aws_iam_role.deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "EcrLogin"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "EcrPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CompleteLayerUpload",
          "ecr:DescribeImages", "ecr:GetDownloadUrlForLayer", "ecr:InitiateLayerUpload",
          "ecr:PutImage", "ecr:UploadLayerPart",
        ]
        Resource = [for repo in aws_ecr_repository.app : repo.arn]
      },
      {
        Sid    = "EcsDeploy"
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices", "ecs:DescribeTaskDefinition", "ecs:DescribeTasks",
          "ecs:RegisterTaskDefinition", "ecs:RunTask", "ecs:UpdateService", "ecs:ListTasks",
        ]
        Resource = "*"
      },
      {
        Sid      = "PassTaskRoles"
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name}-*"
        Condition = {
          StringEquals = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" }
        }
      },
      {
        Sid      = "MigrationLogs"
        Effect   = "Allow"
        Action   = ["logs:GetLogEvents", "logs:FilterLogEvents"]
        Resource = "arn:aws:logs:*:${data.aws_caller_identity.current.account_id}:log-group:/${var.name}/*"
      },
    ]
  })
}

output "state_bucket" {
  value = aws_s3_bucket.state.id
}

output "ecr_repositories" {
  value = { for k, repo in aws_ecr_repository.app : k => repo.repository_url }
}

output "deploy_role_arn" {
  description = "Save as the AWS_DEPLOY_ROLE_ARN secret in GitHub."
  value       = aws_iam_role.deploy.arn
}
