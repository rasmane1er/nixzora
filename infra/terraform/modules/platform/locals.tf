data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  prefix = "${var.name}-${var.environment}"
  # production: nixzora.com, api.nixzora.com …  staging: staging.nixzora.com, api.staging.nixzora.com …
  base = var.environment == "production" ? var.domain_name : "${var.environment}.${var.domain_name}"
  hosts = {
    storefront = local.base
    api        = "api.${local.base}"
    admin      = "ops.${local.base}"
    media      = "media.${local.base}"
  }
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  ports = {
    api        = 4000
    storefront = 3000
    admin      = 3001
  }
  tags = {
    Project     = var.name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
