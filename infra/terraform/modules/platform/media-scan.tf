# Malware scanning of uploads (ADR-0025): GuardDuty Malware Protection for S3 scans every new
# object in incoming/ and tags it with GuardDutyMalwareScanStatus. The API waits for that tag
# before it re-encodes an upload into products/, and refuses and deletes anything flagged.

resource "aws_iam_role" "media_scan" {
  count = var.media_malware_scan ? 1 : 0
  name  = "${local.prefix}-media-scan"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "malware-protection-plan.guardduty.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
      }
    }]
  })
  tags = local.tags
}

# The permissions GuardDuty documents for a protected bucket: its own EventBridge rule, the
# bucket notification, reading and tagging objects, and writing its validation object.
resource "aws_iam_role_policy" "media_scan" {
  count = var.media_malware_scan ? 1 : 0
  role  = aws_iam_role.media_scan[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EventBridgeManagedRule"
        Effect = "Allow"
        Action = [
          "events:PutRule",
          "events:DeleteRule",
          "events:PutTargets",
          "events:RemoveTargets",
        ]
        Resource = "arn:aws:events:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*"
        Condition = {
          StringLike = { "events:ManagedBy" = "malware-protection-plan.guardduty.amazonaws.com" }
        }
      },
      {
        Sid      = "EventBridgeDescribe"
        Effect   = "Allow"
        Action   = ["events:DescribeRule", "events:ListTargetsByRule"]
        Resource = "arn:aws:events:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:rule/DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*"
      },
      {
        Sid      = "BucketNotifications"
        Effect   = "Allow"
        Action   = ["s3:PutBucketNotification", "s3:GetBucketNotification", "s3:ListBucket"]
        Resource = aws_s3_bucket.media.arn
      },
      {
        Sid    = "ScanAndTag"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:GetObjectTagging",
          "s3:GetObjectVersionTagging",
          "s3:PutObjectTagging",
          "s3:PutObjectVersionTagging",
        ]
        Resource = "${aws_s3_bucket.media.arn}/incoming/*"
      },
      {
        Sid      = "ValidationObject"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.media.arn}/malware-protection-resource-validation-object"
      },
    ]
  })
}

resource "aws_guardduty_malware_protection_plan" "media" {
  count = var.media_malware_scan ? 1 : 0
  role  = aws_iam_role.media_scan[0].arn
  protected_resource {
    s3_bucket {
      bucket_name     = aws_s3_bucket.media.id
      object_prefixes = ["incoming/"]
    }
  }
  actions {
    tagging {
      status = "ENABLED"
    }
  }
  tags       = local.tags
  depends_on = [aws_iam_role_policy.media_scan]
}
