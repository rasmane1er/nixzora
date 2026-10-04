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
variable "oncall_webhook_url" {
  description = "Paging service integration URL (p9-11). Keep it in the tfvars file, not in git."
  type        = string
  default     = null
  sensitive   = true
}
variable "oncall_sms_numbers" {
  description = "Phone numbers (E.164) texted for every alarm (p9-11)."
  type        = list(string)
  default     = []
}
variable "backup_copy_region" {
  description = "Second region for backup copies (p9-10). null: no copy."
  type        = string
  default     = "us-west-2"
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

# Region that receives copies of the backups (p9-10). Used only when backup_copy_region is set.
provider "aws" {
  alias  = "backup_copy"
  region = coalesce(var.backup_copy_region, var.aws_region)
  default_tags {
    tags = { Project = "nixzora", Environment = "production", ManagedBy = "terraform" }
  }
}

module "platform" {
  source    = "../../modules/platform"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1, aws.backup_copy = aws.backup_copy }

  environment        = "production"
  backup_copy_region = var.backup_copy_region
  oncall_webhook_url = var.oncall_webhook_url
  oncall_sms_numbers = var.oncall_sms_numbers
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
  # Payments and payouts go through Stripe (module defaults). The app secret needs Stripe keys
  # before the first deploy: test keys for the smoke test, live keys at launch (p9-03).
  # Staging owns the SES identity, DKIM, DMARC and MAIL FROM records for the shared domain.
  email_domain_owner = false
  app_config = merge({
    TAX_RATES_BPS     = "MD:600"
    SHIPPING_PROVIDER = "none"
  }, var.sign_in_client_ids)
  mobile_app_links = var.mobile_app_links
}

variable "mobile_app_links" {
  description = "App identities for universal links / App Links (the store app, not the Preview build)."
  type = object({
    ios_app_ids               = list(string)
    android_package           = string
    android_cert_fingerprints = list(string)
  })
  default = {
    ios_app_ids               = ["7HD2Z858BV.com.nixzora.shop"]
    android_package           = "com.nixzora.shop"
    android_cert_fingerprints = []
  }
}

variable "sign_in_client_ids" {
  description = "Public client ids for Sign in with Google / Apple. Empty hides the buttons: add them once the production domain is an authorized origin and return URL in Google Cloud and Apple (docs/runbooks/first-deploy.md)."
  type        = map(string)
  default     = {}
  validation {
    condition = alltrue([for key in keys(var.sign_in_client_ids) : contains(
      ["GOOGLE_WEB_CLIENT_ID", "GOOGLE_IOS_CLIENT_ID", "GOOGLE_ANDROID_CLIENT_ID", "APPLE_SERVICES_ID", "APPLE_BUNDLE_IDS"], key
    )])
    error_message = "Only Google / Apple sign-in client id settings belong here."
  }
}

output "platform" {
  value = module.platform
}
