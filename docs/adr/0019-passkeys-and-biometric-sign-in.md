# ADR-0019: Passkeys on the web, Face ID / fingerprint sign-in in the app

- Status: Accepted
- Date: 2026-10-04
- Roadmap: p8-16 (fingerprint / Face ID sign-in)
- Builds on: ADR-0003 (identity: sessions, refresh-token rotation, two-step verification)

## Context

Shoppers sign in with an email and password, or with Google / Apple. The app could already
_unlock_ a saved session with Face ID or a fingerprint, but after signing out the password was
needed again, and the website had no biometric option at all. Passwords are phished and reused;
two-step codes help but add friction.

## Decision

**Web: passkeys (WebAuthn).** Account → Security → "Add a passkey" creates a discoverable
credential with user verification required, so the browser asks for Touch ID, Face ID, Windows
Hello, the phone's fingerprint or screen lock. Only the public key is stored (`passkeys`). The
login page shows "Sign in with a passkey", and browsers that support it also offer saved
passkeys in the email field's autofill (`autocomplete="username webauthn"`), so no email is
typed. We use SimpleWebAuthn (`@simplewebauthn/server` and `/browser`), with "none" attestation:
we do not restrict which authenticators people use.

- The relying party is the storefront's domain: `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGINS`
  default to `WEB_APP_URL` (e.g. `staging.nixzora.com`), so passkeys made on staging only work on
  staging, and a look-alike site cannot use them.
- Challenges travel in a five-minute signed token (`passkey-challenge+jwt`), so the ceremony is
  stateless across API tasks; Redis remembers used tokens so each works once (fail-open without
  Redis, like the sign-in throttle).
- A passkey sign-in counts as two-step verified (`mfaVerifiedAt` set, `amr: ["hwk", "user"]`):
  it is something you have plus your fingerprint, face or PIN. Staff permissions that require
  two-step therefore accept it.
- The signature counter is stored and updated; synced passkeys (iCloud Keychain, Google Password
  Manager) report 0 and are labelled "Synced" in the account.
- Adding a passkey emails a security notice with a link to remove it.

**App: Face ID / fingerprint sign-in with a rotating device secret.** Native passkeys in the app
need associated domains (Apple Team ID, Android signing certificate) and a new native module; we
will add them with the next native build. Until then: Settings → "Sign in with Face ID" (or the
offer after a password sign-in) asks for the biometric, then `POST /me/device-sign-ins` returns a
random secret, shown once and stored in the Keychain / Keystore (this device only, not backed
up). Only its SHA-256 is stored (`device_sign_ins`). Signing in asks for the biometric, sends the
secret to `POST /auth/device`, and gets a session plus a **new** secret; the old one stops
working, so a copied secret is useless once the phone signs in again. The secret survives
sign-out (that is the point) and is removed when the feature is turned off, the account is
deleted, or the server refuses it. These sessions also count as two-step verified
(`amr: ["swk", "user"]`).

**Managing them.** Account → Security lists passkeys (rename via API, remove) and the phones
with Face ID / fingerprint sign-in (turn off). Both are audit-logged
(`auth.passkey.added/removed/sign_in_failed`, `auth.device_sign_in.enabled/revoked/failed`).
Both cascade-delete with the account.

## Consequences

- No password is needed day to day, and passkeys cannot be phished. Passwords stay for account
  recovery and for browsers without passkey support.
- Changing the password does not remove passkeys or device sign-ins (they are separate
  factors); the security notices and the Security page make them visible.
- Native app passkeys (sharing the web passkeys) remain to do: `IOS_APP_IDS` / Android asset
  links on the storefront, and a passkey module in the next native build.
