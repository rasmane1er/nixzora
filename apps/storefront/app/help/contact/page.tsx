import { rich } from '@nixzora/i18n';
import { SUPPORT_TOPICS } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { ContactForm } from './ContactForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('help');
  return { title: t('contactSupport'), description: t('contactMetaDescription') };
}

export default async function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const t = await getT('help');
  const asked = param(params, 'topic');
  const topic = (SUPPORT_TOPICS as readonly string[]).includes(asked ?? '') ? asked! : 'ORDER';
  const order = param(params, 'order');
  const title = topic === 'PROBLEM' ? t('reportProblem') : t('contactSupport');
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 760 }}>
      <nav aria-label={t('breadcrumb')}>
        <ol className="breadcrumb">
          <li>
            <Link href="/help">{t('metaTitle')}</Link>
          </li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      <h1>{title}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {rich(t('contactIntro'), {
          help: (c) => (
            <Link key="help" href="/help">
              {c}
            </Link>
          ),
        })}
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
