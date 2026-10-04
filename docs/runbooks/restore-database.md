# Runbook: restoring the database

Rehearse it on staging every quarter with `scripts/dr/restore-drill.sh`
([disaster recovery](disaster-recovery.md)), which also times it.

## Point-in-time recovery (mistake in the last N days)

1. Pick the time just before the problem (UTC).
2. Restore to a **new** instance (the original stays untouched):
   ```bash
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier nixzora-production \
     --target-db-instance-identifier nixzora-production-restore \
     --restore-time 2027-03-01T14:05:00Z \
     --db-subnet-group-name nixzora-production \
     --vpc-security-group-ids <data security group id> --no-publicly-accessible
   ```
3. Check the copy before using it: run the restore check as a one-off task of the migrate image
   with `DATABASE_HOST` set to the new instance and the command
   `node dist/cli/verify-restore.js --restore-time <the time>` (the drill script shows how). It
   must pass; compare its row counts with what you expect.
4. Either copy the missing rows back into production, or switch over: put the API in maintenance
   (scale `api` to 0), rename instances (`modify-db-instance --new-db-instance-identifier`),
   then scale `api` back up. Terraform still refers to `nixzora-production`, so after a switch the
   restored instance must carry that name.

## From AWS Backup (older than the PITR window)

AWS Backup console → vault `nixzora-production` → choose a recovery point → Restore, with the
same subnet group and security group, then continue from step 3.

## Afterwards

- Note the incident and time to recover in `docs/incidents/`.
- Delete the extra instance when done (it costs money).
