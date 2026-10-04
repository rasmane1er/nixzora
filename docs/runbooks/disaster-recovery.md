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
its own in a minute or two. A whole-region outage is not covered: it would mean rebuilding in
another region from Terraform and a backup copied there (not set up; see "Not covered yet").

## What to do

| Situation                                    | Do this                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A bad release                                | Roll back: [deploy-and-rollback.md](deploy-and-rollback.md). No restore.                                             |
| Data deleted or damaged by a bug or a person | Point-in-time restore to a new instance, then copy rows back or switch ([restore-database.md](restore-database.md)). |
| A migration broke the schema                 | Same as above, to the minute before the deploy.                                                                      |
| An image or upload deleted                   | S3 console → the media bucket → Show versions → restore the previous version.                                        |
| The database instance is gone                | Restore the newest AWS Backup recovery point, with the old name (Terraform expects it).                              |
| One availability zone down                   | Nothing (production fails over). Watch the dashboards; staging waits.                                                |

Before sending traffic to any restored database, run the restore check against it (below): it
must pass.

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

- **Another region.** For a regional outage: copy AWS Backup recovery points to a second region
  (a `copy_action` in `backup.tf` with a vault there) and keep the Terraform state bucket
  replicated. Worth it once production carries real revenue.
- **Secrets.** Secrets Manager keeps deleted secrets for 7 to 30 days; restore them from there.
  The Stripe, Anthropic and Voyage keys can also be issued again from their dashboards.
