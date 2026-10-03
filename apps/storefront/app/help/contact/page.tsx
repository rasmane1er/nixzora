import { SUPPORT_TOPICS } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact support',
  description: 'Write to NIXZORA customer support. We answer within one business day.',
};

export default async function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const asked = param(params, 'topic');
  const topic = (SUPPORT_TOPICS as readonly string[]).includes(asked ?? '') ? asked! : 'ORDER';
  const order = param(params, 'order');
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 760 }}>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumb">
          <li>
            <Link href="/help">Help center</Link>
          </li>
          <li aria-current="page">
            {topic === 'PROBLEM' ? 'Report a problem' : 'Contact support'}
          </li>
        </ol>
      </nav>
      <h1>{topic === 'PROBLEM' ? 'Report a problem' : 'Contact support'}</h1>
      <p className="muted" style={{ margin: 0 }}>
        We answer by email within one business day. For a quick answer, try the{' '}
        <Link href="/help">help center</Link>.
      </p>
      <ContactForm
        signedIn={await isSignedIn()}
        topic={topic}
        orderNumber={order && /^NX-[A-Z0-9]{6}$/i.test(order) ? order.toUpperCase() : undefined}
        pageUrl={param(params, 'page')}
      />
    </div>
  );
}
