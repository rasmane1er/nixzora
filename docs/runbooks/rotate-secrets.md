# Runbook: rotating secrets

| Secret                       | How                                                                                          | Effect                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------- |
| Database password            | RDS rotates it automatically (Secrets Manager). Manually: RDS console → Modify → rotate now. | New tasks pick it up; restart services. |
| JWT signing keys             | `keys:generate`, put both keys in the app secret, redeploy.                                  | Everyone signs in again.                |
| MFA encryption key           | Do not rotate without a re-encryption migration — existing TOTP secrets would be unreadable. | —                                       |
| ORDER_LINK_SECRET            | Replace in the app secret, redeploy.                                                         | Old order links in emails stop working. |
| Stripe keys / webhook secret | Roll in the Stripe dashboard, update the app secret, redeploy.                               | None if done in that order.             |
| Redis auth token             | `terraform apply -replace=module.platform.random_password.redis`, then redeploy.             | Brief cache reconnect; carts survive.   |

"Redeploy" = run the **Deploy** workflow, or
`aws ecs update-service --cluster nixzora-<env> --service <name> --force-new-deployment`.
