# ───────────── PostgreSQL ─────────────

resource "aws_db_subnet_group" "main" {
  name       = local.prefix
  subnet_ids = aws_subnet.private[*].id
  tags       = local.tags
}

resource "aws_db_parameter_group" "main" {
  name   = "${local.prefix}-pg16"
  family = "postgres16"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }
  tags = local.tags
}

resource "aws_db_instance" "main" {
  identifier     = local.prefix
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class
  db_name        = "nixzora"
  username       = "nixzora_app"
  # RDS keeps the password in Secrets Manager and rotates it; tasks read it from there.
  manage_master_user_password = true

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 5
  storage_type          = "gp3"
  storage_encrypted     = true

  multi_az               = var.db_multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.data.id]
  parameter_group_name   = aws_db_parameter_group.main.name
  publicly_accessible    = false

  backup_retention_period         = var.backup_retention_days
  backup_window                   = "07:00-08:00"
  maintenance_window              = "sun:08:30-sun:09:30"
  copy_tags_to_snapshot           = true
  deletion_protection             = var.deletion_protection
  skip_final_snapshot             = !var.deletion_protection
  final_snapshot_identifier       = var.deletion_protection ? "${local.prefix}-final" : null
  auto_minor_version_upgrade      = true
  performance_insights_enabled    = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  tags                            = local.tags
}

# ───────────── Redis (carts, sessions throttling, locks) ─────────────

resource "random_password" "redis" {
  length  = 48
  special = false
}

resource "aws_elasticache_subnet_group" "main" {
  name       = local.prefix
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = local.prefix
  description                = "NIXZORA ${var.environment} cache"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.db_multi_az ? 2 : 1
  automatic_failover_enabled = var.db_multi_az
  multi_az_enabled           = var.db_multi_az
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.data.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis.result
  snapshot_retention_limit   = var.environment == "production" ? 3 : 0
  apply_immediately          = true
  tags                       = local.tags
}
