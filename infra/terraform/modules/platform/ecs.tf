resource "aws_ecs_cluster" "main" {
  name = local.prefix
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = local.tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

resource "aws_cloudwatch_log_group" "app" {
  for_each          = toset(["api", "storefront", "admin", "migrate"])
  name              = "/${var.name}/${var.environment}/${each.key}"
  retention_in_days = var.environment == "production" ? 90 : 14
  tags              = local.tags
}

# ───────────── IAM ─────────────

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# The app roles (API, search, AI, web): ECS tasks, and on Kubernetes the pods' service accounts
# through EKS Pod Identity (ADR-0021), so both platforms run with the same permissions.
data "aws_iam_policy_document" "app_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
  dynamic "statement" {
    for_each = var.kubernetes.enabled ? [1] : []
    content {
      actions = ["sts:AssumeRole", "sts:TagSession"]
      principals {
        type        = "Service"
        identifiers = ["pods.eks.amazonaws.com"]
      }
    }
  }
}

# Used by ECS itself: pull images, write logs, read the secrets it injects.
resource "aws_iam_role" "execution" {
  name               = "${local.prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.app.arn,
        aws_secretsmanager_secret.redis.arn,
        aws_secretsmanager_secret.internal.arn,
        aws_secretsmanager_secret.ai.arn,
        aws_db_instance.main.master_user_secret[0].secret_arn,
      ]
    }]
  })
}

# Used by the API code: media uploads and email. Nothing else.
resource "aws_iam_role" "api_task" {
  name               = "${local.prefix}-api-task"
  assume_role_policy = data.aws_iam_policy_document.app_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy" "api_task" {
  role = aws_iam_role.api_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "Media"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = ["${aws_s3_bucket.media.arn}/products/*", "${aws_s3_bucket.media.arn}/incoming/*"]
      },
      {
        # The malware scan result GuardDuty tags uploads with.
        Sid      = "MediaScanResult"
        Effect   = "Allow"
        Action   = ["s3:GetObjectTagging"]
        Resource = "${aws_s3_bucket.media.arn}/incoming/*"
      },
      {
        Sid      = "Email"
        Effect   = "Allow"
        Action   = ["ses:SendEmail"]
        Resource = "*"
        Condition = {
          StringEquals = { "ses:FromAddress" = "orders@${var.domain_name}" }
        }
      },
    ]
  })
}

resource "aws_iam_role" "web_task" {
  name               = "${local.prefix}-web-task"
  assume_role_policy = data.aws_iam_policy_document.app_assume.json
  tags               = local.tags
}

# ───────────── Task definitions ─────────────

locals {
  db_secret = aws_db_instance.main.master_user_secret[0].secret_arn

  api_environment = merge(
    {
      NODE_ENV              = "production"
      API_PORT              = "4000"
      LOG_LEVEL             = "info"
      APP_VERSION           = var.image_tag
      API_PUBLIC_URL        = "https://${local.hosts.api}"
      WEB_APP_URL           = "https://${local.hosts.storefront}"
      CORS_ORIGINS          = "https://${local.hosts.storefront},https://${local.hosts.admin}"
      DATABASE_HOST         = aws_db_instance.main.address
      DATABASE_PORT         = tostring(aws_db_instance.main.port)
      DATABASE_NAME         = aws_db_instance.main.db_name
      DATABASE_USER         = aws_db_instance.main.username
      DATABASE_SSL          = "verify-full"
      REDIS_HOST            = aws_elasticache_replication_group.main.primary_endpoint_address
      REDIS_TLS             = "true"
      STORAGE_DRIVER        = "s3"
      S3_BUCKET             = aws_s3_bucket.media.id
      S3_REGION             = data.aws_region.current.region
      ASSETS_BASE_URL       = "https://${local.hosts.media}"
      MEDIA_MALWARE_SCAN    = var.media_malware_scan ? "guardduty" : "off"
      MAIL_DRIVER           = "ses"
      MAIL_FROM             = "NIXZORA <orders@${var.domain_name}>"
      SES_REGION            = data.aws_region.current.region
      PAYMENTS_PROVIDER     = "stripe"
      PUSH_DRIVER           = "expo"
      PASSWORD_BREACH_CHECK = "true"
      TRUST_PROXY_HOPS      = "1"
    },
    local.search_enabled ? { SEARCH_SERVICE_URL = local.search_url } : {},
    local.ai_enabled ? { AI_SERVICE_URL = local.ai_url } : {},
    # With the notifications worker, the API leaves the background jobs to it (ADR-0017).
    local.worker_enabled ? { BACKGROUND_JOBS = "false" } : {},
    # Kafka on MSK (ADR-0020): brokers and IAM auth for the worker and the search service.
    local.msk_environment,
    # Read replica (ADR-0022): stale-tolerant reads go there.
    var.db_read_replica.enabled ? { DATABASE_REPLICA_HOST = aws_db_instance.replica[0].address } : {},
    var.app_config,
  )

  base_secrets = concat(
    [
      { name = "DATABASE_PASSWORD", valueFrom = "${local.db_secret}:password::" },
      { name = "REDIS_PASSWORD", valueFrom = aws_secretsmanager_secret.redis.arn },
    ],
    [for key in local.app_secret_keys : { name = key, valueFrom = "${aws_secretsmanager_secret.app.arn}:${key}::" }],
    [local.internal_key_secret],
  )
  ai_secrets = [for key in local.ai_secret_keys : { name = key, valueFrom = "${aws_secretsmanager_secret.ai.arn}:${key}::" }]
  # With the AI service, only it holds the model provider keys (ADR-0016).
  api_secrets = local.ai_enabled ? local.base_secrets : concat(local.base_secrets, local.ai_secrets)

  internal_key_secret = { name = "INTERNAL_API_KEY", valueFrom = aws_secretsmanager_secret.internal.arn }

  containers = {
    api = {
      image       = "${var.image_repositories.api}:${var.image_tag}"
      environment = local.api_environment
      secrets     = local.api_secrets
      role        = aws_iam_role.api_task.arn
    }
    storefront = {
      image = "${var.image_repositories.storefront}:${var.image_tag}"
      environment = {
        API_URL     = "https://${local.hosts.api}"
        WEB_APP_URL = "https://${local.hosts.storefront}"
        # Universal links / App Links: storefront URLs that open in the mobile app.
        IOS_APP_IDS               = join(",", var.mobile_app_links.ios_app_ids)
        ANDROID_PACKAGE           = var.mobile_app_links.android_package
        ANDROID_CERT_FINGERPRINTS = join(",", var.mobile_app_links.android_cert_fingerprints)
      }
      secrets = [local.internal_key_secret]
      role    = aws_iam_role.web_task.arn
    }
    admin = {
      image = "${var.image_repositories.admin}:${var.image_tag}"
      environment = {
        API_URL        = "https://${local.hosts.api}"
        STOREFRONT_URL = "https://${local.hosts.storefront}"
      }
      secrets = [local.internal_key_secret]
      role    = aws_iam_role.web_task.arn
    }
  }
}

resource "aws_ecs_task_definition" "app" {
  for_each                 = local.containers
  family                   = "${local.prefix}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.services[each.key].cpu
  memory                   = var.services[each.key].memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = each.value.role
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }
  container_definitions = jsonencode(concat([{
    name                   = each.key
    image                  = each.value.image
    essential              = true
    readonlyRootFilesystem = false
    portMappings           = [{ containerPort = local.ports[each.key], protocol = "tcp" }]
    environment            = [for k, v in each.value.environment : { name = k, value = v }]
    secrets                = each.value.secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app[each.key].name
        awslogs-region        = data.aws_region.current.region
        awslogs-stream-prefix = each.key
      }
    }
    linuxParameters = { initProcessEnabled = true }
    }],
    # Prometheus metrics collector next to the API (ADR-0023).
    each.key == "api" && local.amp_enabled ? [local.metrics_sidecar["api"]] : [],
  ))
  tags = local.tags
}

# Runs "prisma migrate deploy" once per release, before services update (see the CD workflow).
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.prefix}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.web_task.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }
  container_definitions = jsonencode([{
    name      = "migrate"
    image     = "${var.image_repositories.api}:${var.image_tag}-migrate"
    essential = true
    environment = [for k in ["DATABASE_HOST", "DATABASE_PORT", "DATABASE_NAME", "DATABASE_USER", "DATABASE_SSL"] :
      { name = k, value = local.api_environment[k] }
    ]
    secrets = [{ name = "DATABASE_PASSWORD", valueFrom = "${local.db_secret}:password::" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app["migrate"].name
        awslogs-region        = data.aws_region.current.region
        awslogs-stream-prefix = "migrate"
      }
    }
  }])
  tags = local.tags
}

# ───────────── Services ─────────────

resource "aws_ecs_service" "app" {
  for_each                          = local.containers
  name                              = each.key
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.app[each.key].arn
  desired_count                     = var.services[each.key].desired_count
  launch_type                       = "FARGATE"
  enable_execute_command            = false
  health_check_grace_period_seconds = 60
  propagate_tags                    = "SERVICE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.apps.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app[each.key].arn
    container_name   = each.key
    container_port   = local.ports[each.key]
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # The deploy workflow registers a new task-definition revision per release (based on the
  # latest one Terraform wrote) and autoscaling owns the count, so Terraform leaves both alone.
  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }
  depends_on = [aws_lb_listener.https]
  tags       = local.tags
}

resource "aws_appautoscaling_target" "app" {
  for_each           = local.containers
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.services[each.key].desired_count
  max_capacity       = var.services[each.key].max_count
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each           = local.containers
  name               = "${local.prefix}-${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.app[each.key].service_namespace
  resource_id        = aws_appautoscaling_target.app[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.app[each.key].scalable_dimension
  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
