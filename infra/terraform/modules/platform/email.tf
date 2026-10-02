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
