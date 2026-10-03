# ADR-0013: Marketplace orders, commission and the earnings ledger

- Status: accepted
- Date: 2026-10-03
- Roadmap: p7-04 (seller order management), p7-05 (split orders and the commission engine);
  prepares p7-06 (payouts)

## Context

With sellers listing products (ADR-0012), one checkout can contain NIXZORA's own items and items
from several sellers. Each party ships its own parcel, NIXZORA keeps a commission, and sellers
must see what they earn before payouts exist.

## Decision

**One customer order, one payment, several parts.** The shopper still pays once (separate charges
and transfers, ADR-0012). Each order line records its seller at purchase (`order_items.seller_id`,
null for NIXZORA). When the payment succeeds, in the same transaction, every seller in the order
gets a `SellerOrder` with:

| Field             | Rule                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `itemsCents`      | the seller's lines at the prices paid                                      |
| `shippingCents`   | the customer's shipping fee, shared by item value, passed through (no fee) |
| `commissionCents` | `itemsCents × commissionBps`, the store's rate frozen at payment           |
| `netCents`        | `itemsCents + shippingCents − commissionCents`                             |

Coupons are funded by NIXZORA: sellers are paid on the undiscounted price. Sales tax is collected
and remitted by NIXZORA as the marketplace facilitator and never reaches sellers.

**Shipping in parts.** Sellers mark their part shipped with a carrier and tracking number in the
seller portal. Staff ship NIXZORA's own items as before (manual tracking or a bought label); for an
order with only seller items, staff can't ship or buy a label. The order is `FULFILLING` while
parts are outstanding and becomes `SHIPPED`, with one customer email listing every parcel, when
the last part ships. Delivery of the order marks every part delivered.

**An append-only earnings ledger.** A seller's balance is the sum of `seller_ledger_entries`:

- `SALE`: written when the seller ships (idempotent per part), for `netCents`, available after the
  store's `payoutHoldDays` (14 by default; it covers delivery and most returns).
- `REFUND`: written with every customer refund that covers the seller's items: the refunded share
  minus the commission on it, available immediately. With returned lines the refund follows those
  lines; otherwise it is split by each party's share of the items. It never exceeds what the part
  was worth.
- `ADJUSTMENT`: corrections, e.g. reversing earlier refund debits when an unshipped part is
  cancelled.
- `PAYOUT`: written by p7-06.

"Available" is entries already past `availableAt` (it can go negative after refunds; the next
sale or payout nets it). "On hold" is entries still inside the hold. "Waiting to ship" is the net
of paid parts not yet shipped and is not in the ledger.

**Guards.** An order can't be cancelled once any part has shipped (refund instead). Sellers see
the ship-to name and address, never the customer's email or phone. Every action is audited.

## Consequences

- Payouts (p7-06) only need to transfer `available` and write a `PAYOUT` entry; refunds after a
  payout are recovered from later sales.
- Returns are still received and refunded by NIXZORA; seller-managed returns are p7-07.
- Shipping speed is self-reported by sellers (tracking numbers are not yet verified with carrier
  webhooks); the payout hold limits the damage of false tracking.
