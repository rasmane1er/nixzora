# One certificate for every host of this environment (load balancer, in the app region).
resource "aws_acm_certificate" "app" {
  domain_name               = local.hosts.storefront
  subject_alternative_names = [local.hosts.api, local.hosts.admin, "www.${local.hosts.storefront}"]
  validation_method         = "DNS"
  tags                      = local.tags
  lifecycle {
    create_before_destroy = true
  }
}

# CloudFront certificates must live in us-east-1.
resource "aws_acm_certificate" "media" {
  provider          = aws.us_east_1
  domain_name       = local.hosts.media
  validation_method = "DNS"
  tags              = local.tags
  lifecycle {
    create_before_destroy = true
  }
}

locals {
  # Keys come from configuration (known at plan time); values from the certificates.
  certificate_names = {
    app   = [local.hosts.storefront, local.hosts.api, local.hosts.admin, "www.${local.hosts.storefront}"]
    media = [local.hosts.media]
  }
  validation_options = concat(
    tolist(aws_acm_certificate.app.domain_validation_options),
    tolist(aws_acm_certificate.media.domain_validation_options),
  )
}

resource "aws_route53_record" "validation" {
  for_each        = toset(concat(local.certificate_names.app, local.certificate_names.media))
  zone_id         = var.hosted_zone_id
  name            = one([for o in local.validation_options : o.resource_record_name if o.domain_name == each.key])
  type            = one([for o in local.validation_options : o.resource_record_type if o.domain_name == each.key])
  records         = [one([for o in local.validation_options : o.resource_record_value if o.domain_name == each.key])]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for name in local.certificate_names.app : aws_route53_record.validation[name].fqdn]
}

resource "aws_acm_certificate_validation" "media" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.media.arn
  validation_record_fqdns = [aws_route53_record.validation[local.hosts.media].fqdn]
}

# Public names → load balancer / CDN.
resource "aws_route53_record" "app" {
  for_each = {
    storefront = local.hosts.storefront
    www        = "www.${local.hosts.storefront}"
    api        = local.hosts.api
    admin      = local.hosts.admin
  }
  zone_id = var.hosted_zone_id
  name    = each.value
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "media" {
  zone_id = var.hosted_zone_id
  name    = local.hosts.media
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.media.domain_name
    zone_id                = aws_cloudfront_distribution.media.hosted_zone_id
    evaluate_target_health = false
  }
}
