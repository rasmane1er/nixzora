# ───────────── Notifications worker (ADR-0017) ─────────────
# Delivers the transactional outbox (order and return emails, push notifications, seller
# alerts, search indexing, review insights) and runs the sweepers and payouts, so the API only
# answers requests. It runs the API image with a different command and the API's task role
# (it sends the same SES email and reads the same buckets). It takes no traffic: no load
# balancer, no service name, no ingress. Enabled by adding "worker" to var.services; without it
# the API runs these jobs itself as before.

locals {
  worker_enabled = contains(keys(var.services), "worker")
  worker_port    = 4300
  worker_environment = merge(
    { for k, v in local.api_environment : k => v if k != "BACKGROUND_JOBS" },
    { WORKER_PORT = tostring(local.worker_port) },
  )
}

resource "aws_cloudwatch_log_group" "worker" {
  count             = local.worker_enabled ? 1 : 0
  name              = "/${var.name}/${var.environment}/worker"
  retention_in_days = var.environment == "production" ? 90 : 14
  tags              = local.tags
}

resource "aws_ecs_task_definition" "worker" {
  count                    = local.worker_enabled ? 1 : 0
  family                   = "${local.prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.services["worker"].cpu
  memory                   = var.services["worker"].memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.api_task.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }
  container_definitions = jsonencode(concat([{
    name        = "worker"
    image       = "${var.image_repositories.api}:${var.image_tag}"
    essential   = true
    command     = ["node", "--enable-source-maps", "dist/worker-main.js"]
    environment = [for k, v in local.worker_environment : { name = k, value = v }]
    secrets     = local.api_secrets
    healthCheck = {
      command     = ["CMD", "node", "-e", "fetch('http://127.0.0.1:${local.worker_port}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }
    # Lets the current batch finish before the task stops (outbox rows are claimed in a transaction).
    stopTimeout = 60
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.worker[0].name
        awslogs-region        = data.aws_region.current.region
        awslogs-stream-prefix = "worker"
      }
    }
    linuxParameters = { initProcessEnabled = true }
    }],
    local.amp_enabled ? [local.metrics_sidecar["worker"]] : [],
  ))
  tags = local.tags
}

resource "aws_ecs_service" "worker" {
  count                  = local.worker_enabled ? 1 : 0
  name                   = "worker"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.worker[0].arn
  desired_count          = var.services["worker"].desired_count
  launch_type            = "FARGATE"
  enable_execute_command = false
  propagate_tags         = "SERVICE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.apps.id]
    assign_public_ip = false
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

resource "aws_appautoscaling_target" "worker" {
  count              = local.worker_enabled ? 1 : 0
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.services["worker"].desired_count
  max_capacity       = var.services["worker"].max_count
}

resource "aws_appautoscaling_policy" "worker_cpu" {
  count              = local.worker_enabled ? 1 : 0
  name               = "${local.prefix}-worker-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.worker[0].service_namespace
  resource_id        = aws_appautoscaling_target.worker[0].resource_id
  scalable_dimension = aws_appautoscaling_target.worker[0].scalable_dimension
  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
