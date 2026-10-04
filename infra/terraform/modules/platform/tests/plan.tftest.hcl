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
  mock_resource "aws_msk_configuration" {
    defaults = { arn = "arn:aws:kafka:us-east-1:123456789012:configuration/nixzora-staging-kafka/x", latest_revision = 1 }
  }
}

mock_provider "aws" {
  alias = "us_east_1"
  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:123456789012:certificate/media"
      domain_validation_options = [
        for name in ["media.nixzora-demo.com", "media.staging.nixzora-demo.com"] :
        { domain_name = name, resource_record_name = "_x.${name}", resource_record_type = "CNAME", resource_record_value = "_y.acm-validations.aws" }
      ]
    }
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
    environment       = "production"
    nat_gateway_count = 2
    db_multi_az       = true
    ops_allowed_cidrs = ["203.0.113.10/32"]
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
    condition     = output.api_environment["PAYMENTS_PROVIDER"] == "stripe"
    error_message = "production API must use Stripe."
  }
}
