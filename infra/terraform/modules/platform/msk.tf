# ───────────── Event streaming: Kafka on Amazon MSK (ADR-0020) ─────────────
# The notifications worker streams every transactional-outbox event to Kafka, one topic per
# aggregate ("nixzora.order.events"), keyed by the aggregate id. Brokers live in the private
# subnets, accept only TLS with IAM authentication (the ECS task roles; no passwords), and are
# reachable only from the app tasks. Off unless var.event_streaming.enabled.

locals {
  msk_enabled = var.event_streaming.enabled
  msk_environment = local.msk_enabled ? {
    KAFKA_BROKERS            = aws_msk_cluster.main[0].bootstrap_brokers_sasl_iam
    KAFKA_AUTH               = "aws-iam"
    KAFKA_REGION             = data.aws_region.current.region
    KAFKA_TOPIC_PREFIX       = var.name
    KAFKA_REPLICATION_FACTOR = tostring(min(2, var.az_count * var.event_streaming.brokers_per_az))
    SEARCH_INDEX_EVENTS      = local.search_enabled ? var.event_streaming.search_index_events : "outbox"
  } : {}
  # Topic and consumer-group ARNs: same name and UUID as the cluster ARN, another resource type.
  msk_topics = local.msk_enabled ? "${replace(aws_msk_cluster.main[0].arn, ":cluster/", ":topic/")}/${var.name}.*" : ""
  msk_groups = local.msk_enabled ? "${replace(aws_msk_cluster.main[0].arn, ":cluster/", ":group/")}/${var.name}-*" : ""
}

resource "aws_security_group" "kafka" {
  count       = local.msk_enabled ? 1 : 0
  name        = "${local.prefix}-kafka"
  description = "MSK brokers: reachable only from the app tasks (TLS + IAM)"
  vpc_id      = aws_vpc.main.id
  tags        = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "kafka_iam" {
  count                        = local.msk_enabled ? 1 : 0
  security_group_id            = aws_security_group.kafka[0].id
  description                  = "Kafka (TLS, IAM auth) from app tasks"
  referenced_security_group_id = aws_security_group.apps.id
  from_port                    = 9098
  to_port                      = 9098
  ip_protocol                  = "tcp"
}

resource "aws_msk_configuration" "main" {
  count          = local.msk_enabled ? 1 : 0
  name           = "${local.prefix}-kafka"
  kafka_versions = [var.event_streaming.kafka_version]
  # Topics are created by the app with known settings, never by a typo in a producer.
  server_properties = <<-PROPERTIES
    auto.create.topics.enable=false
    default.replication.factor=${min(2, var.az_count * var.event_streaming.brokers_per_az)}
    min.insync.replicas=1
    num.partitions=3
    log.retention.hours=${var.event_streaming.retention_hours}
  PROPERTIES
}

resource "aws_cloudwatch_log_group" "kafka" {
  count             = local.msk_enabled ? 1 : 0
  name              = "/${var.name}/${var.environment}/kafka"
  retention_in_days = 14
  tags              = local.tags
}

resource "aws_msk_cluster" "main" {
  count                  = local.msk_enabled ? 1 : 0
  cluster_name           = "${local.prefix}-events"
  kafka_version          = var.event_streaming.kafka_version
  number_of_broker_nodes = var.az_count * var.event_streaming.brokers_per_az

  broker_node_group_info {
    instance_type   = var.event_streaming.instance_type
    client_subnets  = aws_subnet.private[*].id
    security_groups = [aws_security_group.kafka[0].id]
    storage_info {
      ebs_storage_info {
        volume_size = var.event_streaming.volume_gb
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.main[0].arn
    revision = aws_msk_configuration.main[0].latest_revision
  }

  client_authentication {
    sasl {
      iam = true
    }
    unauthenticated = false
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.kafka[0].name
      }
    }
  }

  tags = local.tags
}

# The API and worker (shared task role): produce to every NIXZORA topic and create them.
resource "aws_iam_role_policy" "api_task_kafka" {
  count = local.msk_enabled ? 1 : 0
  role  = aws_iam_role.api_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Cluster"
        Effect = "Allow"
        # Idempotent producers (exactly one copy per send, in order) need WriteDataIdempotently.
        Action = [
          "kafka-cluster:Connect",
          "kafka-cluster:DescribeCluster",
          "kafka-cluster:WriteDataIdempotently",
        ]
        Resource = aws_msk_cluster.main[0].arn
      },
      {
        Sid    = "Topics"
        Effect = "Allow"
        Action = [
          "kafka-cluster:CreateTopic",
          "kafka-cluster:DescribeTopic",
          "kafka-cluster:WriteData",
          "kafka-cluster:ReadData",
        ]
        Resource = local.msk_topics
      },
      {
        Sid      = "Groups"
        Effect   = "Allow"
        Action   = ["kafka-cluster:AlterGroup", "kafka-cluster:DescribeGroup"]
        Resource = local.msk_groups
      },
    ]
  })
}

# The search service: read the product topic in its consumer group, write its dead letters.
resource "aws_iam_role_policy" "search_task_kafka" {
  count = local.msk_enabled && local.search_enabled ? 1 : 0
  role  = aws_iam_role.search_task[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Cluster"
        Effect = "Allow"
        Action = [
          "kafka-cluster:Connect",
          "kafka-cluster:DescribeCluster",
          "kafka-cluster:WriteDataIdempotently",
        ]
        Resource = aws_msk_cluster.main[0].arn
      },
      {
        Sid    = "Topics"
        Effect = "Allow"
        Action = [
          "kafka-cluster:CreateTopic",
          "kafka-cluster:DescribeTopic",
          "kafka-cluster:ReadData",
          "kafka-cluster:WriteData",
        ]
        Resource = local.msk_topics
      },
      {
        Sid      = "Groups"
        Effect   = "Allow"
        Action   = ["kafka-cluster:AlterGroup", "kafka-cluster:DescribeGroup"]
        Resource = local.msk_groups
      },
    ]
  })
}
