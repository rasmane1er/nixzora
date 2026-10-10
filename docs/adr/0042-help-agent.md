# ADR-0042: The help agent

- Status: accepted
- Date: 2026-10-17

## Context

Tier 4, last part. Most support questions are about an order: where is it, can I cancel it, how
do I send it back, where is my refund. The shop already has the facts (orders, shipments and
carrier scans, returns, refunds) and the actions (cancel within 30 minutes, the return form, a
support request staff answer from the Ops Center). Shoppers want an answer at once, in a chat,
and a person when the chat can't help.

## Decision

- **A chat about the shopper's own orders** (`/me/help`, signed in only; guests get the contact
  form). One open conversation per shopper (`help_conversations`, `help_messages`); "Start over"
  closes it.
- **The model only reads; the API writes every reply.** Each message is classified into one of
  eight intents (track, cancel, return, refund, orders, a person, greeting, other) plus which of
  the shopper's recent orders it is about. With `AI_DRIVER=anthropic` that is one short forced
  tool call (`classifyHelp`, through the AI service like the other model calls, inside the daily
  AI budget, falling back to the rules on any error); otherwise free keyword rules in English,
  French and Spanish. An order number the model returns that isn't one of the shopper's is
  dropped. Replies are templates (en/fr/es) filled from the order, its shipments, scans and
  returns, so the chat cannot invent a date, an amount or a policy.
- **Actions need a button.** Cancelling uses the same rule as the order page (paid, within 30
  minutes, nothing packed) and asks "Are you sure?" first; returns open the order's return form;
  tracking opens the carrier. Words alone never cancel and never open a ticket.
- **Hand-off to staff.** "Talk to a person" offers "Send to our team", which creates a support
  request (topic from the conversation, the order it was about, the transcript as the message).
  Staff answer it in the Ops Center as today; the reply is emailed and shows under Support
  requests. A conversation is handed off once.
- **Context.** A follow-up without an order number ("cancel it") is about the order the
  conversation is on, when that order fits the question; a written order number from an older
  order is looked up; someone else's number gets "I couldn't find that order".
- **Clients:** "Chat with the help assistant" on the Help page (web and app), Help chat in the
  account (web hub, app account tab), and "Get help with this order" on order pages. Suggested
  questions start the chat; replies show order cards and buttons.

## Consequences

- The chat answers order questions only; anything else gets a clear "I can't help with that
  here" and the hand-off, rather than a guess.
- Help chats are part of the data export and are deleted with the account.
- Adding a model later (better routing, free-text answers) changes `classifyHelp` only; the
  answers stay grounded because they are built from the data.
