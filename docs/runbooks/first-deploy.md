# Runbook: first deployment to AWS

Time: about 2 hours, most of it waiting for DNS and certificates. You need an AWS account,
a domain in Route 53, the AWS CLI, Terraform ≥ 1.10 (or OpenTofu), and admin rights on the
GitHub repository.

## 1. Bootstrap the account (once)

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply -var github_repository=<owner>/<repo>
```

Note the outputs: `state_bucket`, `ecr_repositories`, `deploy_role_arn`.

## 2. GitHub settings

- Repository variables: `AWS_REGION` (e.g. `us-east-1`), `ECR_REGISTRY` (`<account>.dkr.ecr.<region>.amazonaws.com`).
- Repository secret: `AWS_DEPLOY_ROLE_ARN` = the `deploy_role_arn` output.
- Environments `staging` and `production`, each with variables `STOREFRONT_URL` and `API_URL`.
  On `production`, add yourself as a required reviewer.

## 3. First images

Push to `main` (or run the **Deploy** workflow manually). The image job pushes
`nixzora/api:<sha>`, `nixzora/api:<sha>-migrate`, `nixzora/storefront:<sha>` and `nixzora/admin:<sha>`.
The deploy jobs fail until step 4 exists; that is expected.

## 4. Create the staging environment

```bash
cd infra/terraform/environments/staging
cp backend.hcl.example backend.hcl        # set the state bucket
cp staging.tfvars.example staging.tfvars  # domain, zone id, repositories, image_tag=<sha>, alarm_email
terraform init -backend-config=backend.hcl
terraform apply -var-file=staging.tfvars
```

Confirm the SNS email subscription that arrives at `alarm_email`.

## 5. Set the application secrets

Generate signing keys on your machine and store them (they never go through Terraform):

```bash
pnpm --filter @nixzora/api keys:generate   # prints JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, MFA_ENCRYPTION_KEY
SECRET_ARN=$(terraform output -json platform | jq -r .app_secret_arn)
aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text > /tmp/app.json
# Edit /tmp/app.json: paste the three keys, and the Stripe test keys (sk_test_…, pk_test_…, whsec_…).
aws secretsmanager put-secret-value --secret-id "$SECRET_ARN" --secret-string file:///tmp/app.json
shred -u /tmp/app.json
```

Stripe webhook: in the Stripe dashboard add an endpoint
`https://api.<staging host>/api/v1/payments/webhooks/stripe` for `payment_intent.*` events and
`charge.dispute.created` (chargebacks feed the fraud reviews, ADR-0024); its signing secret is
`STRIPE_WEBHOOK_SECRET`.

Stripe Connect webhook (sellers): add a second endpoint
`https://api.<staging host>/api/v1/payments/webhooks/stripe-connect`, choose **Events on
Connected accounts**, event `account.updated`. Its signing secret is
`STRIPE_CONNECT_WEBHOOK_SECRET`. The key must exist in the app secret (empty is fine) before a
Terraform apply, or new tasks will not start.

## 6. Deploy and seed

Re-run the **Deploy** workflow (staging). It runs migrations, rolls out the three services and
smoke-tests them. Then, for the demo catalog and your admin account, run one-off tasks with the
migrate image (it contains the full toolchain):

```bash
aws ecs run-task --cluster nixzora-staging --task-definition nixzora-staging-migrate \
  --launch-type FARGATE --network-configuration "$(aws ecs describe-services --cluster nixzora-staging --services api --query 'services[0].networkConfiguration')" \
  --overrides '{"containerOverrides":[{"name":"migrate","command":["pnpm","prisma","db","seed"]}]}'
# Same with: ["pnpm","admin:create","you@example.com"]  — the temporary password is in the task's log.
```

## 7. Email

In the SES console, request production access (out of the sandbox) for the region. Until then,
receipts only reach verified addresses.

## 8. Production

Repeat steps 4–6 in `environments/production` (use **live** Stripe keys, set
`ops_allowed_cidrs` to your IP if you want the Ops Center private). Deploys to production then
wait for your approval in GitHub after staging succeeds.

## 9. Turn on the real AI models (optional)

The search index and the shopping assistant run on free local drivers until you switch them
(ADR-0009). The API builds the search index itself at startup; `POST /api/v1/admin/search/reindex`
(or `pnpm --filter @nixzora/api search:reindex` in a one-off task) rebuilds it on demand.

1. Get keys: an Anthropic API key (console.anthropic.com) and a Voyage AI key (voyageai.com,
   200M free tokens on `voyage-4-lite`).
2. Store them in the AI secret without printing them:

   ```bash
   SECRET=nixzora/staging/ai
   read -rs ANTHROPIC && read -rs VOYAGE
   aws secretsmanager put-secret-value --secret-id "$SECRET" \
     --secret-string "$(jq -n --arg a "$ANTHROPIC" --arg v "$VOYAGE" '{ANTHROPIC_API_KEY:$a, VOYAGE_API_KEY:$v}')"
   unset ANTHROPIC VOYAGE
   ```

3. In `environments/staging/main.tf`, add to `app_config`:
   `AI_DRIVER = "anthropic"`, `EMBEDDINGS_DRIVER = "voyage"` and, if you like, a different
   `AI_DAILY_BUDGET_CENTS` (default 200 = $2/day). Apply, then redeploy.
4. The new embedding model re-embeds every product automatically at startup. Check the
   evaluation set against the real models (`eval:assistant`) and the AI usage panel.

Rolling back is the reverse: set both drivers to `local` and redeploy; nothing else changes.
