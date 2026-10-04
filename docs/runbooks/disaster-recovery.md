# Runbook: disaster recovery and the quarterly drill

What we can lose, how fast we come back, and how we prove it. Step-by-step database restores:
[restore-database.md](restore-database.md).

## Targets

| What                     | Recovery point (data we may lose)                                         | Recovery time (back in service) |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------- |
| Database                 | 5 minutes (RDS point-in-time recovery)                                    | 1 hour                          |
| Database, older mistakes | 1 day (AWS Backup daily, kept 35 days; monthly kept a year in production) | 2 hours                         |
| Product images (S3)      | Nothing: every version is kept                                            | Minutes, per file               |
| Redis                    | Carts, sessions and caches: rebuilt or signed in again                    | Minutes (replaced by Terraform) |
| Kafka (if on)            | Nothing: the outbox in PostgreSQL replays it                              | Minutes                         |
| Code and images          | Nothing: Git and ECR                                                      | One deploy (~15 minutes)        |

The point-in-time window is 3 days on staging and 14 in production (`backup_retention_days`).
Production runs PostgreSQL and Redis in two availability zones, so losing one zone fails over on
its own in a minute or two. For a whole-region outage, production copies every AWS Backup
recovery point (database and media) to a vault in a second region, `us-west-2` by default
(`backup_copy_region`, p9-10): see "Losing the region" below. Staging has no copy, to save cost.

## What to do

| Situation                                    | Do this                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A bad release                                | Roll back: [deploy-and-rollback.md](deploy-and-rollback.md). No restore.                                             |
| Data deleted or damaged by a bug or a person | Point-in-time restore to a new instance, then copy rows back or switch ([restore-database.md](restore-database.md)). |
| A migration broke the schema                 | Same as above, to the minute before the deploy.                                                                      |
| An image or upload deleted                   | S3 console → the media bucket → Show versions → restore the previous version.                                        |
| The database instance is gone                | Restore the newest AWS Backup recovery point, with the old name (Terraform expects it).                              |
| One availability zone down                   | Nothing (production fails over). Watch the dashboards; staging waits.                                                |
| The whole region is down                     | Restore from the copy vault in the second region (below). Recovery point: up to a day.                               |

Before sending traffic to any restored database, run the restore check against it (below): it
must pass.

## Losing the region

The copy vault `nixzora-production-copy` in the second region holds the daily (35 days) and
monthly (a year) recovery points of the database and the media bucket.

1. AWS Backup console → switch to the second region → Backup vaults →
   `nixzora-production-copy` → choose the newest RDS recovery point → **Restore** with the
   instance id `nixzora-production` and the database subnet group of the new region. Restore the
   newest S3 recovery point into a new media bucket the same way.
2. Bring up the platform there: a copy of `environments/production` with `aws_region` set to the
   second region (and that region's VPC, certificates and DNS). Point it at the restored
   instance by name; Terraform adopts it with `terraform import`.
3. Run the restore check against it (below), then move DNS.

This is hours of work, not minutes: it is for losing the region for days, not for a short
outage. Rehearse step 1 once a year on a copy of production's backup.

## The drill (every quarter, on staging)

`scripts/dr/restore-drill.sh` does the whole rehearsal and writes a report:

1. Restores staging's database to the latest restorable time, on a new temporary instance with
   the same network and size (production is never touched).
2. Gives the copy the current database password, then runs the release's restore check
   (`node dist/cli/verify-restore.js`) as a one-off task of the migrate image, inside the VPC:
   every migration applied and none half-done, every table there with its row count, the event
   tables still partitioned, the audit log still append-only, and how old the newest write is
   (the data lost).
3. Checks AWS Backup has a recovery point from the last 26 hours.
4. Uploads a test file to the media bucket, deletes it, brings it back from its previous
   version, and removes every trace of it.
5. Writes `docs/dr-drills/<date>-<env>.md` with the times, and deletes the temporary instance.

In production (or any environment with a copy), set `COPY_REGION` and the drill also checks
that the second region has a recovery point from the last 30 hours.

Run it from CloudShell, in the repository:

```sh
git pull
ENV=staging scripts/dr/restore-drill.sh
# or to a chosen time, keeping the copy to look around (delete it after):
ENV=staging RESTORE_TIME=2027-03-01T14:05:00Z KEEP=1 scripts/dr/restore-drill.sh
```

It takes 15 to 30 minutes (most of it is RDS creating the instance) and costs a few cents.
Commit the report. If the result is FAILED, the report says which check; fix it before the
next release.

Locally, the check runs against your own database: `pnpm --filter @nixzora/api build && pnpm --filter @nixzora/api dr:verify`.

## Not covered yet

- **Terraform state in another region.** The backups are copied (p9-10), but the state bucket
  is not replicated; rebuilding in another region starts from a fresh state and imports.
- **Secrets.** Secrets Manager keeps deleted secrets for 7 to 30 days; restore them from there.
  The Stripe, Anthropic and Voyage keys can also be issued again from their dashboards.
