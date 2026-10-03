import Link from 'next/link';
import { AccountIcon, type AccountIconName } from './AccountIcon';

const WHY: [AccountIconName, string, string][] = [
  [
    'assistant',
    'Get found by the right shoppers',
    'Our assistant matches shoppers to products by their specs, so well-described listings show up for the questions people actually ask.',
  ],
  [
    'payment',
    'Simple seller fees',
    'One 12% commission on the item price. No listing fees, no monthly fee, no card-processing fee.',
  ],
  [
    'orders',
    'Easy order management',
    'See what to ship, print the address, add tracking. Returns are handled with NIXZORA.',
  ],
  [
    'reviews',
    'Sales analytics',
    'Revenue, orders and best sellers by day, plus customer ratings of your store.',
  ],
  [
    'security',
    'Secure payments',
    'Customers pay NIXZORA; Stripe pays you out. Bank details never touch our servers.',
  ],
];

export function WhySell() {
  return (
    <section className="stack" aria-labelledby="why-sell">
      <h2 id="why-sell">Why sell on NIXZORA?</h2>
      <ul className="why-grid">
        {WHY.map(([icon, title, body]) => (
          <li key={title} className="card">
            <span className="why-grid__icon">
              <AccountIcon name={icon} size={26} />
            </span>
            <strong>{title}</strong>
            <span className="muted">{body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FeeSummary() {
  return (
    <section className="card fee-summary" aria-labelledby="fees">
      <div className="stack" style={{ gap: 6 }}>
        <h2 id="fees">Seller fees</h2>
        <p className="fee-headline">
          <strong>12%</strong>
          <span>per completed sale, on the item price</span>
        </p>
        <Link href="/policies/sellers#fees">View the complete fee schedule →</Link>
      </div>
      <table className="fee-calc__table">
        <tbody>
          <tr>
            <td>Customer pays for the item</td>
            <td className="num">$100.00</td>
          </tr>
          <tr>
            <td>NIXZORA commission</td>
            <td className="num">−$12.00</td>
          </tr>
          <tr className="fee-calc__total">
            <td>Your proceeds</td>
            <td className="num">$88.00</td>
          </tr>
          <tr>
            <td colSpan={2} className="hint">
              Plus any shipping the customer pays, in full. Sales tax never reaches you.
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

const FAQ: [string, React.ReactNode][] = [
  [
    'How much does NIXZORA charge?',
    <>
      A 12% marketplace commission on the item price of each completed sale. There is no commission
      on shipping or tax, no listing fee and no monthly fee. See the{' '}
      <Link href="/policies/sellers#fees">fee schedule</Link>.
    </>,
  ],
  [
    'When do I get paid?',
    'Earnings from a sale become available 14 days after you ship it (the hold covers delivery and most returns). Available earnings are paid to your bank through Stripe, at most once a day, from $10.',
  ],
  [
    'What products can I sell?',
    'New computers and electronics: computers, monitors, audio, phones, smart home, gaming, accessories and wearables. Every listing is reviewed by our team before it goes live.',
  ],
  [
    'How do returns work?',
    'Customers can return items within 30 days of delivery, through NIXZORA. The refund goes to their card and the commission on the refunded amount comes back to you.',
  ],
  [
    'What happens if a customer disputes an order?',
    'NIXZORA support looks at the order, your tracking and the customer’s message, and decides under the Seller Agreement. Keep tracking numbers on every shipment.',
  ],
  [
    'How long does seller approval take?',
    'Usually one business day after your Stripe verification is complete. You can prepare listings while you wait.',
  ],
  [
    'What information is required for verification?',
    'Your business details and the owner’s legal name, date of birth and phone number on NIXZORA; your identity, bank account and tax details on Stripe’s secure forms.',
  ],
];

export function SellerFaq() {
  return (
    <section className="card stack" style={{ gap: 4 }} aria-labelledby="seller-faq">
      <h2 id="seller-faq" style={{ marginBottom: 8 }}>
        Seller FAQ
      </h2>
      {FAQ.map(([q, a]) => (
        <details key={q} className="faq">
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </section>
  );
}
