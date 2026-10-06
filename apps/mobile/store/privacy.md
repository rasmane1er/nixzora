# App Store privacy answers (p9-12)

The answers for Apple's **App Privacy** form and Google Play's **Data safety** form, taken from
what the app and API actually store (`apps/api/prisma/schema.prisma`) and send. Update this file
in the same pull request as any change that collects something new.

Ground rules that hold for every row:

- **No tracking.** No advertising or analytics SDKs, no data shared with data brokers, no linking with other companies' data for ads. Apple: "Data Used to Track You" is
  empty and the app does not show the App Tracking Transparency prompt.
- **Encrypted in transit** (HTTPS/TLS only; `ITSAppUsesNonExemptEncryption: false`).
- **Deletion:** Account → Delete account in the app, and `https://nixzora.com/account` on the web.
  Orders and invoices are kept as long as tax law requires, with the name and email removed.
- **Data export:** Account → Security → Download your data (app), Account → Download my data (web).

## Apple: App Privacy

| Data type (Apple's name)          | What it is in NIXZORA                                           | Linked to user | Purposes                            |
| --------------------------------- | --------------------------------------------------------------- | -------------- | ----------------------------------- |
| Contact Info → Name               | First and last name; shipping recipient                         | Yes            | App Functionality                   |
| Contact Info → Email Address      | Account email, receipts                                         | Yes            | App Functionality, Customer Support |
| Contact Info → Phone Number       | Optional at sign-up; for delivery problems                      | Yes            | App Functionality, Customer Support |
| Contact Info → Physical Address   | Shipping and billing addresses                                  | Yes            | App Functionality                   |
| Financial Info → Payment Info     | Card or wallet details, collected by the Stripe SDK (not by us) | Yes            | App Functionality                   |
| Purchases → Purchase History      | Orders, returns, refunds                                        | Yes            | App Functionality, Customer Support |
| User Content → Photos or Videos   | Optional profile photo                                          | Yes            | App Functionality                   |
| User Content → Customer Support   | Messages sent through Help                                      | Yes            | Customer Support                    |
| User Content → Other User Content | Product reviews; questions typed to the assistant (see note)    | Yes            | App Functionality                   |
| Identifiers → User ID             | Account id; push notification token for order updates           | Yes            | App Functionality                   |
| Diagnostics → Crash Data          | Crash reports and error stack traces (Sentry)                   | Yes            | App Functionality                   |
| Diagnostics → Performance Data    | App start and screen load times, a 10% sample (Sentry)          | Yes            | App Functionality                   |

**Not collected:** browsing history (the app sends no product-view events), precise or coarse location, contacts, health, fitness, sensitive info,
emails or texts, audio, gameplay, search history (search terms are not stored), product
interaction for analytics, advertising data, other diagnostics.

Notes:

- **Assistant questions** are sent to the AI provider to answer them and are not stored in our
  database (only token counts and timing are logged). The provider may keep them for a short
  time for abuse monitoring, so they are declared rather than left out.
- **Barcode scans** are read on the device; only the number is sent to search, not the image.
- **IP address and device name** are kept with each sign-in session and with checkout fraud
  checks. They are used for security and fraud prevention, never to work out a location.
  Apple has no separate category for this; it is covered by "App Functionality".
- **Crash reports** go to Sentry (our error-monitoring provider): the stack trace, device model,
  OS and app version, and the account id (never the name or email). No screenshots, screen
  recordings, IP addresses or request bodies are sent. Linked to the user only through the
  account id, so support can match a crash to a ticket.
- **Face ID / fingerprint** never leave the device (the OS checks them and unlocks a key in the
  secure store).

## Google Play: Data safety

- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data is deleted? **Yes**
  (in the app, and the web page `https://nixzora.com/account`)
- Shared with third parties: **No.** Stripe (payments), the AI provider (assistant answers), Sentry
  (crash reports) and AWS (hosting, email) act on our behalf as service providers, which Google does not count as
  sharing.

| Category → Type                             | Collected | Optional?         | Purposes                                              |
| ------------------------------------------- | --------- | ----------------- | ----------------------------------------------------- |
| Personal info → Name                        | Yes       | Required          | App functionality, Account management                 |
| Personal info → Email address               | Yes       | Required          | App functionality, Account management, Communications |
| Personal info → Phone number                | Yes       | Optional          | App functionality, Communications                     |
| Personal info → Address                     | Yes       | Required to buy   | App functionality                                     |
| Financial info → User payment info          | Yes       | Required to buy   | App functionality (processed by Stripe)               |
| Financial info → Purchase history           | Yes       | Required to buy   | App functionality, Account management                 |
| Photos and videos → Photos                  | Yes       | Optional          | App functionality (profile photo)                     |
| Messages → Other in-app messages            | Yes       | Optional          | App functionality, Customer support                   |
| App activity → Other user-generated content | Yes       | Optional          | App functionality (reviews, assistant)                |
| Device or other IDs                         | Yes       | Required for push | App functionality (push token)                        |
| App info and performance → Crash logs       | Yes       | Required          | App functionality (fixing crashes)                    |
| App info and performance → Diagnostics      | Yes       | Required          | App functionality (app start and screen load times)   |

Not collected: app interactions, location, web browsing, contacts, calendar, audio, files and docs, health and
fitness.

## Permissions the app asks for

| Permission    | When                                              | Text shown (iOS)                                   |
| ------------- | ------------------------------------------------- | -------------------------------------------------- |
| Camera        | First barcode scan or profile photo               | "Scan a product barcode to find it in NIXZORA."    |
| Photo library | Choosing a profile photo                          | "Choose a profile photo for your NIXZORA account." |
| Notifications | Turning on order updates (order page or Settings) | System prompt                                      |
| Face ID       | Turning on quick unlock in Settings               | "Use Face ID to unlock your NIXZORA account."      |

Android blocks the microphone and shared-storage permissions in `app.config.ts`.
