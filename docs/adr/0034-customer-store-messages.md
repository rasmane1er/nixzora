# ADR-0034: Messages between customers and stores

- Status: accepted
- Date: 2026-10-11

## Context

Tier 3, first part. Customers need to ask a marketplace store about a product or an order, and
stores need to answer, without either side handing out an email address or taking the sale
elsewhere (where NIXZORA can't help with fraud, refunds or disputes).

## Decision

- **Threads.** A signed-in customer writes to a store from a product page ("Ask the store") or a
  store's part of an order ("Contact the store"). One open thread per customer, store and topic
  (product and/or order); writing again on the same topic continues it. Stores answer from the
  seller portal and can mark threads done; writing again reopens them.
- **Privacy.** Stores see the customer's first name and last initial, never the email; customers
  see the store's name. Email addresses and phone numbers typed into a message are replaced with
  "[removed]" and the message says so. Every thread shows a short safety note: never pay outside
  NIXZORA.
- **Notifications.** The other side gets an email with a link back (customers also a push).
  Unread state is per side.
- **Moderation.** Either side can report a thread with a reason; the Ops Center lists reported
  threads, where support staff hide them (both sides lose them) or dismiss the report. Actions
  are audited.
- **Limits.** 10 new threads and 20 replies a minute per customer; 2,000 characters a message.

## Consequences

- NIXZORA's own products keep using the existing contact form (support requests), not threads.
- Messages are personal data: they go with account deletion (cascade) and are in the customer's
  data export, along with lists, saved cards (brand and last four), gift card activity and
  subscriptions.
