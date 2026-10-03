import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'About NIXZORA',
  description: 'Computers and electronics, explained: who we are and how NIXZORA works.',
};

export default function AboutPage() {
  return (
    <LegalPage title="About NIXZORA" updated="October 3, 2026">
      <p>
        NIXZORA sells computers and electronics with clear specs and honest advice. Tell our
        shopping assistant what you need in your own words, and it finds products that fit, explains
        why, and builds the cart.
      </p>
      <h2>A marketplace you can trust</h2>
      <p>
        Next to our own products, independent stores sell on NIXZORA. Every store is verified before
        it opens, every listing is reviewed before it goes live, and every order, whoever ships it,
        has the same checkout, the same <Link href="/policies/returns">30-day returns</Link> and the
        same support.
      </p>
      <h2>How we treat your data</h2>
      <p>
        Card details never reach our servers, and you can download or delete your data at any time
        from your account. Read the <Link href="/privacy">privacy policy</Link>.
      </p>
      <h2>Sell with us</h2>
      <p>
        Run a store? <Link href="/sell">Open a NIXZORA store</Link>.
      </p>
      <p className="muted">Demo store: products, brands and prices are fictional.</p>
    </LegalPage>
  );
}
