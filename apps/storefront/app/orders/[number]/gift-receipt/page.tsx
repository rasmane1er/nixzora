import { type OrderView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { PrintButton } from './PrintButton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('gift');
  return { title: t('receiptTitle'), robots: { index: false } };
}

/**
 * A gift receipt (p10-22): what's in the box and the card, without prices, to print or send to
 * the person receiving it. Same access as the order (account, or the email link's token).
 */
export default async function GiftReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: SearchParams;
}) {
  const { number } = await params;
  const token = param(await searchParams, 'token');
  if (!/^NX-[A-Z0-9]{6}$/.test(number)) notFound();
  if (!token && !(await isSignedIn())) notFound();
  let order: OrderView;
  try {
    order = await api<OrderView>(
      `/orders/${number}${token ? `?token=${encodeURIComponent(token)}` : ''}`,
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
  if (!order.gift || order.kind !== 'GOODS') notFound();
  const t = await getT('gift');
  return (
    <div className="wrap section">
      <article className="card gift-receipt">
        <p className="eyebrow">NIXZORA</p>
        <h1>{t('receiptTitle')}</h1>
        <p>
          {order.gift.from ? t('receiptLead', { from: order.gift.from }) : t('receiptLeadAnon')}
        </p>
        {order.gift.message ? (
          <blockquote className="gift-receipt__message">{order.gift.message}</blockquote>
        ) : null}
        <ul className="gift-receipt__items">
          {order.items.map((item) => (
            <li key={item.id}>
              <span>{item.productTitle}</span>
              <span className="muted">
                {item.variantTitle} · {t('qty', { count: item.quantity })}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted">{t('receiptOrder', { number: order.number })}</p>
        <p className="hint">{t('receiptReturns')}</p>
        <PrintButton label={t('print')} />
      </article>
    </div>
  );
}
