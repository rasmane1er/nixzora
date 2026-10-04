# Phase 9 plan: launch readiness

- **Dates:** Aug 23 – Oct 3, 2027 (6 weeks, about 12 hours a week), after Phase 8.
- **Release:** v2.5, production open to the public.
- **Replaces** the buffer task "Plan Phase 3 in detail": Phases 0–8 shipped ahead of schedule, so
  the next plan is the one that turns the staging platform into a store that takes real money.

## Goal

Production takes real orders and pays real sellers, has passed an independent security test,
and has been restored from backup at least once. Everything else stays as it is: no new
features in this phase.

**Exit criteria**

1. A real order paid with a live card, shipped, delivered and refunded in production; a seller
   paid out through Stripe Connect live.
2. An external pen test of staging with no open high or critical findings.
3. A production restore drill passed, with the report committed.
4. The iOS and Android apps public in the App Store and Google Play.
5. Two weeks of invite-only soft launch inside the SLOs before opening to everyone.

## Before Phase 9 starts (carried over)

These are built and waiting on accounts or a run; they gate the phase.

| Task  | What is left                                                   | Who                                         |
| ----- | -------------------------------------------------------------- | ------------------------------------------- |
| p3-07 | Stripe test keys and webhook secret in staging, one test order | Owner (keys), then Claude checks deliveries |
| p3-10 | SES production access                                          | Owner (AWS request)                         |
| p5-05 | Apple Pay / Google Pay tried on a device build                 | Owner (build, device)                       |
| p5-06 | Order push notifications tried on a device build               | Owner                                       |
| p5-07 | Universal and app links tried on a device build                | Owner                                       |
| p5-10 | TestFlight and Play internal builds                            | Owner (`release:first`)                     |
| p8-10 | First staging restore drill report                             | Owner (CloudShell), Claude commits report   |

## Work, by week

| Week | Task  | Work                                                                                                                                                | Owner                                     |
| ---- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1    | p9-01 | Production environment: apply `environments/production`, secrets, DNS, first deploy and smoke test (runbook: first-deploy)                          | Owner applies; Claude prepares and checks |
| 1    | p9-02 | Email for real: SES domain with DKIM, SPF and DMARC; bounce and complaint handling (suppress addresses that bounce)                                 | Claude builds; owner verifies domain      |
| 2    | p9-03 | Stripe live: activate the account, live keys and webhook in production, Connect live, Apple Pay domain verification                                 | Owner (account); Claude checks            |
| 2    | p9-04 | Connect `account.updated` webhook, so seller verification changes arrive without a refresh                                                          | Claude                                    |
| 2    | p9-05 | Seller shipments: verify tracking numbers with carrier webhooks before earnings are released                                                        | Claude                                    |
| 3    | p9-06 | Content Security Policy nonces instead of inline scripts (storefront and Ops Center)                                                                | Claude                                    |
| 3    | p9-07 | Uploads: re-encode images (strips EXIF, resizes) and scan for malware before they are served                                                        | Claude                                    |
| 3–4  | p9-08 | External penetration test of staging using the [pen-test checklist](../security/pentest-checklist.md); fix findings, add a regression test for each | Owner hires; Claude fixes                 |
| 4    | p9-09 | Legal and policies reviewed: Terms, Privacy, seller agreement, returns, cookie notice; sales-tax registration where required                        | Owner (with a professional)               |
| 4    | p9-10 | Backups in a second region (AWS Backup copy), then a production restore drill                                                                       | Claude builds; owner runs                 |
| 5    | p9-11 | On-call: alerts to phone (not only email), a public status page, one practice incident using the incident runbook                                   | Claude builds; owner tests                |
| 5    | p9-12 | App Store and Google Play public release: listings, screenshots, privacy labels, review                                                             | Owner submits; Claude prepares            |
| 5    | p9-13 | Assistant on the paid models: evaluate Claude and Voyage on a larger set of real shopper questions; set the daily AI budget for production          | Claude                                    |
| 6    | p9-14 | Soft launch: invite-only for two weeks, watch SLOs, fraud reviews and support; then open to the public                                              | Owner decides; Claude watches             |

## Risks

| Risk                                            | Plan                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Stripe or Apple review takes longer than a week | Start p9-03 and p9-12 paperwork in week 1; nothing else waits on them                      |
| The pen test finds something structural         | Booked for weeks 3–4 so fixes fit before launch; launch moves rather than shipping with it |
| Real fraud after opening                        | Fraud signals start in enforce mode with the review score lowered for the soft launch      |
| Costs grow before revenue                       | Read replica, Kafka and EKS stay off in production until load needs them (ADR-0021, -0022) |

## Not in Phase 9

New features, more product categories, more countries (the store stays US-only), seller staff
accounts. They go into the plan after launch, based on what the soft launch shows.
