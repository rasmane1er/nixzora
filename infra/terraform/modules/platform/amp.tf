# ───────────── Prometheus metrics: Amazon Managed Service for Prometheus (ADR-0023) ─────────────
# Each API-image task (api, worker, search, ai) gets a small AWS Distro for OpenTelemetry
# collector container that scrapes the app's metrics port (9464, never behind the load balancer)
# and remote-writes to the workspace with SigV4 (the task role; no keys). The workspace runs the
# same recording and alert rules as the local stack (infra/observability/prometheus/rules) and
# sends alerts to the existing alarm topic. Grafana (local, or Amazon Managed Grafana) reads the
# workspace with SigV4 and imports the dashboards from infra/observability/grafana/dashboards.

locals {
  amp_enabled = var.observability.managed_prometheus
  rules_dir   = "${path.module}/../../../observability/prometheus/rules"

  # The collector container for one service (merged into its task definition).
  metrics_sidecar = local.amp_enabled ? {
    for svc in ["api", "worker", "search", "ai"] : svc => {
      name      = "metrics-collector"
      image     = var.observability.collector_image
      essential = false
      cpu       = 64
      memory    = 128
      environment = [{
        name = "AOT_CONFIG_CONTENT"
        value = yamlencode({
          extensions = { sigv4auth = { region = data.aws_region.current.region, service = "aps" } }
          receivers = {
            prometheus = {
              config = {
                global = { scrape_interval = "30s" }
                scrape_configs = [{
                  job_name       = "nixzora-${svc}"
                  static_configs = [{ targets = ["localhost:9464"] }]
                }]
              }
            }
          }
          exporters = {
            prometheusremotewrite = {
              endpoint        = "${aws_prometheus_workspace.main[0].prometheus_endpoint}api/v1/remote_write"
              auth            = { authenticator = "sigv4auth" }
              external_labels = { environment = var.environment }
            }
          }
          service = {
            extensions = ["sigv4auth"]
            pipelines  = { metrics = { receivers = ["prometheus"], exporters = ["prometheusremotewrite"] } }
          }
        })
      }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.metrics_collector[0].name
          awslogs-region        = data.aws_region.current.region
          awslogs-stream-prefix = svc
        }
      }
    }
  } : {}
}

resource "aws_prometheus_workspace" "main" {
  count = local.amp_enabled ? 1 : 0
  alias = local.prefix
  tags  = local.tags
}

resource "aws_cloudwatch_log_group" "metrics_collector" {
  count             = local.amp_enabled ? 1 : 0
  name              = "/${var.name}/${var.environment}/metrics-collector"
  retention_in_days = 7
  tags              = local.tags
}

# The same rule files as the local Prometheus: one namespace per file.
resource "aws_prometheus_rule_group_namespace" "rules" {
  for_each     = local.amp_enabled ? toset(["slo", "operations"]) : toset([])
  name         = each.key
  workspace_id = aws_prometheus_workspace.main[0].id
  data         = file("${local.rules_dir}/${each.key}.yml")
}

# Alerts → the alarm topic (email), like the CloudWatch alarms.
resource "aws_prometheus_alert_manager_definition" "main" {
  count        = local.amp_enabled ? 1 : 0
  workspace_id = aws_prometheus_workspace.main[0].id
  definition = yamlencode({
    alertmanager_config = yamlencode({
      route = {
        receiver        = "sns"
        group_by        = ["alertname", "slo", "service"]
        group_wait      = "30s"
        group_interval  = "5m"
        repeat_interval = "4h"
      }
      receivers = [{
        name = "sns"
        sns_configs = [{
          topic_arn  = aws_sns_topic.alarms.arn
          sigv4      = { region = data.aws_region.current.region }
          subject    = "[{{ .CommonLabels.severity }}] {{ .CommonLabels.alertname }}"
          attributes = { severity = "{{ .CommonLabels.severity }}" }
        }]
      }]
      inhibit_rules = [{
        source_matchers = ["severity=\"page\""]
        target_matchers = ["severity=\"ticket\""]
        equal           = ["slo"]
      }]
    })
  })
}

# Managed Prometheus may publish to the alarm topic (the account keeps its own access).
data "aws_iam_policy_document" "alarms_topic" {
  count = local.amp_enabled ? 1 : 0
  statement {
    sid       = "Owner"
    actions   = ["sns:Publish", "sns:Subscribe", "sns:GetTopicAttributes", "sns:SetTopicAttributes"]
    resources = [aws_sns_topic.alarms.arn]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
  statement {
    sid       = "CloudWatchAlarms"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alarms.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
  }
  statement {
    sid       = "ManagedPrometheus"
    actions   = ["sns:Publish", "sns:GetTopicAttributes"]
    resources = [aws_sns_topic.alarms.arn]
    principals {
      type        = "Service"
      identifiers = ["aps.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_prometheus_workspace.main[0].arn]
    }
  }
}

resource "aws_sns_topic_policy" "alarms" {
  count  = local.amp_enabled ? 1 : 0
  arn    = aws_sns_topic.alarms.arn
  policy = data.aws_iam_policy_document.alarms_topic[0].json
}

# The collectors write with their task's role.
data "aws_iam_policy_document" "remote_write" {
  count = local.amp_enabled ? 1 : 0
  statement {
    actions   = ["aps:RemoteWrite"]
    resources = [aws_prometheus_workspace.main[0].arn]
  }
}

resource "aws_iam_role_policy" "remote_write" {
  for_each = local.amp_enabled ? merge(
    { api = aws_iam_role.api_task.id },
    local.search_enabled ? { search = aws_iam_role.search_task[0].id } : {},
    local.ai_enabled ? { ai = aws_iam_role.ai_task[0].id } : {},
  ) : {}
  name   = "prometheus-remote-write"
  role   = each.value
  policy = data.aws_iam_policy_document.remote_write[0].json
}
