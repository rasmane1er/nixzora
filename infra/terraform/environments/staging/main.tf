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
  default     = null
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

variable "managed_prometheus_enabled" {
  description = "Amazon Managed Service for Prometheus with SLO alerts (ADR-0023). A few USD a month at staging volume."
  type        = bool
  default     = false
}

variable "db_read_replica_enabled" {
  description = "A PostgreSQL read replica for catalog reads (ADR-0022). About 15 USD a month at db.t4g.micro."
  type        = bool
  default     = false
}

variable "kubernetes_enabled" {
  description = "EKS Auto Mode next to ECS (ADR-0021). About 73 USD a month for the control plane, plus nodes."
  type        = bool
  default     = false
}

variable "event_streaming_enabled" {
  description = "Kafka on Amazon MSK (ADR-0020). About 70 USD a month: two kafka.t3.small brokers."
  type        = bool
  default     = false
}

variable "mobile_app_links" {
  description = "App identities for universal links / App Links (see docs/runbooks/mobile-release.md)."
  type = object({
    ios_app_ids               = list(string)
    android_package           = string
    android_cert_fingerprints = list(string)
  })
  default = {
    ios_app_ids     = ["7HD2Z858BV.com.nixzora.shop.preview"]
    android_package = "com.nixzora.shop.preview"
    # Play Console > App integrity: Google's app signing key (what Play installs are signed with)
    # and the EAS upload key (builds installed straight from Expo).
    android_cert_fingerprints = [
      "70:C5:BB:A9:43:EF:C9:2A:70:0A:79:89:AF:57:79:FA:C1:C8:26:64:2A:F6:34:82:B4:D2:71:10:67:E3:92:71",
      "1F:17:25:CB:0D:B3:5C:DB:8C:B1:AF:D6:8B:E6:73:20:60:99:89:1B:D2:28:91:AA:52:0D:42:29:00:94:E5:B6",
    ]
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

# Region that receives copies of the backups (p9-10). Used only when backup_copy_region is set.
provider "aws" {
  alias  = "backup_copy"
  region = coalesce(var.backup_copy_region, var.aws_region)
  default_tags {
    tags = { Project = "nixzora", Environment = "staging", ManagedBy = "terraform" }
  }
}

module "platform" {
  source    = "../../modules/platform"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1, aws.backup_copy = aws.backup_copy }

  environment        = "staging"
  backup_copy_region = var.backup_copy_region
  oncall_webhook_url = var.oncall_webhook_url
  oncall_sms_numbers = var.oncall_sms_numbers
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
    # Stripe sandbox checkout (test cards, Google Pay / Apple Pay test mode; no real money).
    # The sk_test_/pk_test_/whsec_ keys live in the app secret. Seller payouts stay simulated
    # (ALLOW_TEST_PAYMENTS) because the demo sellers have no Stripe Connect accounts.
    PAYMENTS_PROVIDER   = "stripe"
    PAYOUTS_PROVIDER    = "fake"
    ALLOW_TEST_PAYMENTS = "true"
  }, var.sign_in_client_ids)
  mobile_app_links = var.mobile_app_links
  # Postmaster Tools (rasmane1er@gmail.com) → nixzora.com → Verify domain. Public values.
  google_postmaster_verification = {
    label  = "wim6cd52ylel"
    target = "gv-ozuriy7rkgjfq7.dv.googlehosted.com"
  }
  event_streaming = { enabled = var.event_streaming_enabled }
  kubernetes      = { enabled = var.kubernetes_enabled }
  db_read_replica = { enabled = var.db_read_replica_enabled }
  observability   = { managed_prometheus = var.managed_prometheus_enabled }

  # Until production exists, the main domain sends visitors to the staging demo. Production
  # takes these names over: apply staging with -var redirect_main_domain=false first
  # (docs/runbooks/first-deploy.md, "Production").
  redirect_hosts = var.redirect_main_domain ? [var.domain_name, "www.${var.domain_name}"] : []
}

output "platform" {
  value = module.platform
}

variable "redirect_main_domain" {
  description = "Send visitors of the main domain (and www) to this staging site. false once production serves them."
  type        = bool
  default     = true
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
