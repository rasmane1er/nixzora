locals {
  # Sent with every response the firewall writes itself (rate limits, IP reputation).
  waf_block_headers = {
    "strict-transport-security" = "max-age=63072000; includeSubDomains; preload"
    "content-security-policy"   = "default-src 'none'; frame-ancestors 'none'"
    "x-content-type-options"    = "nosniff"
    "permissions-policy"        = "camera=(), microphone=(), geolocation=()"
    "cache-control"             = "no-store"
  }
  # The two rules of the reputation group that block by default (AWSManagedIPDDoSList only counts).
  waf_reputation_rules = ["AWSManagedIPReputationList", "AWSManagedReconnaissanceList"]
}

# Web application firewall in front of the load balancer: AWS managed rule sets plus a
# per-IP rate limit, with a tighter limit on sign-in and checkout.
resource "aws_wafv2_web_acl" "main" {
  name  = local.prefix
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 1
    action {
      block {
        custom_response {
          response_code            = 429
          custom_response_body_key = "blocked"
          dynamic "response_header" {
            for_each = local.waf_block_headers
            content {
              name  = response_header.key
              value = response_header.value
            }
          }
        }
      }
    }
    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "sensitive-endpoints"
    priority = 2
    action {
      block {
        custom_response {
          response_code            = 429
          custom_response_body_key = "blocked"
          dynamic "response_header" {
            for_each = local.waf_block_headers
            content {
              name  = response_header.key
              value = response_header.value
            }
          }
        }
      }
    }
    statement {
      rate_based_statement {
        limit              = 100
        aggregate_key_type = "IP"
        scope_down_statement {
          or_statement {
            statement {
              byte_match_statement {
                search_string         = "/api/v1/auth/"
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
            statement {
              byte_match_statement {
                search_string         = "/api/v1/checkout"
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "sensitive-endpoints"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = {
      AWSManagedRulesCommonRuleSet          = 10
      AWSManagedRulesKnownBadInputsRuleSet  = 11
      AWSManagedRulesSQLiRuleSet            = 12
      AWSManagedRulesAmazonIpReputationList = 13
    }
    content {
      name     = rule.key
      priority = rule.value
      override_action {
        none {}
      }
      statement {
        managed_rule_group_statement {
          vendor_name = "AWS"
          name        = rule.key
          # Image uploads and long product descriptions exceed the generic body-size rule.
          dynamic "rule_action_override" {
            for_each = rule.key == "AWSManagedRulesCommonRuleSet" ? ["SizeRestrictions_BODY"] : []
            content {
              name = rule_action_override.value
              action_to_use {
                count {}
              }
            }
          }
          # Blocks by IP reputation answer with our own page and security headers (a bare WAF 403
          # has no HSTS or CSP, which scanners flag).
          dynamic "rule_action_override" {
            for_each = rule.key == "AWSManagedRulesAmazonIpReputationList" ? local.waf_reputation_rules : []
            content {
              name = rule_action_override.value
              action_to_use {
                block {
                  custom_response {
                    response_code            = 403
                    custom_response_body_key = "blocked"
                    dynamic "response_header" {
                      for_each = local.waf_block_headers
                      content {
                        name  = response_header.key
                        value = response_header.value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.key
        sampled_requests_enabled   = true
      }
    }
  }

  custom_response_body {
    key          = "blocked"
    content_type = "TEXT_PLAIN"
    content      = "Request blocked. If you think this is a mistake, contact support@${var.domain_name}."
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = local.prefix
    sampled_requests_enabled   = true
  }
  tags = local.tags
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}
