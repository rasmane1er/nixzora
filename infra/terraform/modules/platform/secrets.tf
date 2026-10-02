# One JSON secret per environment for application keys. Terraform creates it with blank
# values (and a random order-link secret); real values are set once with the AWS CLI
# (see docs/runbooks/first-deploy.md) and never pass through Terraform state afterwards.
resource "random_password" "order_link" {
  length  = 64
  special = false
}

locals {
  app_secret_keys = [
    "JWT_PRIVATE_KEY",
    "JWT_PUBLIC_KEY",
    "MFA_ENCRYPTION_KEY",
    "ORDER_LINK_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "EASYPOST_API_KEY",
    "EASYPOST_WEBHOOK_SECRET",
    "EXPO_ACCESS_TOKEN",
  ]
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name}/${var.environment}/app"
  description             = "NIXZORA ${var.environment} application keys"
  recovery_window_in_days = var.deletion_protection ? 30 : 0
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "app_initial" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(merge(
    { for key in local.app_secret_keys : key => "" },
    { ORDER_LINK_SECRET = random_password.order_link.result },
  ))
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "${var.name}/${var.environment}/redis-auth"
  recovery_window_in_days = var.deletion_protection ? 30 : 0
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = random_password.redis.result
}

# Shared by the API, storefront and Ops Center: lets the web apps relay the visitor's IP to the
# API's rate limiter and audit log. Fully managed (and rotated) by Terraform.
resource "random_password" "internal_api_key" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "internal" {
  name                    = "${var.name}/${var.environment}/internal-api-key"
  description             = "NIXZORA ${var.environment} key for web app to API calls"
  recovery_window_in_days = var.deletion_protection ? 30 : 0
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "internal" {
  secret_id     = aws_secretsmanager_secret.internal.id
  secret_string = random_password.internal_api_key.result
}

# Model provider keys (ADR-0009). Created blank: the AI layer runs on its free local drivers
# until keys are set with the AWS CLI and AI_DRIVER / EMBEDDINGS_DRIVER are switched.
locals {
  ai_secret_keys = ["ANTHROPIC_API_KEY", "VOYAGE_API_KEY"]
}

resource "aws_secretsmanager_secret" "ai" {
  name                    = "${var.name}/${var.environment}/ai"
  description             = "NIXZORA ${var.environment} model provider keys"
  recovery_window_in_days = var.deletion_protection ? 30 : 0
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "ai_initial" {
  secret_id     = aws_secretsmanager_secret.ai.id
  secret_string = jsonencode({ for key in local.ai_secret_keys : key => "" })
  lifecycle {
    ignore_changes = [secret_string]
  }
}
