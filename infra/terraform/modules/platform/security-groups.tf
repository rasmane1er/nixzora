resource "aws_security_group" "alb" {
  name        = "${local.prefix}-alb"
  description = "Public HTTPS into the load balancer"
  vpc_id      = aws_vpc.main.id
  tags        = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from the internet"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP, redirected to HTTPS"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_apps" {
  for_each                     = local.ports
  security_group_id            = aws_security_group.alb.id
  description                  = "To ${each.key} containers"
  referenced_security_group_id = aws_security_group.apps.id
  from_port                    = each.value
  to_port                      = each.value
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "apps" {
  name        = "${local.prefix}-apps"
  description = "Fargate tasks: reachable only from the load balancer"
  vpc_id      = aws_vpc.main.id
  tags        = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "apps_from_alb" {
  for_each                     = local.ports
  security_group_id            = aws_security_group.apps.id
  description                  = "${each.key} from the load balancer"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = each.value
  to_port                      = each.value
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "apps_out" {
  security_group_id = aws_security_group.apps.id
  description       = "Outbound: database, cache, Stripe, SES, EasyPost, ECR"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "data" {
  name        = "${local.prefix}-data"
  description = "PostgreSQL and Redis: reachable only from the app tasks"
  vpc_id      = aws_vpc.main.id
  tags        = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "postgres" {
  security_group_id            = aws_security_group.data.id
  description                  = "PostgreSQL from app tasks"
  referenced_security_group_id = aws_security_group.apps.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "redis" {
  security_group_id            = aws_security_group.data.id
  description                  = "Redis from app tasks"
  referenced_security_group_id = aws_security_group.apps.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
}
