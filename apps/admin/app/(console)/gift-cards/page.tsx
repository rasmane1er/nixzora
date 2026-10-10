import { type AdminGiftCardView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('gifts');
  return { title: t('opsTitle') };
}

/** Gift cards (p10-10): find one by order, email or the code's last four. */
export default async function GiftCardsPage({ searchParams }: { searchParams: SearchParams }) {
  const q = param(await searchParams, 'q');
  const [cards, t, people, f] = await Promise.all([
    load<AdminGiftCardView[]>(`/admin/gift-cards${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    getT('gifts'),
    getT('opsPeople'),
    getFormat(),
  ]);
  return (
    <>
      <PageHeader eyebrow={people('marketing')} title={t('opsTitle')} />
      <p className="muted" style={{ maxWidth: '75ch' }}>
        {t('opsLead')}
      </p>
      <form className="inline-form" action="/gift-cards">
        <input name="q" defaultValue={q} aria-label={t('search')} />
        <SubmitButton tone="secondary">{t('search')}</SubmitButton>
      </form>
      <section className="card">
        {cards.length === 0 ? (
          <Empty>{t('none')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colOrder')}</th>
                  <th>{t('colAmount')}</th>
                  <th>{t('colRecipient')}</th>
                  <th>{t('colBuyer')}</th>
                  <th>{t('colCode')}</th>
                  <th>{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id}>
                    <td>
                      <Link href={`/orders?q=${card.orderNumber}`}>{card.orderNumber}</Link>
                      <div className="muted">{f.dateTime(card.createdAt)}</div>
                    </td>
                    <td>{f.money(card.amountCents)}</td>
                    <td>
                      {card.recipientName}
                      <div className="muted">{card.recipientEmail}</div>
                    </td>
                    <td>
                      {card.senderName}
                      <div className="muted">{card.purchaserEmail}</div>
                    </td>
                    <td className="mono">{card.last4 ?? '—'}</td>
                    <td>
                      {t(`status_${card.status}`)}
                      {card.redeemedAt ? (
                        <div className="muted">{f.dateTime(card.redeemedAt)}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
