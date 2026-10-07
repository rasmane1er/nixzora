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

The Stripe keys can also be set on their own, hidden as you paste them:
`ENV=staging scripts/ops/set-stripe-keys.sh`. Set them before switching `PAYMENTS_PROVIDER` to
`stripe`, or the new API tasks refuse to start.

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

Terraform also sets up the sending domain's DKIM, SPF (via `mail.<domain>`) and DMARC records,
and bounce and complaint feedback. After the first deploy with it, check SNS → Topics →
`nixzora-staging-ses-events` → Subscriptions: the API's endpoint should be **Confirmed**. If it
says pending, choose **Request confirmation**. Details: [email deliverability](email-deliverability.md).

## 8. Production (p9-01)

Production shares the AWS account, the hosted zone and the image repositories with staging, and
serves the main domain (`<domain>`, `www`, `api.`, `ops.`, `media.`, `status.`). Two things are
shared and therefore owned by one environment only:

- **The main domain.** Until production exists, staging redirects `<domain>` and `www` to the
  staging site (`redirect_main_domain`, on by default). Turn it off right before creating
  production, or production cannot create those records.
- **The email domain** (SES identity, DKIM, DMARC, `mail.<domain>`). Staging owns it
  (`email_domain_owner`, on by default); production sets `email_domain_owner = false` and gets its
  own configuration set and feedback topic. Before ever destroying staging, move ownership: set
  it to `true` in production and `false` in staging, `terraform state rm` the six resources in
  staging and `terraform import` them in production.

Order (CloudShell, `TF_DATA_DIR=/tmp/tfdata` keeps provider plugins off the 1 GB home disk):

1. **Settings.** In `environments/production`: `backend.hcl` (same bucket as staging; the state
   key is `production/terraform.tfstate`) and `production.tfvars` (same `domain_name`,
   `hosted_zone_id`, `image_repositories` and `alarm_email` as staging; `image_tag` = the commit
   staging runs). Optional: `ops_allowed_cidrs` for a private Ops Center, `oncall_webhook_url`.
2. **Plan only**: `terraform plan -var-file=production.tfvars -out=/tmp/prod.plan`. Review it
   and the monthly cost (below) before going on. Nothing has changed yet.
3. **Hand over the main domain**: in `environments/staging`,
   `terraform apply -var-file=staging.tfvars -var redirect_main_domain=false` (and add
   `redirect_main_domain = false` to `staging.tfvars`). From here until step 4 finishes,
   `<domain>` does not answer; staging keeps working.
4. **Create production**: `terraform apply /tmp/prod.plan` (about 20–30 minutes: the Multi-AZ
   database and CloudFront take longest). Confirm the alarm emails it sends.
5. **Secrets** (step 5 above, with the production secret). Stripe **test** keys are fine for the
   smoke test (no money moves); live keys come with p9-03. The API refuses to start without
   `STRIPE_SECRET_KEY`, because production uses Stripe for payments and payouts. Add the two
   Stripe webhook endpoints for `api.<domain>`.
6. **Deploy**: GitHub → Settings → Variables → `PRODUCTION_ENABLED=true`, then run **Deploy**
   with environment `production` and approve it. Create your admin account with the migrate task
   (step 6). Do not seed the demo catalog in production.
7. **Smoke test**: `https://<domain>` loads, sign-up and sign-in work, a receipt email arrives
   (SES must be out of the sandbox, p3-10), the Ops Center opens, `status.<domain>` shows both
   components working, and `scripts/dr/restore-drill.sh` and `scripts/ops/incident-drill.sh` run
   with `ENV=production`.

Later, when convenient: add the production domain as an authorized origin / return URL for
Google and Apple sign-in, then set `sign_in_client_ids` in `production.tfvars` (the buttons stay
hidden until then).

Monthly cost at the default sizes is dominated by two NAT gateways, the Multi-AZ
`db.t4g.medium` database, `cache.t4g.small` Redis, the load balancer and about ten Fargate tasks.
Check the current figures in the AWS Pricing Calculator before step 4.

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
