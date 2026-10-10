# ADR-0045: Refer a friend

- Status: accepted
- Date: 2026-10-20

## Context

Word of mouth is the cheapest way to find new shoppers. A referral program pays for itself only
if rewards go to real new customers, not to people inviting themselves under a second email.

## Decision

- **Every customer has a code** (`referral_codes`: a few letters of their first name and random
  ones, made on first visit) and a link, `/r/CODE`. The invite page shows the inviter's first
  name only.
- **The friend:** a new account (signed up within 7 days, no paid order yet) claims the code once,
  automatically when they sign up from the link, or by typing it under Refer a friend (this also
  covers Google and Apple sign-up). They get a personal one-time coupon, `FRIEND…`: $10 off a
  first order of $25 or more, valid 60 days. The cart offers it with an Apply button. Using the
  existing coupons keeps one discount path through checkout, totals and refunds.
- **The inviter:** $10 on their NIXZORA balance (the gift card ledger, entry kind `REFERRAL`) when
  the friend's first order of $25 or more (after discounts) ships or is delivered. The balance
  comes off their next order like any gift card balance. They get an email.
- **Limits:** no reward when the friend's order goes to an address the inviter has saved or
  shipped to (same street and ZIP); at most 10 rewards a year; at most 50 invites claimed a year
  per code; one invite per account; never your own code. A small first order doesn't use up the
  invite: a later qualifying one still counts. Rewards are settled from the `order.shipped` and
  `order.delivered` events, once.
- **Clients:** the invite page, a sign-up note, Refer a friend in the account (link, share, what
  you've earned, your invites with their status, the rules, your own welcome gift or a field to
  enter a code), and the cart banner, on the web and in the app. Invite links open the app
  (`/r/*` in the app links).

## Consequences

- Credit is store credit, not cash: it can't be withdrawn and goes with the account.
- Android needs a new app build to open `/r/` links in the app (its link list is in the native
  build); iOS reads the list from the website.
