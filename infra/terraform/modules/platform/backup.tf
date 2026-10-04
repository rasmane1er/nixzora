# Daily backups kept 35 days, plus monthly kept a year in production, in addition to RDS
# point-in-time recovery. With backup_copy_region set, every recovery point is also copied to a
# vault in that region (p9-10), so a regional outage does not take the backups with it.
# Restores are rehearsed every quarter with scripts/dr/restore-drill.sh
# (docs/runbooks/disaster-recovery.md).
resource "aws_backup_vault" "main" {
  name = local.prefix
  tags = local.tags
}

resource "aws_backup_vault" "copy" {
  count    = var.backup_copy_region == null ? 0 : 1
  provider = aws.backup_copy
  name     = "${local.prefix}-copy"
  tags     = local.tags
}

resource "aws_backup_plan" "main" {
  name = local.prefix
  rule {
    rule_name         = "daily"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 6 * * ? *)"
    lifecycle {
      delete_after = 35
    }
    dynamic "copy_action" {
      for_each = aws_backup_vault.copy
      content {
        destination_vault_arn = copy_action.value.arn
        lifecycle {
          delete_after = 35
        }
      }
    }
  }
  dynamic "rule" {
    for_each = var.environment == "production" ? [1] : []
    content {
      rule_name         = "monthly"
      target_vault_name = aws_backup_vault.main.name
      schedule          = "cron(0 6 1 * ? *)"
      lifecycle {
        cold_storage_after = 30
        delete_after       = 365
      }
      dynamic "copy_action" {
        for_each = aws_backup_vault.copy
        content {
          destination_vault_arn = copy_action.value.arn
          lifecycle {
            cold_storage_after = 30
            delete_after       = 365
          }
        }
      }
    }
  }
  tags = local.tags
}

data "aws_iam_policy_document" "backup_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup" {
  name               = "${local.prefix}-backup"
  assume_role_policy = data.aws_iam_policy_document.backup_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_backup_selection" "main" {
  name         = local.prefix
  plan_id      = aws_backup_plan.main.id
  iam_role_arn = aws_iam_role.backup.arn
  resources = [
    aws_db_instance.main.arn,
    aws_s3_bucket.media.arn,
  ]
}
