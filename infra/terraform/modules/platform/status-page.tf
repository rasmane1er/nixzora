# Public status page (p9-11): status.<domain>, served by CloudFront from its own S3 bucket, so it
# stays up when the site is down. A Lambda function checks the store and the API every minute
# and writes status.json; staff post a message on it by setting the SSM parameter below
# (docs/runbooks/incident-response.md).

resource "aws_s3_bucket" "status" {
  bucket        = "${local.prefix}-status-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
  tags          = local.tags
}

resource "aws_s3_bucket_public_access_block" "status" {
  bucket                  = aws_s3_bucket.status.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_object" "status_page" {
  bucket        = aws_s3_bucket.status.id
  key           = "index.html"
  source        = "${path.module}/../../../status-page/index.html"
  etag          = filemd5("${path.module}/../../../status-page/index.html")
  content_type  = "text/html; charset=utf-8"
  cache_control = "public, max-age=300"
}

resource "aws_ssm_parameter" "status_note" {
  name        = "/${var.name}/${var.environment}/status-note"
  description = "Message shown on the public status page during an incident. \"-\" shows nothing."
  type        = "String"
  value       = "-"
  tags        = local.tags
  lifecycle {
    ignore_changes = [value]
  }
}

# ── The probe ─────────────────────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "status_probe_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "status_probe" {
  name               = "${local.prefix}-status-probe"
  assume_role_policy = data.aws_iam_policy_document.status_probe_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy" "status_probe" {
  role = aws_iam_role.status_probe.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${aws_s3_bucket.status.arn}/status.json"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = aws_ssm_parameter.status_note.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.status_probe.arn}:*"
      },
    ]
  })
}

resource "aws_cloudwatch_log_group" "status_probe" {
  name              = "/aws/lambda/${local.prefix}-status-probe"
  retention_in_days = 14
  tags              = local.tags
}

# probe.zip is built from probe.mjs by infra/status-page/build.py (CI checks they match).
resource "aws_lambda_function" "status_probe" {
  function_name    = "${local.prefix}-status-probe"
  role             = aws_iam_role.status_probe.arn
  runtime          = "nodejs22.x"
  handler          = "probe.handler"
  filename         = "${path.module}/../../../status-page/probe.zip"
  source_code_hash = filebase64sha256("${path.module}/../../../status-page/probe.zip")
  timeout          = 30
  memory_size      = 128
  environment {
    variables = {
      STOREFRONT_URL = "https://${local.hosts.storefront}/"
      API_HEALTH_URL = "https://${local.hosts.api}/api/v1/health"
      BUCKET         = aws_s3_bucket.status.id
      NOTE_PARAMETER = aws_ssm_parameter.status_note.name
    }
  }
  depends_on = [aws_cloudwatch_log_group.status_probe]
  tags       = local.tags
}

resource "aws_cloudwatch_event_rule" "status_probe" {
  name                = "${local.prefix}-status-probe"
  schedule_expression = "rate(1 minute)"
  tags                = local.tags
}

resource "aws_cloudwatch_event_target" "status_probe" {
  rule = aws_cloudwatch_event_rule.status_probe.name
  arn  = aws_lambda_function.status_probe.arn
}

resource "aws_lambda_permission" "status_probe" {
  statement_id  = "EveryMinute"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.status_probe.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.status_probe.arn
}

# ── CloudFront ────────────────────────────────────────────────────────────────────────────────

resource "aws_acm_certificate" "status" {
  provider          = aws.us_east_1
  domain_name       = local.hosts.status
  validation_method = "DNS"
  tags              = local.tags
  lifecycle {
    create_before_destroy = true
  }
}

locals {
  status_validation = one([for o in aws_acm_certificate.status.domain_validation_options : o if o.domain_name == local.hosts.status])
}

resource "aws_route53_record" "status_validation" {
  zone_id         = var.hosted_zone_id
  name            = local.status_validation.resource_record_name
  type            = local.status_validation.resource_record_type
  records         = [local.status_validation.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "status" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.status.arn
  validation_record_fqdns = [aws_route53_record.status_validation.fqdn]
}

resource "aws_cloudfront_origin_access_control" "status" {
  name                              = "${local.prefix}-status"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "status" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.prefix} status page"
  aliases             = [local.hosts.status]
  price_class         = "PriceClass_100"
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.status.bucket_regional_domain_name
    origin_id                = "status"
    origin_access_control_id = aws_cloudfront_origin_access_control.status.id
  }

  default_cache_behavior {
    target_origin_id           = "status"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id
    compress                   = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.status.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  tags = local.tags
}

data "aws_iam_policy_document" "status" {
  statement {
    sid       = "CloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.status.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.status.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "status" {
  bucket = aws_s3_bucket.status.id
  policy = data.aws_iam_policy_document.status.json
}

resource "aws_route53_record" "status" {
  zone_id = var.hosted_zone_id
  name    = local.hosts.status
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.status.domain_name
    zone_id                = aws_cloudfront_distribution.status.hosted_zone_id
    evaluate_target_health = false
  }
}
