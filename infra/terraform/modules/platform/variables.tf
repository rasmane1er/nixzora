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
    # Remove to search inside the API instead of a separate service (ADR-0015).
    search = { cpu = 512, memory = 1024, desired_count = 2, max_count = 6 }
    # Remove to call model providers from the API and search directly (ADR-0016).
    ai = { cpu = 256, memory = 512, desired_count = 2, max_count = 4 }
    # Remove to run emails, push and other background jobs inside the API (ADR-0017).
    worker = { cpu = 256, memory = 512, desired_count = 1, max_count = 3 }
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

variable "redirect_hosts" {
  description = "Extra names that redirect (302) to this environment's storefront, e.g. the bare domain before production exists."
  type        = list(string)
  default     = []
}

variable "event_streaming" {
  description = <<-EOT
    Kafka on Amazon MSK, fed by the outbox (ADR-0020). Off by default: two kafka.t3.small brokers
    cost roughly 70 USD a month. When on, the worker streams every outbox event to Kafka and, with
    search_index_events = "kafka", the search service indexes products from the product topic.
  EOT
  type = object({
    enabled             = bool
    instance_type       = optional(string, "kafka.t3.small")
    brokers_per_az      = optional(number, 1)
    volume_gb           = optional(number, 20)
    kafka_version       = optional(string, "3.6.0")
    retention_hours     = optional(number, 168)
    search_index_events = optional(string, "kafka")
  })
  default = { enabled = false }

  validation {
    condition     = contains(["outbox", "kafka"], var.event_streaming.search_index_events)
    error_message = "search_index_events is \"outbox\" or \"kafka\"."
  }
}

variable "kubernetes" {
  description = <<-EOT
    EKS in Auto Mode, as an alternative to ECS for the same images (ADR-0021). Off by default:
    the control plane is about 73 USD a month, plus nodes and the Auto Mode fee. The Helm chart
    in infra/helm/nixzora deploys the apps; the ECS services keep running until DNS is switched.
  EOT
  type = object({
    enabled             = bool
    version             = optional(string, "1.33")
    namespace           = optional(string, "nixzora")
    release             = optional(string, "nixzora")
    public_access_cidrs = optional(list(string), ["0.0.0.0/0"])
    # IAM role (e.g. the GitHub Actions deploy role) allowed to install the chart.
    deploy_role_arn = optional(string, "")
  })
  default = { enabled = false }
}

variable "db_read_replica" {
  description = <<-EOT
    A PostgreSQL read replica for the public catalog and recommendations (ADR-0022). Off by
    default: it costs about as much as the primary instance (db.t4g.micro: ~15 USD a month).
  EOT
  type = object({
    enabled        = bool
    instance_class = optional(string)
  })
  default = { enabled = false }
}

variable "observability" {
  description = <<-EOT
    Prometheus metrics in AWS (ADR-0023). With managed_prometheus, an Amazon Managed Service for
    Prometheus workspace stores the metrics, evaluates the SLO and operational rules from
    infra/observability, and sends alerts to the alarm email; an ADOT collector next to each
    API-image task scrapes its metrics port. Off by default (a few USD a month at staging volume).
  EOT
  type = object({
    managed_prometheus = bool
    collector_image    = optional(string, "public.ecr.aws/aws-observability/aws-otel-collector:v0.40.0")
  })
  default = { managed_prometheus = false }
}

variable "media_malware_scan" {
  description = "Scan uploads with Amazon GuardDuty Malware Protection for S3 before the API accepts them (ADR-0025). Billed per GB scanned."
  type        = bool
  default     = true
}

variable "backup_copy_region" {
  description = "Second AWS region that receives a copy of every AWS Backup recovery point (p9-10), for a regional outage. null: no copy. The aws.backup_copy provider must point at this region."
  type        = string
  default     = null
}
