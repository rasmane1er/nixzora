# NIXZORA staging. First run:
#   tofu init -backend-config=backend.hcl   (or terraform init …)
#   tofu apply -var-file=staging.tfvars
terraform {
  required_version = ">= 1.10.0"
  backend "s3" {
    key          = "staging/terraform.tfstate"
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

variable "mobile_app_links" {
  description = "App identities for universal links / App Links (see docs/runbooks/mobile-release.md)."
  type = object({
    ios_app_ids               = list(string)
    android_package           = string
    android_cert_fingerprints = list(string)
  })
  default = {
    ios_app_ids               = ["7HD2Z858BV.com.nixzora.shop.preview"]
    android_package           = "com.nixzora.shop.preview"
    android_cert_fingerprints = []
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = { Project = "nixzora", Environment = "staging", ManagedBy = "terraform" }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = { Project = "nixzora", Environment = "staging", ManagedBy = "terraform" }
  }
}

module "platform" {
  source    = "../../modules/platform"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }

  environment        = "staging"
  domain_name        = var.domain_name
  hosted_zone_id     = var.hosted_zone_id
  image_repositories = var.image_repositories
  image_tag          = var.image_tag
  alarm_email        = var.alarm_email
  ops_allowed_cidrs  = var.ops_allowed_cidrs

  nat_gateway_count     = 1
  db_instance_class     = "db.t3.micro" # t4g.micro + gp3 + PG16 not orderable in us-east-1 (2026-10)
  db_multi_az           = false
  backup_retention_days = 3
  redis_node_type       = "cache.t4g.micro"
  deletion_protection   = false
  services = {
    api        = { cpu = 256, memory = 512, desired_count = 1, max_count = 2 }
    storefront = { cpu = 256, memory = 512, desired_count = 1, max_count = 2 }
    admin      = { cpu = 256, memory = 512, desired_count = 1, max_count = 1 }
    search     = { cpu = 256, memory = 512, desired_count = 1, max_count = 2 }
    ai         = { cpu = 256, memory = 512, desired_count = 1, max_count = 2 }
    worker     = { cpu = 256, memory = 512, desired_count = 1, max_count = 2 }
  }
  app_config = merge({
    TAX_RATES_BPS     = "MD:600"
    SHIPPING_PROVIDER = "none"
    # Public demo: test payments (no card, no money). Switch to "stripe" with test keys
    # (sk_test_…) in the app secret for a real Stripe checkout.
    PAYMENTS_PROVIDER   = "fake"
    ALLOW_TEST_PAYMENTS = "true"
  }, var.sign_in_client_ids)
  mobile_app_links = var.mobile_app_links

  # Until production exists, the main domain sends visitors to the staging demo. Remove this
  # line before creating production (it takes these names over).
  redirect_hosts = [var.domain_name, "www.${var.domain_name}"]
}

output "platform" {
  value = module.platform
}

variable "sign_in_client_ids" {
  description = "Public client ids for Sign in with Google / Apple (Google Cloud project nexora-66e0b, Apple team 7HD2Z858BV). Empty hides the buttons."
  type        = map(string)
  default = {
    GOOGLE_WEB_CLIENT_ID = "609981749805-vhsh4a48shs56tetot1oqqufgcsdg73b.apps.googleusercontent.com"
    GOOGLE_IOS_CLIENT_ID = "609981749805-783ngqagd0q5kn06st0h3cqkna4atsi5.apps.googleusercontent.com"
    APPLE_SERVICES_ID    = "com.nixzora.shop.web"
  }
  validation {
    condition = alltrue([for key in keys(var.sign_in_client_ids) : contains(
      ["GOOGLE_WEB_CLIENT_ID", "GOOGLE_IOS_CLIENT_ID", "GOOGLE_ANDROID_CLIENT_ID", "APPLE_SERVICES_ID", "APPLE_BUNDLE_IDS"], key
    )])
    error_message = "Only Google / Apple sign-in client id settings belong here."
  }
}
