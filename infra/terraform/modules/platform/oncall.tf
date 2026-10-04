# On-call (p9-11): alarms reach a phone, and the site is checked from outside AWS's region.
#
# Every alarm already emails alarm_email (monitoring.tf). With oncall_webhook_url, the same
# alarms also page through a paging service (PagerDuty, Opsgenie, incident.io: they push to the
# phone app, call or text). oncall_sms_numbers texts directly through SNS.

locals {
  # Whether a webhook is set is not secret; the URL itself is.
  oncall_paging = nonsensitive(var.oncall_webhook_url != null)
  outside_checks = {
    store = { host = local.hosts.storefront, path = "/" }
    api   = { host = local.hosts.api, path = "/api/v1/health" }
  }
  oncall_sms = toset(var.oncall_sms_numbers)
}

resource "aws_sns_topic_subscription" "alarms_pager" {
  count                  = local.oncall_paging ? 1 : 0
  topic_arn              = aws_sns_topic.alarms.arn
  protocol               = "https"
  endpoint               = var.oncall_webhook_url
  endpoint_auto_confirms = true
}

resource "aws_sns_topic_subscription" "alarms_sms" {
  for_each  = local.oncall_sms
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "sms"
  endpoint  = each.value
}

# ── Checks from outside: Route 53 health checks probe from several AWS regions worldwide ─────
# Their metrics live in us-east-1, so their alarms and topic do too.

resource "aws_route53_health_check" "outside" {
  for_each          = local.outside_checks
  fqdn              = each.value.host
  port              = 443
  type              = "HTTPS"
  resource_path     = each.value.path
  request_interval  = 30
  failure_threshold = 3
  measure_latency   = true
  tags              = merge(local.tags, { Name = "${local.prefix}-${each.key}" })
}

resource "aws_sns_topic" "outside_alarms" {
  provider = aws.us_east_1
  name     = "${local.prefix}-outside-alarms"
  tags     = local.tags
}

resource "aws_sns_topic_subscription" "outside_email" {
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.outside_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_sns_topic_subscription" "outside_pager" {
  count                  = local.oncall_paging ? 1 : 0
  provider               = aws.us_east_1
  topic_arn              = aws_sns_topic.outside_alarms.arn
  protocol               = "https"
  endpoint               = var.oncall_webhook_url
  endpoint_auto_confirms = true
}

resource "aws_sns_topic_subscription" "outside_sms" {
  for_each  = local.oncall_sms
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.outside_alarms.arn
  protocol  = "sms"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "outside" {
  for_each            = local.outside_checks
  provider            = aws.us_east_1
  alarm_name          = "${local.prefix}-outside-${each.key}"
  alarm_description   = "The ${each.key == "api" ? "API" : "store"} fails health checks from outside AWS's region for 2 minutes"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  dimensions          = { HealthCheckId = aws_route53_health_check.outside[each.key].id }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.outside_alarms.arn]
  ok_actions          = [aws_sns_topic.outside_alarms.arn]
  tags                = local.tags
}
