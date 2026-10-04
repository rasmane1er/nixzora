# Plans the whole platform against mocked AWS APIs: catches broken references, bad
# for_each keys and invalid settings without an AWS account. Run: terraform test
mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["us-east-1a", "us-east-1b", "us-east-1c"] }
  }
  mock_data "aws_region" {
    defaults = { region = "us-east-1", name = "us-east-1" }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
  mock_resource "aws_db_instance" {
    defaults = {
      address            = "db.internal"
      port               = 5432
      arn                = "arn:aws:rds:us-east-1:123456789012:db:nixzora"
      master_user_secret = [{ secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:rds", kms_key_id = "", secret_status = "active" }]
    }
  }
  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:123456789012:certificate/abc"
      domain_validation_options = [
        for name in ["nixzora-demo.com", "api.nixzora-demo.com", "ops.nixzora-demo.com", "www.nixzora-demo.com",
        "staging.nixzora-demo.com", "api.staging.nixzora-demo.com", "ops.staging.nixzora-demo.com", "www.staging.nixzora-demo.com"] :
        { domain_name = name, resource_record_name = "_x.${name}", resource_record_type = "CNAME", resource_record_value = "_y.acm-validations.aws" }
      ]
    }
  }
  mock_resource "aws_lb_target_group" {
    defaults = { arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/x/1", arn_suffix = "targetgroup/x/1" }
  }
  mock_resource "aws_lb_listener" {
    defaults = { arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/x/1/1" }
  }
  mock_resource "aws_ecs_cluster" {
    defaults = { arn = "arn:aws:ecs:us-east-1:123456789012:cluster/x" }
  }
  mock_resource "aws_ses_domain_dkim" {
    defaults = { dkim_tokens = ["a", "b", "c"] }
  }
  mock_resource "aws_lb" {
    defaults = { arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/x/1", arn_suffix = "app/x/1" }
  }
  mock_resource "aws_s3_bucket" {
    defaults = { arn = "arn:aws:s3:::bucket" }
  }
  mock_resource "aws_secretsmanager_secret" {
    defaults = { arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:app" }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/x" }
  }
  mock_resource "aws_service_discovery_service" {
    defaults = { arn = "arn:aws:servicediscovery:us-east-1:123456789012:service/srv-search" }
  }
  mock_resource "aws_ecs_task_definition" {
    defaults = { arn = "arn:aws:ecs:us-east-1:123456789012:task-definition/x:1" }
  }
  mock_resource "aws_sns_topic" {
    defaults = { arn = "arn:aws:sns:us-east-1:123456789012:alarms" }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = { arn = "arn:aws:logs:us-east-1:123456789012:log-group:x" }
  }
  mock_resource "aws_cloudfront_distribution" {
    defaults = { arn = "arn:aws:cloudfront::123456789012:distribution/X" }
  }
  mock_resource "aws_wafv2_web_acl" {
    defaults = { arn = "arn:aws:wafv2:us-east-1:123456789012:regional/webacl/x/1" }
  }
  mock_resource "aws_backup_plan" {
    defaults = { arn = "arn:aws:backup:us-east-1:123456789012:backup-plan:x" }
  }
  mock_resource "aws_msk_cluster" {
    defaults = {
      arn                        = "arn:aws:kafka:us-east-1:123456789012:cluster/nixzora-staging-events/abcd-1234"
      bootstrap_brokers_sasl_iam = "b-1.events.kafka.us-east-1.amazonaws.com:9098,b-2.events.kafka.us-east-1.amazonaws.com:9098"
    }
  }
  mock_resource "aws_eks_cluster" {
    defaults = {
      arn      = "arn:aws:eks:us-east-1:123456789012:cluster/nixzora-staging"
      endpoint = "https://ABC.gr7.us-east-1.eks.amazonaws.com"
    }
  }
  mock_resource "aws_prometheus_workspace" {
    defaults = {
      id                  = "ws-1234"
      arn                 = "arn:aws:aps:us-east-1:123456789012:workspace/ws-1234"
      prometheus_endpoint = "https://aps-workspaces.us-east-1.amazonaws.com/workspaces/ws-1234/"
    }
  }
  mock_resource "aws_kms_key" {
    defaults = { arn = "arn:aws:kms:us-east-1:123456789012:key/eks" }
  }
  mock_resource "aws_lambda_function" {
    defaults = { arn = "arn:aws:lambda:us-east-1:123456789012:function:nixzora-status-probe" }
  }
  mock_resource "aws_cloudwatch_event_rule" {
    defaults = { arn = "arn:aws:events:us-east-1:123456789012:rule/nixzora-status-probe" }
  }
  mock_resource "aws_msk_configuration" {
    defaults = { arn = "arn:aws:kafka:us-east-1:123456789012:configuration/nixzora-staging-kafka/x", latest_revision = 1 }
  }
}

mock_provider "aws" {
  alias = "us_east_1"
  mock_resource "aws_sns_topic" {
    defaults = { arn = "arn:aws:sns:us-east-1:123456789012:nixzora-outside-alarms" }
  }
  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:123456789012:certificate/media"
      domain_validation_options = [
        for name in ["media.nixzora-demo.com", "media.staging.nixzora-demo.com", "status.nixzora-demo.com", "status.staging.nixzora-demo.com"] :
        { domain_name = name, resource_record_name = "_x.${name}", resource_record_type = "CNAME", resource_record_value = "_y.acm-validations.aws" }
      ]
    }
  }
}

mock_provider "aws" {
  alias = "backup_copy"
  mock_resource "aws_backup_vault" {
    defaults = { arn = "arn:aws:backup:us-west-2:123456789012:backup-vault:nixzora-production-copy" }
  }
}

mock_provider "random" {
  mock_resource "random_password" {
    defaults = { result = "mockedredisauthtokenmockedredisauthtoken" }
  }
}

variables {
  domain_name    = "nixzora-demo.com"
  hosted_zone_id = "Z0123456789"
  image_repositories = {
    api        = "123456789012.dkr.ecr.us-east-1.amazonaws.com/nixzora/api"
    storefront = "123456789012.dkr.ecr.us-east-1.amazonaws.com/nixzora/storefront"
    admin      = "123456789012.dkr.ecr.us-east-1.amazonaws.com/nixzora/admin"
  }
  image_tag   = "abc123"
  alarm_email = "ops@nixzora-demo.com"
}

run "staging" {
  command = plan
  variables {
    environment         = "staging"
    deletion_protection = false
  }
  assert {
    condition     = output.urls.api == "https://api.staging.nixzora-demo.com"
    error_message = "staging hosts must be under staging."
  }
  assert {
    condition     = length(aws_nat_gateway.main) == 1
    error_message = "staging uses one NAT gateway."
  }
  assert {
    condition     = length(aws_ses_domain_identity.domain) == 1 && length(aws_route53_record.dkim) == 3 && length(aws_route53_record.mail_from_mx) == 1
    error_message = "by default the environment owns the email domain: identity, DKIM and MAIL FROM records."
  }
  assert {
    condition     = output.api_environment["SEARCH_SERVICE_URL"] == "http://search.nixzora-staging.internal:4100"
    error_message = "the API must call the search service by its private name."
  }
  assert {
    condition     = length(aws_ecs_service.search) == 1 && length(aws_lb_target_group.app) == 3
    error_message = "the search service runs without a load balancer target."
  }
  assert {
    condition     = output.api_environment["AI_SERVICE_URL"] == "http://ai.nixzora-staging.internal:4200"
    error_message = "the API must reach the AI service by its private name."
  }
  assert {
    condition     = !contains(output.secret_names.api, "ANTHROPIC_API_KEY") && contains(output.secret_names.ai, "ANTHROPIC_API_KEY")
    error_message = "only the AI service may hold the model provider keys."
  }
  assert {
    condition     = length(aws_ecs_service.worker) == 1 && output.api_environment["BACKGROUND_JOBS"] == "false"
    error_message = "with the notifications worker, the API must leave background jobs to it."
  }
  assert {
    condition     = length(aws_msk_cluster.main) == 0 && !contains(keys(output.api_environment), "KAFKA_BROKERS")
    error_message = "MSK costs money: it stays off unless event_streaming.enabled."
  }
  assert {
    condition     = length(aws_db_instance.replica) == 0 && !contains(keys(output.api_environment), "DATABASE_REPLICA_HOST")
    error_message = "the read replica stays off unless db_read_replica.enabled."
  }
  assert {
    condition     = length(aws_prometheus_workspace.main) == 0 && length(aws_cloudwatch_log_group.metrics_collector) == 0
    error_message = "Managed Prometheus stays off unless observability.managed_prometheus."
  }
  assert {
    condition     = length(aws_eks_cluster.main) == 0 && output.kubernetes == null
    error_message = "EKS costs money: it stays off unless kubernetes.enabled."
  }
  assert {
    condition     = length(aws_guardduty_malware_protection_plan.media) == 1 && output.api_environment["MEDIA_MALWARE_SCAN"] == "guardduty"
    error_message = "uploads must be scanned for malware before the API accepts them (ADR-0025)."
  }
  assert {
    condition     = output.urls.status == "https://status.staging.nixzora-demo.com" && length(aws_route53_health_check.outside) == 2
    error_message = "the status page and outside health checks must exist (p9-11)."
  }
  assert {
    condition     = length(aws_sns_topic_subscription.alarms_pager) == 0 && length(aws_sns_topic_subscription.alarms_sms) == 0
    error_message = "without on-call settings, alarms only email."
  }
  assert {
    condition     = output.api_environment["SES_CONFIGURATION_SET"] == "nixzora-staging-mail" && contains(aws_sesv2_configuration_set.mail.suppression_options[0].suppressed_reasons, "BOUNCE")
    error_message = "email must go through the configuration set that reports bounces and complaints (p9-02)."
  }
}

run "event_streaming" {
  command = plan
  variables {
    environment         = "staging"
    deletion_protection = false
    event_streaming     = { enabled = true }
  }
  assert {
    condition     = length(aws_msk_cluster.main) == 1 && aws_msk_cluster.main[0].number_of_broker_nodes == 2
    error_message = "event streaming runs one broker per availability zone."
  }
  assert {
    condition     = output.api_environment["KAFKA_AUTH"] == "aws-iam" && output.api_environment["SEARCH_INDEX_EVENTS"] == "kafka"
    error_message = "apps must sign in to MSK with IAM, and the search service must follow the product topic."
  }
  assert {
    condition     = aws_msk_cluster.main[0].encryption_info[0].encryption_in_transit[0].client_broker == "TLS"
    error_message = "MSK must accept TLS only."
  }
  assert {
    condition     = length(aws_iam_role_policy.search_task_kafka) == 1 && length(aws_vpc_security_group_ingress_rule.kafka_iam) == 1
    error_message = "the search service needs read access and the brokers need an ingress rule."
  }
}

run "kubernetes" {
  command = plan
  variables {
    environment         = "staging"
    deletion_protection = false
    kubernetes          = { enabled = true, deploy_role_arn = "arn:aws:iam::123456789012:role/nixzora-deploy" }
  }
  assert {
    condition     = length(aws_eks_cluster.main) == 1 && aws_eks_cluster.main[0].compute_config[0].enabled
    error_message = "Kubernetes runs as an EKS Auto Mode cluster."
  }
  assert {
    condition     = toset(keys(aws_eks_pod_identity_association.app)) == toset(["api", "web", "search", "ai"])
    error_message = "every chart service account must get its ECS task role through Pod Identity."
  }
  assert {
    condition     = aws_eks_pod_identity_association.app["api"].service_account == "nixzora-api" && aws_eks_pod_identity_association.app["api"].namespace == "nixzora"
    error_message = "service account names must match the Helm chart (<release>-<name>)."
  }
  assert {
    condition     = aws_eks_access_policy_association.deploy[0].access_scope[0].type == "namespace"
    error_message = "the deploy role is limited to the app namespace."
  }
  assert {
    condition     = length(aws_vpc_security_group_ingress_rule.eks_data) == 2
    error_message = "pods need PostgreSQL and Redis."
  }
  assert {
    condition     = output.kubernetes.helm_values.hosts.api == "api.staging.nixzora-demo.com"
    error_message = "the output must give the chart its host names."
  }
}

run "read_replica" {
  command = plan
  variables {
    environment         = "staging"
    deletion_protection = false
    db_read_replica     = { enabled = true }
  }
  assert {
    condition     = length(aws_db_instance.replica) == 1 && aws_db_instance.replica[0].replicate_source_db == "nixzora-staging"
    error_message = "the replica must follow the primary."
  }
  # Terraform leaves mocked computed values (the replica's address) unknown at plan time, so
  # these checks only use what the plan knows.
  assert {
    condition     = contains(keys(output.api_environment), "DATABASE_REPLICA_HOST")
    error_message = "the API must know the replica's address."
  }
  assert {
    condition     = length(aws_cloudwatch_metric_alarm.replica_lag) == 1
    error_message = "replica lag must page someone."
  }
}

run "managed_prometheus" {
  command = plan
  variables {
    environment         = "staging"
    deletion_protection = false
    observability       = { managed_prometheus = true }
  }
  assert {
    condition     = length(aws_prometheus_rule_group_namespace.rules) == 2
    error_message = "the SLO and operations rules must be loaded into the workspace."
  }
  # Container definitions embed the workspace URL, unknown at plan time: check what is known.
  assert {
    condition     = length(aws_prometheus_workspace.main) == 1 && length(aws_cloudwatch_log_group.metrics_collector) == 1
    error_message = "the workspace and the collectors' log group must exist."
  }
  assert {
    condition     = toset(keys(aws_iam_role_policy.remote_write)) == toset(["api", "search", "ai"])
    error_message = "every role running a collector may write to the workspace."
  }
}

run "search_in_process" {
  command = plan
  variables {
    environment         = "staging"
    deletion_protection = false
    services = {
      api        = { cpu = 256, memory = 512, desired_count = 1, max_count = 2 }
      storefront = { cpu = 256, memory = 512, desired_count = 1, max_count = 2 }
      admin      = { cpu = 256, memory = 512, desired_count = 1, max_count = 1 }
    }
  }
  assert {
    condition     = length(aws_ecs_service.search) == 0 && !contains(keys(output.api_environment), "SEARCH_SERVICE_URL")
    error_message = "without a search entry, the API searches in-process."
  }
  assert {
    condition     = length(aws_ecs_service.ai) == 0 && contains(output.secret_names.api, "ANTHROPIC_API_KEY")
    error_message = "without an AI service, the API keeps the provider keys."
  }
  assert {
    condition     = length(aws_ecs_service.worker) == 0 && !contains(keys(output.api_environment), "BACKGROUND_JOBS")
    error_message = "without a worker entry, the API runs the background jobs itself."
  }
}

run "production" {
  command = plan
  variables {
    environment        = "production"
    nat_gateway_count  = 2
    db_multi_az        = true
    ops_allowed_cidrs  = ["203.0.113.10/32"]
    backup_copy_region = "us-west-2"
    oncall_webhook_url = "https://events.pagerduty.com/integration/abc/enqueue"
    email_domain_owner = false
  }
  assert {
    condition     = output.urls.storefront == "https://nixzora-demo.com"
    error_message = "production storefront is the apex domain."
  }
  assert {
    condition     = aws_db_instance.main.deletion_protection && aws_db_instance.main.multi_az
    error_message = "production database must be protected and multi-AZ."
  }
  assert {
    condition     = length(aws_lb_listener_rule.admin_blocked) == 1
    error_message = "the Ops Center allow-list must block everyone else."
  }
  assert {
    condition     = length(aws_backup_vault.copy) == 1 && output.backup_copy_vault.region == "us-west-2"
    error_message = "production backups must be copied to a second region (p9-10)."
  }
  assert {
    condition     = length(aws_sns_topic_subscription.alarms_pager) == 1 && length(aws_sns_topic_subscription.outside_pager) == 1
    error_message = "with an on-call webhook, every alarm pages (p9-11)."
  }
  assert {
    condition     = output.api_environment["PAYMENTS_PROVIDER"] == "stripe" && output.api_environment["PAYOUTS_PROVIDER"] == "stripe"
    error_message = "production API must use Stripe for payments and payouts (the API refuses to start otherwise)."
  }
  assert {
    condition     = length(aws_ses_domain_identity.domain) == 0 && length(aws_route53_record.dmarc) == 0 && aws_sesv2_configuration_set.mail.configuration_set_name == "nixzora-production-mail"
    error_message = "an environment that does not own the email domain keeps its own configuration set but creates no identity or domain records."
  }
}
