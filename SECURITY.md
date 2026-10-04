# Security policy

NIXZORA is a portfolio project under active development. If you find a security issue, please
do not open a public issue. Use GitHub's **Report a vulnerability** button on the Security tab of
this repository (also linked from `/.well-known/security.txt` on the website).

## What to include

The steps to reproduce, the impact you observed, and the account or URL you used. You can
expect an acknowledgement within a few days and a fix or a plan within two weeks for anything
serious.

## Scope and safe harbor

Test against **staging** only (`staging.nixzora.com`, `api.staging.nixzora.com`,
`ops.staging.nixzora.com`), with your own test accounts and Stripe test cards. Production,
volumetric denial of service, social engineering, other people's data and third parties (Stripe,
Google, Apple, AWS, Anthropic) are out of scope. Good-faith research within these rules will not
be pursued; stop and report as soon as you reach someone else's data or a secret.

## More

- Threat model: [docs/security/threat-model.md](docs/security/threat-model.md)
- Pen-test checklist, rules of engagement and automated checks:
  [docs/security/pentest-checklist.md](docs/security/pentest-checklist.md)
