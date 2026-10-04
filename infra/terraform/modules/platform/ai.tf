# ───────────── AI service (ADR-0016) ─────────────
# The only task that calls model providers (Anthropic, Voyage) and holds their keys. Stateless:
# no database or Redis traffic of its own. Runs the API image with dist/ai-main.js, no load
# balancer, reachable at http://ai.<prefix>.internal:4200 from tasks in the apps security group
# with the internal API key. Enabled by adding "ai" to var.services.

locals {
  ai_enabled = contains(keys(var.services), "ai")
  ai_port    = 4200
  ai_url     = "http://ai.${local.prefix}.internal:${local.ai_port}"
}

resource "aws_service_discovery_service" "ai" {
  count = local.ai_enabled ? 1 : 0
  name  = "ai"
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

resource "aws_vpc_security_group_ingress_rule" "apps_ai" {
  count                        = local.ai_enabled ? 1 : 0
  security_group_id            = aws_security_group.apps.id
  description                  = "AI service from the API and search"
  referenced_security_group_id = aws_security_group.apps.id
  from_port                    = local.ai_port
  to_port                      = local.ai_port
  ip_protocol                  = "tcp"
}

resource "aws_cloudwatch_log_group" "ai" {
  count             = local.ai_enabled ? 1 : 0
  name              = "/${var.name}/${var.environment}/ai"
  retention_in_days = var.environment == "production" ? 90 : 14
  tags              = local.tags
}

# Calls external model APIs only; needs no AWS permissions of its own.
resource "aws_iam_role" "ai_task" {
  count              = local.ai_enabled ? 1 : 0
  name               = "${local.prefix}-ai-task"
  assume_role_policy = data.aws_iam_policy_document.app_assume.json
  tags               = local.tags
}

resource "aws_ecs_task_definition" "ai" {
  count                    = local.ai_enabled ? 1 : 0
  family                   = "${local.prefix}-ai"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.services["ai"].cpu
  memory                   = var.services["ai"].memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.ai_task[0].arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }
  container_definitions = jsonencode(concat([{
    name         = "ai"
    image        = "${var.image_repositories.api}:${var.image_tag}"
    essential    = true
    command      = ["node", "--enable-source-maps", "dist/ai-main.js"]
    portMappings = [{ containerPort = local.ai_port, protocol = "tcp" }]
    environment = [for k, v in merge(local.api_environment, { AI_PORT = tostring(local.ai_port) }) :
      { name = k, value = v } if !contains(["AI_SERVICE_URL", "SEARCH_SERVICE_URL"], k)
    ]
    # The shared configuration secrets (the API's start-up checks need them) plus the provider keys.
    secrets = concat(local.base_secrets, local.ai_secrets)
    healthCheck = {
      command     = ["CMD", "node", "-e", "fetch('http://127.0.0.1:${local.ai_port}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 20
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ai[0].name
        awslogs-region        = data.aws_region.current.region
        awslogs-stream-prefix = "ai"
      }
    }
    linuxParameters = { initProcessEnabled = true }
    }],
    local.amp_enabled ? [local.metrics_sidecar["ai"]] : [],
  ))
  tags = local.tags
}

resource "aws_ecs_service" "ai" {
  count                  = local.ai_enabled ? 1 : 0
  name                   = "ai"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.ai[0].arn
  desired_count          = var.services["ai"].desired_count
  launch_type            = "FARGATE"
  enable_execute_command = false
  propagate_tags         = "SERVICE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.apps.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.ai[0].arn
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

resource "aws_appautoscaling_target" "ai" {
  count              = local.ai_enabled ? 1 : 0
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.ai[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.services["ai"].desired_count
  max_capacity       = var.services["ai"].max_count
}

resource "aws_appautoscaling_policy" "ai_cpu" {
  count              = local.ai_enabled ? 1 : 0
  name               = "${local.prefix}-ai-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.ai[0].service_namespace
  resource_id        = aws_appautoscaling_target.ai[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ai[0].scalable_dimension
  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
