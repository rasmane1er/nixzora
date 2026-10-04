# Notes for App Review and Play review (p9-12)

Paste into App Store Connect → App Review Information → Notes, and Play Console → App content →
App access. Fill the demo account in the store forms only; never commit its password.

---

NIXZORA is a marketplace for physical goods shipped in the United States. Purchases are of
physical products, so they use Apple Pay / Google Pay and cards through Stripe, not in-app
purchase (App Store Review Guideline 3.1.3(e)).

Demo account (a customer with past orders): entered in the sign-in fields of this form.

What to try:

1. **Assistant** tab: ask "a quiet desk fan under $40". Answers show only products from the
   catalog, with prices.
2. **Scan** tab: allow the camera and point it at any product barcode.
3. Add an item to the cart and open **Checkout**. Use Stripe's test card 4242 4242 4242 4242
   only if the reviewer build points at staging; the production build takes real payments, so
   stop at the payment sheet.
4. **Account → Orders**: open a past order to see tracking and the return button.
5. **Account → Security → Delete account** removes the account (guideline 5.1.1(v)).

Sign in with Apple is offered next to Google sign-in (guideline 4.8). The app has no ads and no
tracking, so it does not show the App Tracking Transparency prompt.
