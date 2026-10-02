# Runbook: ship the mobile app to TestFlight and Google Play internal testing

Goal: installable test builds of NIXZORA for iPhone (TestFlight) and Android (Play internal
testing), pointing at the staging API. Do the one-time setup once; after that a release is
one click in GitHub Actions.

Time: about 2 hours the first time (mostly waiting for Apple and Google), 20 minutes per
release afterwards.

## Current setup (October 2026)

| Item             | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Expo project     | `@grasmane/nixzora`, id `39db3a5f-ab8e-467b-a427-b7641d6ea56d` (in `app.config.ts`) |
| Apple team       | `7HD2Z858BV` (individual)                                                           |
| Google Play app  | NIXZORA Preview, `com.nixzora.shop.preview` (draft, internal testing)               |
| Firebase project | `nexora-66e0b`, Android app `com.nixzora.shop.preview`                              |

Quick path for the first release, from `apps/mobile` on your Mac:

```bash
pnpm install
pnpm --filter @nixzora/mobile release:first -- --api-url https://api.staging.<your domain>
```

The script sets the build variables in EAS, uploads `google-services.json` from Downloads,
builds iOS and Android in the Expo cloud, sends iOS to TestFlight and tries the Android upload
(Google needs the very first one by hand; the script tells you how). The sections below explain
each step in detail.

## What you need (one time)

| Account                                                          | Cost            | Used for                            |
| ---------------------------------------------------------------- | --------------- | ----------------------------------- |
| [Expo](https://expo.dev/signup)                                  | Free tier is OK | EAS Build, EAS Submit, push service |
| [Apple Developer Program](https://developer.apple.com/programs/) | US$99 / year    | TestFlight, Apple Pay, push (APNs)  |
| [Google Play Console](https://play.google.com/console/signup)    | US$25 once      | Internal testing track              |
| [Firebase](https://console.firebase.google.com) project          | Free            | Android push (FCM)                  |

The staging environment of the API should be deployed first (see
[first deploy](first-deploy.md)), so testers have something real to shop against.

## 1. Link the app to Expo

```bash
npm install -g eas-cli
eas login
cd apps/mobile
eas init            # creates the Expo project; prints its id
```

Put the id (and your Expo account name) in `apps/mobile/.env` — it is a public identifier:

```bash
EAS_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EXPO_OWNER=your-expo-account
```

Then create the build-time variables in EAS (Expo dashboard → Project → Environment variables,
or the CLI):

```bash
for env in preview production; do
  eas env:create --environment $env --name EAS_PROJECT_ID --value <id> --visibility plaintext
  eas env:create --environment $env --name EXPO_OWNER --value <account> --visibility plaintext
  eas env:create --environment $env --name APP_LINK_DOMAIN --value <storefront domain> --visibility plaintext
done
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://api.staging.<domain> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_WEB_URL --value https://staging.<domain> --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.<domain> --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_WEB_URL --value https://<domain> --visibility plaintext
```

## 2. iOS: App Store Connect, signing, push, Apple Pay

1. In [App Store Connect](https://appstoreconnect.apple.com) → Apps → **+** → New App:
   name "NIXZORA Preview", bundle id `com.nixzora.shop.preview`, SKU `nixzora-preview`.
   Copy the **Apple ID** of the app (a number) into `apps/mobile/eas.json` →
   `submit.preview.ios.ascAppId` and commit it (it is not secret).
2. Apple Pay merchant id: Apple Developer → Identifiers → **+** → Merchant IDs →
   `merchant.com.nixzora.shop`. In the Stripe dashboard → Settings → Payment methods → Apple Pay
   → iOS certificates → follow "Add new application" (download Stripe's CSR, upload it to Apple,
   upload Apple's certificate back to Stripe).
3. Run the first build interactively so EAS can create the distribution certificate,
   provisioning profile and **push key (APNs)** for you:

   ```bash
   eas build --platform ios --profile preview
   ```

   Answer "yes" to letting EAS manage credentials and to setting up push notifications.

4. Submit it: `eas submit --platform ios --profile preview --latest`. After Apple's automated
   processing (10–30 minutes) add yourself and up to 100 internal testers in TestFlight.

## 3. Android: Play Console, FCM, first upload

1. Firebase → Add project → Add app → Android, package `com.nixzora.shop.preview` → download
   `google-services.json`. Store it as an EAS **file** variable (never commit it):

   ```bash
   eas env:create --environment preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret
   rm google-services.json
   ```

2. Firebase → Project settings → Service accounts → Generate new private key. Upload it to EAS
   for push: `eas credentials` → Android → preview → Google Service Account → **FCM V1**.
3. Play Console → Create app "NIXZORA Preview". Build: `eas build --platform android --profile preview`.
   Google requires the **first** upload by hand: Testing → Internal testing → Create release →
   upload the `.aab` from the EAS build page. Add testers (an email list).
4. For automatic uploads afterwards: Google Cloud → service account with the "Service Account
   User" role, invite it in Play Console → Users and permissions (release manager), create a JSON
   key, and upload it with `eas credentials` → Android → Google Service Account → **Play Store
   submissions**.

## 4. Links that open in the app

1. Find the signing fingerprints: `eas credentials` → Android → preview → shows the keystore
   SHA-256. If Play App Signing is on, also copy the **app signing key** SHA-256 from Play
   Console → Setup → App integrity.
2. Find your Apple Team ID (Apple Developer → Membership).
3. Tell the storefront (Terraform variable in `environments/staging/terraform.tfvars`):

   ```hcl
   mobile_app_links = {
     ios_app_ids               = ["TEAMID1234.com.nixzora.shop.preview"]
     android_package           = "com.nixzora.shop.preview"
     android_cert_fingerprints = ["AA:BB:...:FF"]
   }
   ```

   Apply, then check `https://<staging domain>/.well-known/apple-app-site-association` and
   `/.well-known/assetlinks.json` answer with JSON.

## 5. Push from the API

The production task definition sets `PUSH_DRIVER=expo`. If you turn on "Enhanced security for
push notifications" in the Expo project, create an access token in Expo and store it as
`EXPO_ACCESS_TOKEN` in the app secret (same procedure as in [rotate secrets](rotate-secrets.md)).

## 6. Every release after that

1. GitHub → Settings → Environments → **mobile** → add the secret `EXPO_TOKEN`
   (Expo → Account settings → Access tokens). Optionally require a reviewer.
2. Actions → **Mobile release** → Run workflow → profile `preview`, platform `all`.
   The workflow lints, type-checks and tests the app, then starts EAS builds that are submitted
   to TestFlight and Play internal testing automatically.
3. Build numbers increase automatically (`appVersionSource: remote`). Change `version` in
   `app.config.ts` for a new marketing version.

## Before inviting external testers or going to the stores

- Privacy policy URL and support URL in both stores.
- App Privacy (Apple) and Data safety (Google) forms: email, name, address, purchase history,
  device push token; no tracking; data deletion available in the app (Account → Delete account).
- Screenshots: 6.7" and 6.5" iPhone, and Android phone.
- Sign in with a demo customer account for reviewers (fill in "App Review Information").

## Troubleshooting

| Symptom                              | Fix                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| "Order updates: Not available"       | Simulator/emulator, or `EAS_PROJECT_ID` missing in the build's environment            |
| Pushes never arrive on Android       | FCM V1 key not uploaded, or `GOOGLE_SERVICES_JSON` missing for that environment       |
| Apple Pay button missing             | Merchant id not in the provisioning profile: rebuild after creating it; Stripe cert   |
| Links open the browser, not the app  | `.well-known` files return 404 (Terraform variable empty) or the fingerprint is wrong |
| App shows "You appear to be offline" | `EXPO_PUBLIC_API_URL` wrong for that environment; it is baked in at build time        |
