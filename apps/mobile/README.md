# NIXZORA mobile app

The NIXZORA shop for iPhone and Android, built with Expo (React Native). See
[the architecture notes](../../docs/architecture/mobile.md) for how it works and
[the release runbook](../../docs/runbooks/mobile-release.md) for TestFlight and Play builds.

## Run it on your phone (development)

The app uses native modules (Stripe, camera, secure storage, push), so it runs in a
**development build** of NIXZORA rather than in Expo Go.

1. Start the API as usual (`pnpm dev` at the repository root) and make it reachable from the
   phone: in `apps/api/.env` set `API_PUBLIC_URL=http://<your computer's LAN IP>:4000` so image
   links work on the phone.
2. Point the app at your computer:

   ```bash
   cp apps/mobile/.env.example apps/mobile/.env
   # edit EXPO_PUBLIC_API_URL=http://192.168.x.x:4000
   ```

3. Install a development build once (needs an Expo account; see the runbook, step 1):

   ```bash
   cd apps/mobile
   eas build --profile development --platform ios      # iOS simulator build
   eas build --profile development --platform android  # installable .apk
   ```

   On a Mac with Xcode or with Android Studio you can build locally instead:
   `npx expo run:ios` / `npx expo run:android`.

4. Start the dev server and open the app: `pnpm --filter @nixzora/mobile dev`.

Payments run in test mode with the API's default `PAYMENTS_PROVIDER=fake`: a "Test payment"
dialog replaces the payment sheet. With Stripe test keys on the API you get the real
PaymentSheet (test card 4242 4242 4242 4242, Apple Pay and Google Pay test cards).

Try the scanner on the demo catalog: every demo variant has a fake EAN-13 in the 200 range
(look it up in the Ops Center → Products → a product → variants), or type a SKU such as
`KES14P-32-1T-GR`.

## Commands

| Command                                        | What it does                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @nixzora/mobile dev`            | Expo dev server                                                                                                                                                                                                    |
| `pnpm --filter @nixzora/mobile test`           | Unit and screen tests (Jest, Testing Library)                                                                                                                                                                      |
| `pnpm --filter @nixzora/mobile lint`           | ESLint                                                                                                                                                                                                             |
| `pnpm --filter @nixzora/mobile typecheck`      | TypeScript                                                                                                                                                                                                         |
| `pnpm --filter @nixzora/mobile web`            | Web preview for quick checks (not the real website)                                                                                                                                                                |
| `pnpm --filter @nixzora/mobile update:preview` | Builds the shared packages, then publishes an over-the-air update to preview builds. Always use this rather than a bare `eas update`: the app bundles the packages' built `dist`, so a stale build ships old code. |

## Layout

```
src/
├─ app/          Screens (Expo Router). Paths match the storefront's URLs.
│  ├─ (tabs)/    Shop, Search, Scan, Cart, Account
│  ├─ p/ c/ orders/
│  └─ checkout, sign-in, register, wishlist, delete-account
├─ components/   UI primitives in the NIXZORA brand (ui.tsx), product cards, totals…
└─ lib/          api client, session and tokens, payments, push, offline cache, theme
```
