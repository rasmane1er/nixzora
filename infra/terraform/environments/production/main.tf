# NIXZORA production. First run:
#   tofu init -backend-config=backend.hcl   (or terraform init …)
#   tofu apply -var-file=production.tfvars
terraform {
  required_version = ">= 1.10.0"
  backend "s3" {
    key          = "production/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.14"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "domain_name" {
  type = string
}
variable "hosted_zone_id" {
  type = string
}
variable "image_repositories" {
  type = object({ api = string, storefront = string, admin = string })
}
variable "image_tag" {
  description = "Set by the CD workflow; the first apply can use any pushed tag."
  type        = string
}
variable "alarm_email" {
  type = string
}
variable "ops_allowed_cidrs" {
  type    = list(string)
  default = []
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = { Project = "nixzora", Environment = "production", ManagedBy = "terraform" }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = { Project = "nixzora", Environment = "production", ManagedBy = "terraform" }
  }
}

module "platform" {
  source    = "../../modules/platform"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }

  environment        = "production"
  domain_name        = var.domain_name
  hosted_zone_id     = var.hosted_zone_id
  image_repositories = var.image_repositories
  image_tag          = var.image_tag
  alarm_email        = var.alarm_email
  ops_allowed_cidrs  = var.ops_allowed_cidrs

  nat_gateway_count     = 2
  db_instance_class     = "db.t4g.medium"
  db_multi_az           = true
  backup_retention_days = 14
  redis_node_type       = "cache.t4g.small"
  deletion_protection   = true
  app_config = {
    TAX_RATES_BPS     = "MD:600"
    SHIPPING_PROVIDER = "none"
  }
}

output "platform" {
  value = module.platform
}
