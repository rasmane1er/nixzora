# ───────────── Search service (ADR-0015) ─────────────
# Keyword + semantic search and indexing, split out of the API. It runs the API image with a
# different command, has no load balancer and is reachable only inside the VPC, at
# http://search.<prefix>.internal:4100, by tasks in the apps security group holding the
# internal API key. Enabled by adding "search" to var.services; without it the API searches
# in-process as before.

locals {
  search_enabled = contains(keys(var.services), "search")
  search_port    = 4100
  search_url     = "http://search.${local.prefix}.internal:${local.search_port}"
}

resource "aws_service_discovery_private_dns_namespace" "internal" {
  count       = local.search_enabled ? 1 : 0
  name        = "${local.prefix}.internal"
  description = "Private service names for ${local.prefix}"
  vpc         = aws_vpc.main.id
  tags        = local.tags
}

resource "aws_service_discovery_service" "search" {
  count = local.search_enabled ? 1 : 0
  name  = "search"
  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.internal[0].id
    routing_policy = "MULTIVALUE"
    dns_records {
      type = "A"
      ttl  = 10
    }
  }
  health_check_custom_config {
    failure_threshold = 1
  }
  tags = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "apps_search" {
  count                        = local.search_enabled ? 1 : 0
  security_group_id            = aws_security_group.apps.id
  description                  = "Search service from the API"
  referenced_security_group_id = aws_security_group.apps.id
  from_port                    = local.search_port
  to_port                      = local.search_port
  ip_protocol                  = "tcp"
}

resource "aws_cloudwatch_log_group" "search" {
  count             = local.search_enabled ? 1 : 0
  name              = "/${var.name}/${var.environment}/search"
  retention_in_days = var.environment == "production" ? 90 : 14
  tags              = local.tags
}

# Reads the catalog and writes the search index; needs no AWS permissions of its own.
resource "aws_iam_role" "search_task" {
  count              = local.search_enabled ? 1 : 0
  name               = "${local.prefix}-search-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}

resource "aws_ecs_task_definition" "search" {
  count                    = local.search_enabled ? 1 : 0
  family                   = "${local.prefix}-search"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.services["search"].cpu
  memory                   = var.services["search"].memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.search_task[0].arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }
  container_definitions = jsonencode([{
    name         = "search"
    image        = "${var.image_repositories.api}:${var.image_tag}"
    essential    = true
    command      = ["node", "--enable-source-maps", "dist/search-main.js"]
    portMappings = [{ containerPort = local.search_port, protocol = "tcp" }]
    environment = [for k, v in merge(local.api_environment, { SEARCH_PORT = tostring(local.search_port) }) :
      { name = k, value = v } if k != "SEARCH_SERVICE_URL"
    ]
    secrets = local.api_secrets
    healthCheck = {
      command     = ["CMD", "node", "-e", "fetch('http://127.0.0.1:${local.search_port}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.search[0].name
        awslogs-region        = data.aws_region.current.region
        awslogs-stream-prefix = "search"
      }
    }
    linuxParameters = { initProcessEnabled = true }
  }])
  tags = local.tags
}

resource "aws_ecs_service" "search" {
  count                  = local.search_enabled ? 1 : 0
  name                   = "search"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.search[0].arn
  desired_count          = var.services["search"].desired_count
  launch_type            = "FARGATE"
  enable_execute_command = false
  propagate_tags         = "SERVICE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.apps.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.search[0].arn
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }
  tags = local.tags
}

resource "aws_appautoscaling_target" "search" {
  count              = local.search_enabled ? 1 : 0
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.search[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.services["search"].desired_count
  max_capacity       = var.services["search"].max_count
}

resource "aws_appautoscaling_policy" "search_cpu" {
  count              = local.search_enabled ? 1 : 0
  name               = "${local.prefix}-search-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.search[0].service_namespace
  resource_id        = aws_appautoscaling_target.search[0].resource_id
  scalable_dimension = aws_appautoscaling_target.search[0].scalable_dimension
  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
