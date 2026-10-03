import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Seller Agreement and fees',
  description: 'The NIXZORA Seller Agreement, fee schedule and Marketplace Return Policy.',
};

/**
 * Plain-language summary of the marketplace rules sellers accept when they apply (p8-13).
 * The numbers match the commission engine and payouts (ADR-0013, ADR-0014).
 */
export default function SellerPolicyPage() {
  return (
    <LegalPage title="Seller Agreement" updated="October 3, 2026">
      <p>
        This page is a summary of the rules every NIXZORA marketplace seller agrees to when they
        apply. NIXZORA is a demo marketplace: products, brands and prices are fictional.
      </p>

      <h2 id="agreement">Seller Agreement</h2>
      <ul>
        <li>
          List only new products you have in stock, with accurate titles, photos, specs and prices.
          Every listing is reviewed before it goes live and can be removed if it breaks these rules.
        </li>
        <li>
          Ship within the time you set (1 or 2 business days) with a tracking number, from the
          United States, to the regions you chose.
        </li>
        <li>
          Keep your business, owner and payout details current. NIXZORA may suspend a store that
          gives false information, misses shipments repeatedly or receives serious complaints.
        </li>
        <li>
          Customers pay NIXZORA. Sellers never ask customers to pay outside NIXZORA or collect their
          contact details for marketing.
        </li>
      </ul>

      <h2 id="fees">Fee schedule</h2>
      <table className="fee-rules">
        <tbody>
          <tr>
            <th scope="row">Commission</th>
            <td>
              12% of the item price of each completed sale (your store&apos;s rate is shown in Store
              settings).
            </td>
          </tr>
          <tr>
            <th scope="row">Shipping</th>
            <td>No commission. Shipping paid by the customer is passed to you in full.</td>
          </tr>
          <tr>
            <th scope="row">Sales tax</th>
            <td>No commission. NIXZORA collects and remits it as the marketplace facilitator.</td>
          </tr>
          <tr>
            <th scope="row">Coupons</th>
            <td>Funded by NIXZORA. You are paid on the price before the discount.</td>
          </tr>
          <tr>
            <th scope="row">Refunds</th>
            <td>
              The refunded share of the item, minus the commission on it, is deducted from your
              earnings: the commission comes back to you.
            </td>
          </tr>
          <tr>
            <th scope="row">Cancellations</th>
            <td>Orders cancelled before you ship cost you nothing.</td>
          </tr>
          <tr>
            <th scope="row">Card processing</th>
            <td>Included: NIXZORA pays it.</td>
          </tr>
          <tr>
            <th scope="row">Listing or monthly fees</th>
            <td>None.</td>
          </tr>
          <tr>
            <th scope="row">Payouts</th>
            <td>
              Earnings become available 14 days after you ship (longer holds can apply to new
              stores). Available balances from $10 are paid to your bank through Stripe Connect, at
              most once a day.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Example: an item sold for $100 with $8 shipping earns you $100 + $8 − $12 ={' '}
        <strong>$96</strong>.
      </p>

      <h2 id="returns">Marketplace Return &amp; Refund Policy</h2>
      <ul>
        <li>
          Customers can return items within 30 days of delivery under the{' '}
          <Link href="/policies/returns">NIXZORA return policy</Link>, which covers marketplace
          items too.
        </li>
        <li>
          NIXZORA receives return requests, decides them and refunds the customer&apos;s card. You
          see the requests for your items in your seller dashboard.
        </li>
        <li>Accept the returns NIXZORA approves; refunds of your items show in Earnings.</li>
        <li>
          When a customer disputes an order, NIXZORA reviews the order, your tracking and the
          customer&apos;s message and decides under this agreement.
        </li>
      </ul>

      <h2>Questions</h2>
      <p>
        <Link href="/help/contact?topic=OTHER">Contact seller support</Link>.
      </p>
    </LegalPage>
  );
}
