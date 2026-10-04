# Sending domain for receipts. DKIM proves the mail is ours; new SES accounts start in the
# sandbox — request production access once (see docs/runbooks/first-deploy.md).
resource "aws_ses_domain_identity" "domain" {
  domain = var.domain_name
}

resource "aws_ses_domain_dkim" "domain" {
  domain = aws_ses_domain_identity.domain.domain
}

resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = var.hosted_zone_id
  name    = "${aws_ses_domain_dkim.domain.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_ses_domain_dkim.domain.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# A mail-from subdomain and DMARC policy improve deliverability of receipts.
resource "aws_route53_record" "dmarc" {
  zone_id = var.hosted_zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=quarantine; rua=mailto:${var.alarm_email}"]
}

# ── Deliverability and feedback (p9-02) ──────────────────────────────────────────────────────

# Bounces are handled by a subdomain we own, so SPF passes for our domain and DMARC aligns.
resource "aws_ses_domain_mail_from" "domain" {
  domain                 = aws_ses_domain_identity.domain.domain
  mail_from_domain       = "mail.${var.domain_name}"
  behavior_on_mx_failure = "UseDefaultValue"
}

resource "aws_route53_record" "mail_from_mx" {
  zone_id = var.hosted_zone_id
  name    = aws_ses_domain_mail_from.domain.mail_from_domain
  type    = "MX"
  ttl     = 1800
  records = ["10 feedback-smtp.${data.aws_region.current.region}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = var.hosted_zone_id
  name    = aws_ses_domain_mail_from.domain.mail_from_domain
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com -all"]
}

# Every email goes through this configuration set: SES keeps its own suppression list for
# bounces and complaints, and publishes them to SNS, which posts them to the API
# (POST /api/v1/notifications/webhooks/ses) so it stops emailing those addresses.
resource "aws_sesv2_configuration_set" "mail" {
  configuration_set_name = "${local.prefix}-mail"
  delivery_options {
    tls_policy = "REQUIRE"
  }
  reputation_options {
    reputation_metrics_enabled = true
  }
  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
  tags = local.tags
}

resource "aws_sns_topic" "ses_events" {
  name = "${local.prefix}-ses-events"
  tags = local.tags
}

data "aws_iam_policy_document" "ses_events" {
  statement {
    sid       = "SesPublishes"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.ses_events.arn]
    principals {
      type        = "Service"
      identifiers = ["ses.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sns_topic_policy" "ses_events" {
  arn    = aws_sns_topic.ses_events.arn
  policy = data.aws_iam_policy_document.ses_events.json
}

resource "aws_sesv2_configuration_set_event_destination" "feedback" {
  configuration_set_name = aws_sesv2_configuration_set.mail.configuration_set_name
  event_destination_name = "bounces-and-complaints"
  event_destination {
    enabled              = true
    matching_event_types = ["BOUNCE", "COMPLAINT"]
    sns_destination {
      topic_arn = aws_sns_topic.ses_events.arn
    }
  }
  depends_on = [aws_sns_topic_policy.ses_events]
}

# The API confirms this subscription itself when SNS sends the confirmation (signature checked).
# If it was created before the API could answer, use "Request confirmation" in the SNS console.
resource "aws_sns_topic_subscription" "ses_events_api" {
  topic_arn              = aws_sns_topic.ses_events.arn
  protocol               = "https"
  endpoint               = "https://${local.hosts.api}/api/v1/notifications/webhooks/ses"
  endpoint_auto_confirms = false
  raw_message_delivery   = false
}
