# Sign in with Google and Apple

Customers can sign in (or sign up) with Google or Apple on the storefront and in the mobile app.
Staff sign in to the Ops Center with a password and two-step verification only.

## How it works

1. The provider's own SDK shows its button and returns an **ID token** (a signed JWT):
   Google Identity Services and Sign in with Apple JS on the web; Sign in with Apple and
   Google (via `expo-auth-session`) in the app.
2. The app sends it to `POST /api/v1/auth/social` with the one-time **nonce** it put in the request.
3. The API checks the signature against Google's / Apple's published keys, the issuer, that the
   audience is one of _our_ client ids, that the token is under an hour old, and the nonce.
4. It signs in the account linked to that provider account; otherwise links the account with the
   same email **only if the provider verified that email**; otherwise creates a customer account.
   Two-step verification still applies.

No provider secret is stored anywhere: we never exchange authorization codes, so the only settings
are public client ids. Buttons appear only for providers that have ids configured
(`GET /api/v1/auth/social/providers`).

Accounts created this way have no password. They can add one with "Forgot password", and close the
account by typing DELETE instead of a password.

## Google (about 10 minutes)

In [Google Cloud console](https://console.cloud.google.com) → the NIXZORA project (the Firebase
project works) → **APIs & Services**:

1. **OAuth consent screen**: External, app name NIXZORA, support email, the storefront domain as an
   authorized domain, scopes `openid`, `email`, `profile`. Publish it.
2. **Credentials → Create credentials → OAuth client ID**, three times:
   - _Web application_: authorized JavaScript origins `https://staging.nixzora.com` (and
     `http://localhost:3000` for development). → `GOOGLE_WEB_CLIENT_ID`
   - _iOS_: bundle id `com.nixzora.shop` (one per variant you ship). → `GOOGLE_IOS_CLIENT_ID`.
     Its "iOS URL scheme" (`com.googleusercontent.apps.…`) goes into the EAS environment variable
     `GOOGLE_IOS_URL_SCHEME`.
   - _Android_: package `com.nixzora.shop` and the SHA-1 of the Play app-signing key (Play Console
     → App integrity) and of the EAS upload key (`eas credentials`). → `GOOGLE_ANDROID_CLIENT_ID`

## Apple (about 10 minutes, needs the paid developer account)

In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources):

1. **Identifiers → App IDs → com.nixzora.shop**: enable _Sign in with Apple_ (primary App ID).
   Native sign-in in the app then works with no further settings.
2. **Identifiers → Services IDs → +**: `com.nixzora.shop.web`, enable _Sign in with Apple_ →
   Configure: primary App ID `com.nixzora.shop`, domain `staging.nixzora.com`, return URL
   `https://staging.nixzora.com/account/login`. → `APPLE_SERVICES_ID`
3. To email people who use "Hide My Email", register `orders@nixzora.com` under
   **Services → Sign in with Apple for Email Communication**.

## Turn it on

Staging: add the ids to `staging.tfvars` and apply:

```hcl
sign_in_client_ids = {
  GOOGLE_WEB_CLIENT_ID     = "…apps.googleusercontent.com"
  GOOGLE_IOS_CLIENT_ID     = "…apps.googleusercontent.com"
  GOOGLE_ANDROID_CLIENT_ID = "…apps.googleusercontent.com"
  APPLE_SERVICES_ID        = "com.nixzora.shop.web"
}
```

Local development: set the same names in `.env`. The mobile app reads the ids from the API; only
`GOOGLE_IOS_URL_SCHEME` is needed at build time, and a new development build is required after
adding `expo-apple-authentication`.

App Store rule 4.8: an iOS app that offers Google sign-in must also offer Sign in with Apple, which
is why both ship together.
