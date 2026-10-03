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
