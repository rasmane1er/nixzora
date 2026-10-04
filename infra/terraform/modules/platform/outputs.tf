output "urls" {
  value = { for k, host in local.hosts : k => "https://${host}" }
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "services" {
  value = merge(
    { for k, s in aws_ecs_service.app : k => s.name },
    { for s in aws_ecs_service.search : "search" => s.name },
    { for s in aws_ecs_service.ai : "ai" => s.name },
  )
}

output "migrate_task_definition" {
  value = aws_ecs_task_definition.migrate.family
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "app_security_group_id" {
  value = aws_security_group.apps.id
}

output "app_secret_arn" {
  description = "Set the application keys here (see the first-deploy runbook)."
  value       = aws_secretsmanager_secret.app.arn
}

output "database_endpoint" {
  value = aws_db_instance.main.address
}

output "media_bucket" {
  value = aws_s3_bucket.media.id
}

output "alarm_topic_arn" {
  value = aws_sns_topic.alarms.arn
}

output "api_environment" {
  description = "Plain (non-secret) environment variables of the API task, for tests and troubleshooting."
  value       = local.api_environment
}

output "secret_names" {
  description = "Names (not values) of the secrets each task receives, for tests: only the AI service may hold the model provider keys."
  value = {
    api = [for s in local.api_secrets : s.name]
    ai  = local.ai_enabled ? [for s in concat(local.base_secrets, local.ai_secrets) : s.name] : []
  }
}

output "kubernetes" {
  description = "EKS cluster and the settings values-<env>.yaml needs (ADR-0021). Null when off."
  value = local.eks_enabled ? {
    cluster_name      = aws_eks_cluster.main[0].name
    endpoint          = aws_eks_cluster.main[0].endpoint
    namespace         = var.kubernetes.namespace
    update_kubeconfig = "aws eks update-kubeconfig --name ${aws_eks_cluster.main[0].name} --region ${data.aws_region.current.region}"
    helm_values = {
      aws = {
        region       = data.aws_region.current.region
        databaseHost = aws_db_instance.main.address
        replicaHost  = var.db_read_replica.enabled ? aws_db_instance.replica[0].address : ""
        databaseName = aws_db_instance.main.db_name
        databaseUser = aws_db_instance.main.username
        redisHost    = aws_elasticache_replication_group.main.primary_endpoint_address
        mediaBucket  = aws_s3_bucket.media.id
        mediaHost    = local.hosts.media
      }
      hosts = local.hosts
      externalSecrets = {
        remote = {
          app      = aws_secretsmanager_secret.app.name
          ai       = aws_secretsmanager_secret.ai.name
          redis    = aws_secretsmanager_secret.redis.name
          internal = aws_secretsmanager_secret.internal.name
          database = local.db_secret
        }
      }
      networkPolicies = { vpcCidr = var.vpc_cidr }
    }
  } : null
}
