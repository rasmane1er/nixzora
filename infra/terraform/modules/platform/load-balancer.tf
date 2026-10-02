resource "aws_s3_bucket" "logs" {
  bucket        = "${local.prefix}-lb-logs-${data.aws_caller_identity.current.account_id}"
  force_destroy = !var.deletion_protection
  tags          = local.tags
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    id     = "expire"
    status = "Enabled"
    filter {}
    expiration {
      days = 90
    }
  }
}

data "aws_iam_policy_document" "logs" {
  statement {
    principals {
      type        = "Service"
      identifiers = ["logdelivery.elasticloadbalancing.amazonaws.com"]
    }
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.logs.arn}/alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]
  }
}

resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.logs.id
  policy = data.aws_iam_policy_document.logs.json
}

resource "aws_lb" "main" {
  name                       = local.prefix
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true
  enable_deletion_protection = var.deletion_protection
  idle_timeout               = 60
  access_logs {
    bucket  = aws_s3_bucket.logs.id
    prefix  = "alb"
    enabled = true
  }
  tags       = local.tags
  depends_on = [aws_s3_bucket_policy.logs]
}

resource "aws_lb_target_group" "app" {
  for_each             = local.ports
  name                 = "${local.prefix}-${each.key}"
  port                 = each.value
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 20
  health_check {
    path                = { api = "/api/v1/health", storefront = "/robots.txt", admin = "/login" }[each.key]
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
  }
  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.app.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app["storefront"].arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app["api"].arn
  }
  condition {
    host_header {
      values = [local.hosts.api]
    }
  }
}

resource "aws_lb_listener_rule" "admin" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app["admin"].arn
  }
  condition {
    host_header {
      values = [local.hosts.admin]
    }
  }
  dynamic "condition" {
    for_each = length(var.ops_allowed_cidrs) > 0 ? [1] : []
    content {
      source_ip {
        values = var.ops_allowed_cidrs
      }
    }
  }
}

# Anyone else asking for the Ops Center host gets a plain 403 (only when an allow-list is set).
resource "aws_lb_listener_rule" "admin_blocked" {
  count        = length(var.ops_allowed_cidrs) > 0 ? 1 : 0
  listener_arn = aws_lb_listener.https.arn
  priority     = 21
  action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }
  condition {
    host_header {
      values = [local.hosts.admin]
    }
  }
}

# www → apex
resource "aws_lb_listener_rule" "www" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 30
  action {
    type = "redirect"
    redirect {
      host        = local.hosts.storefront
      status_code = "HTTP_301"
    }
  }
  condition {
    host_header {
      values = ["www.${local.hosts.storefront}"]
    }
  }
}

# Temporary names (e.g. nixzora.com before production exists) → this storefront. 302, so
# browsers and search engines do not remember it once production takes the name over.
resource "aws_lb_listener_rule" "redirect_hosts" {
  count        = length(var.redirect_hosts) > 0 ? 1 : 0
  listener_arn = aws_lb_listener.https.arn
  priority     = 40
  action {
    type = "redirect"
    redirect {
      host        = local.hosts.storefront
      status_code = "HTTP_302"
    }
  }
  condition {
    host_header {
      values = var.redirect_hosts
    }
  }
}

resource "aws_route53_record" "redirect_hosts" {
  for_each = toset(var.redirect_hosts)
  zone_id  = var.hosted_zone_id
  name     = each.value
  type     = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
