resource "aws_sns_topic" "alarms" {
  name = "${local.prefix}-alarms"
  tags = local.tags
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

locals {
  alarms = {
    # SES reviews accounts above 5% bounces or 0.1% complaints; warn well before (p9-02).
    ses-bounce-rate = {
      namespace   = "AWS/SES"
      metric      = "Reputation.BounceRate"
      stat        = "Average"
      threshold   = 0.02
      dimensions  = {}
      description = "Email bounce rate above 2% (SES reviews accounts at 5%)"
    }
    ses-complaint-rate = {
      namespace   = "AWS/SES"
      metric      = "Reputation.ComplaintRate"
      stat        = "Average"
      threshold   = 0.0005
      dimensions  = {}
      description = "Spam complaint rate above 0.05% (SES reviews accounts at 0.1%)"
    }
    alb-5xx = {
      namespace   = "AWS/ApplicationELB"
      metric      = "HTTPCode_Target_5XX_Count"
      stat        = "Sum"
      threshold   = 20
      dimensions  = { LoadBalancer = aws_lb.main.arn_suffix }
      description = "More than 20 server errors in 5 minutes"
    }
    alb-latency = {
      namespace   = "AWS/ApplicationELB"
      metric      = "TargetResponseTime"
      stat        = "p95"
      threshold   = 2
      dimensions  = { LoadBalancer = aws_lb.main.arn_suffix }
      description = "p95 response time above 2 seconds"
    }
    api-unhealthy = {
      namespace   = "AWS/ApplicationELB"
      metric      = "UnHealthyHostCount"
      stat        = "Maximum"
      threshold   = 0
      dimensions  = { LoadBalancer = aws_lb.main.arn_suffix, TargetGroup = aws_lb_target_group.app["api"].arn_suffix }
      description = "An API task is failing health checks"
    }
    db-cpu = {
      namespace   = "AWS/RDS"
      metric      = "CPUUtilization"
      stat        = "Average"
      threshold   = 80
      dimensions  = { DBInstanceIdentifier = aws_db_instance.main.identifier }
      description = "Database CPU above 80%"
    }
    db-storage = {
      namespace   = "AWS/RDS"
      metric      = "FreeStorageSpace"
      stat        = "Minimum"
      threshold   = 2 * 1024 * 1024 * 1024
      comparison  = "LessThanThreshold"
      dimensions  = { DBInstanceIdentifier = aws_db_instance.main.identifier }
      description = "Less than 2 GB of database storage left"
    }
    redis-memory = {
      namespace   = "AWS/ElastiCache"
      metric      = "DatabaseMemoryUsagePercentage"
      stat        = "Maximum"
      threshold   = 80
      dimensions  = { ReplicationGroupId = aws_elasticache_replication_group.main.id }
      description = "Redis memory above 80%"
    }
    waf-blocks = {
      namespace   = "AWS/WAFV2"
      metric      = "BlockedRequests"
      stat        = "Sum"
      threshold   = 1000
      dimensions  = { WebACL = aws_wafv2_web_acl.main.name, Region = data.aws_region.current.region, Rule = "ALL" }
      description = "WAF blocked more than 1000 requests in 5 minutes (possible attack)"
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "main" {
  for_each            = local.alarms
  alarm_name          = "${local.prefix}-${each.key}"
  alarm_description   = each.value.description
  namespace           = each.value.namespace
  metric_name         = each.value.metric
  dimensions          = each.value.dimensions
  statistic           = contains(["Sum", "Average", "Minimum", "Maximum"], each.value.stat) ? each.value.stat : null
  extended_statistic  = contains(["Sum", "Average", "Minimum", "Maximum"], each.value.stat) ? null : each.value.stat
  period              = 300
  evaluation_periods  = 1
  threshold           = each.value.threshold
  comparison_operator = lookup(each.value, "comparison", "GreaterThanThreshold")
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  tags                = local.tags
}
