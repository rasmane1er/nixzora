# ADR-0002: Authentication and sessions

- Status: Accepted · implemented in Phase 1
- Date: 2026-10-05 (updated 2026-10-19)

## Context

NIXZORA needs customer accounts on web and mobile, staff accounts for the Ops Center, and later seller accounts. Requirements from the plan: OAuth2/OIDC readiness, JWT, MFA, device and session management, RBAC, and audit trails.

Options considered:

1. A hosted identity provider (Cognito, Auth0, Clerk): fastest, but less to show in a portfolio and adds per-user cost.
2. An in-house auth module following current OWASP guidance, designed so an external OIDC provider can be added later.

## Decision

Build an in-house `identity` module (option 2). How it works today:

- **Passwords**: Argon2id (m = 19 MiB, t = 2, p = 1, the OWASP minimum) via `@node-rs/argon2`. 12 to 128 characters, no composition rules (NIST SP 800-63B). Optional breached-password screening with Have I Been Pwned's k-anonymity API (`PASSWORD_BREACH_CHECK=true`). Unknown emails still run a hash check so timing does not reveal accounts.
- **Access tokens**: 15-minute JWTs signed with **Ed25519 (EdDSA)**, `typ: at+jwt`, issuer and audience checked. Library: `jose` v5 (CommonJS build; v6 is ESM-only). Claims: `sub`, `sid` (session id), `amr` (`pwd`, plus `otp` after MFA).
- **Every request checks the session in PostgreSQL**, so sign-out, device revocation, password reset and account suspension take effect immediately, not when the token expires. A Redis cache can be added if this lookup ever shows up in profiles.
- **Refresh tokens**: 256-bit opaque values, stored only as SHA-256 hashes in `sessions`, **rotated on every use** with a conditional update (two racing refreshes cannot both win). Presenting the previous token again revokes the session and writes `auth.refresh.reuse_detected` to the audit log.
- **Where clients keep tokens**: the API returns tokens in the response body. Mobile stores the refresh token in the iOS Keychain / Android Keystore. The web storefront and Ops Center call the API from their Next.js server (backend-for-frontend) and keep tokens in `HttpOnly`, `Secure`, `SameSite=Lax` cookies on their own domain, so browser JavaScript never sees them. The API therefore needs no cookies and no CSRF handling. _(Changed from the original draft, which put a cookie on the API itself.)_
- **MFA**: TOTP (RFC 6238, SHA-1, 6 digits, 30 s, ±1 step), implemented on Node's `crypto` and tested against the RFC vectors. Secrets are encrypted with AES-256-GCM (`MFA_ENCRYPTION_KEY`). Each time step is accepted once per user (replay protection in Redis). Ten single-use recovery codes, stored hashed. Login with MFA on returns a 5-minute challenge token instead of tokens.
- **Staff must use MFA**: any route that requires a staff permission (`admin.access`, `audit.read`, `orders.refund`, …) also requires a session that passed MFA. Otherwise the API answers `403` with `code: "MFA_REQUIRED"`.
- **Lockout**: after `LOGIN_MAX_FAILURES` (default 10) failures for one email in `LOGIN_LOCKOUT_MINUTES` (default 15), sign-in for that email pauses. Per-IP limits apply on top (5/min for sign-up and password reset, 10/min for sign-in).
- **Email links**: verification (24 h) and password reset (30 min) tokens are single-use, stored hashed, and only the newest link of each kind works. A password reset signs out every device.
- **RBAC**: `roles`, `permissions`, `role_permissions`, `user_roles`. Roles seeded by migration: `customer`, `support`, `catalog_manager`, `admin`. Routes declare `@RequirePermissions('audit.read')`; everything is authenticated unless marked `@Public()`.
- **Audit**: sign-ups, sign-ins (success, failure, lockout, MFA challenge), refresh-token reuse, sign-outs, session revocations, MFA changes, email verification and password changes all go to the append-only `audit_logs` table.
- Social sign-in and enterprise SSO arrive later through standard OIDC, reusing the same session model.

## Accepted risks

- **Sign-up reveals that an email is registered** (409). Mitigated by the 5/min per-IP limit and an email to the real owner. Revisit if enumeration becomes a problem: switch to "check your email" for every sign-up.
- **Lockout can be triggered by someone who knows a customer's email.** It is temporary, and a password reset clears it.

## Consequences

- More code to own, covered by unit tests (crypto, TOTP vectors, config) and an end-to-end suite against real PostgreSQL and Redis.
- No vendor lock-in or per-user identity fees.
- Strong portfolio evidence of security engineering.
