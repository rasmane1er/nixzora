variable "name" {
  description = "Short project name used in resource names."
  type        = string
  default     = "nixzora"
}

variable "environment" {
  description = "staging or production."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "domain_name" {
  description = "Apex domain with a Route 53 public hosted zone, e.g. nixzora-demo.com."
  type        = string
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone id for domain_name."
  type        = string
}

variable "image_repositories" {
  description = "ECR repository URLs from the bootstrap stack (api, storefront, admin)."
  type = object({
    api        = string
    storefront = string
    admin      = string
  })
}

variable "image_tag" {
  description = "Image tag to run (the git SHA built by CI)."
  type        = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "az_count" {
  description = "Availability zones to spread across (2 is the minimum for RDS and the ALB)."
  type        = number
  default     = 2
}

variable "nat_gateway_count" {
  description = "1 saves money (staging); one per AZ survives an AZ outage (production)."
  type        = number
  default     = 1
}

variable "services" {
  description = "Fargate size and count per service."
  type = map(object({
    cpu           = number
    memory        = number
    desired_count = number
    max_count     = number
  }))
  default = {
    api        = { cpu = 512, memory = 1024, desired_count = 2, max_count = 6 }
    storefront = { cpu = 512, memory = 1024, desired_count = 2, max_count = 6 }
    admin      = { cpu = 256, memory = 512, desired_count = 1, max_count = 2 }
  }
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "db_allocated_storage" {
  description = "Initial storage in GB; grows automatically up to 5x."
  type        = number
  default     = 20
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "backup_retention_days" {
  description = "RDS point-in-time recovery window (1-35 days)."
  type        = number
  default     = 7
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "deletion_protection" {
  description = "Protects the database and media bucket from accidental deletion."
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Where CloudWatch alarms are emailed (confirm the SNS subscription once)."
  type        = string
}

variable "ops_allowed_cidrs" {
  description = "If set, only these networks can reach the Ops Center (e.g. your office IP/32)."
  type        = list(string)
  default     = []
}

variable "waf_rate_limit" {
  description = "Requests per 5 minutes allowed from one IP before WAF blocks it."
  type        = number
  default     = 2000
}

variable "app_config" {
  description = "Non-secret settings passed to the API (tax table, shipping, providers)."
  type        = map(string)
  default     = {}
}

variable "mobile_app_links" {
  description = "Mobile app identities for universal links (iOS) and App Links (Android). Empty lists turn the .well-known files off."
  type = object({
    ios_app_ids               = list(string)
    android_package           = string
    android_cert_fingerprints = list(string)
  })
  default = {
    ios_app_ids               = []
    android_package           = "com.nixzora.shop"
    android_cert_fingerprints = []
  }

  validation {
    condition     = alltrue([for id in var.mobile_app_links.ios_app_ids : can(regex("^[A-Z0-9]{10}\\.[a-z0-9.-]+$", id))])
    error_message = "iOS app ids look like TEAMID1234.com.nixzora.shop."
  }

  validation {
    condition = alltrue([
      for fp in var.mobile_app_links.android_cert_fingerprints : can(regex("^([0-9A-F]{2}:){31}[0-9A-F]{2}$", fp))
    ])
    error_message = "Android fingerprints are SHA-256 in AA:BB:... form (32 bytes)."
  }
}
