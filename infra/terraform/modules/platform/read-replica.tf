# ───────────── PostgreSQL read replica (ADR-0022) ─────────────
# Asynchronous replica of the primary for stale-tolerant reads (public catalog, recommendations).
# The API routes those reads to it and falls back to the primary on its own when the replica is
# down or more than 30 s behind. Same credentials as the primary (replication copies them).

resource "aws_db_instance" "replica" {
  count               = var.db_read_replica.enabled ? 1 : 0
  identifier          = "${local.prefix}-replica"
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = coalesce(var.db_read_replica.instance_class, var.db_instance_class)

  storage_type           = "gp3"
  storage_encrypted      = true
  vpc_security_group_ids = [aws_security_group.data.id]
  parameter_group_name   = aws_db_parameter_group.main.name
  publicly_accessible    = false
  multi_az               = false

  # Backups come from the primary; a replica is rebuilt, not restored.
  backup_retention_period         = 0
  skip_final_snapshot             = true
  auto_minor_version_upgrade      = true
  performance_insights_enabled    = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  deletion_protection             = false
  tags                            = merge(local.tags, { Role = "read-replica" })
}

resource "aws_cloudwatch_metric_alarm" "replica_lag" {
  count               = var.db_read_replica.enabled ? 1 : 0
  alarm_name          = "${local.prefix}-db-replica-lag"
  alarm_description   = "Read replica more than 60 s behind (the API is reading the primary meanwhile)"
  namespace           = "AWS/RDS"
  metric_name         = "ReplicaLag"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.replica[0].identifier }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 60
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  tags                = local.tags
}
