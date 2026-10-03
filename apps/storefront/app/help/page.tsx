import { type MessageKey, rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('help');
  return { title: t('metaTitle'), description: t('metaDescription') };
}

type Key = MessageKey<'help'>;

/** Each FAQ is a question key and an answer key; answers may link with these tags. */
const SECTIONS: { title: Key; faqs: [Key, Key][] }[] = [
  {
    title: 'sectionOrders',
    faqs: [
      ['faqWhereQ', 'faqWhereA'],
      ['faqDeliveryTimeQ', 'faqDeliveryTimeA'],
      ['faqCancelQ', 'faqCancelA'],
      ['faqAbroadQ', 'faqAbroadA'],
    ],
  },
  {
    title: 'sectionReturns',
    faqs: [
      ['faqReturnQ', 'faqReturnA'],
      ['faqRefundQ', 'faqRefundA'],
      ['faqSellersQ', 'faqSellersA'],
    ],
  },
  {
    title: 'sectionPayments',
    faqs: [
      ['faqPaymentQ', 'faqPaymentA'],
      ['faqCouponQ', 'faqCouponA'],
      ['faqTaxQ', 'faqTaxA'],
    ],
  },
  {
    title: 'sectionAccount',
    faqs: [
      ['faqPasswordQ', 'faqPasswordA'],
      ['faqSafeQ', 'faqSafeA'],
      ['faqCloseQ', 'faqCloseA'],
    ],
  },
];

const LINKS: Record<string, string> = {
  orders: '/account/orders?filter=open',
  shipping: '/policies/shipping',
  contactOrder: '/help/contact?topic=ORDER',
  returns: '/account/returns',
  payments: '/account/payments',
  coupons: '/account/coupons',
  forgot: '/account/forgot-password',
  security: '/account/security',
  privacy: '/account/privacy',
};

const TAGS = Object.fromEntries(
  Object.entries(LINKS).map(([tag, href]) => [
    tag,
    (chunk: string) => (
      <Link key={tag} href={href}>
        {chunk}
      </Link>
    ),
  ]),
);

export default async function HelpPage() {
  const t = await getT('help');
  return (
    <div className="wrap section stack" style={{ gap: 24, maxWidth: 900 }}>
      <div className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('heading')}</h1>
        <p className="muted">{t('intro')}</p>
      </div>
      <div className="help-actions">
        <Link className="btn btn--primary" href="/help/contact">
          {t('contactSupport')}
        </Link>
        <Link className="btn btn--secondary" href="/account/orders?filter=open">
          {t('trackPackage')}
        </Link>
        <Link className="btn btn--secondary" href="/help/contact?topic=PROBLEM">
          {t('reportProblem')}
        </Link>
      </div>
      {SECTIONS.map((section) => (
        <section key={section.title} className="card stack" style={{ gap: 4 }}>
          <h2 style={{ marginBottom: 8 }}>{t(section.title)}</h2>
          {section.faqs.map(([q, a]) => (
            <details key={q} className="faq">
              <summary>{t(q)}</summary>
              <p>{rich(t(a), TAGS)}</p>
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
