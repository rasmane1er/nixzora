import { type OrderView } from '@nixzora/validation';
import { getFormat, getT } from '@/lib/i18n';

/** Where the gift cards of a gift card order go, and whether they went (p10-10). */
export async function GiftCardLines({ order }: { order: Pick<OrderView, 'giftCards'> }) {
  const [t, f] = await Promise.all([getT('gifts'), getFormat()]);
  return (
    <ul className="gift-lines">
      {(order.giftCards ?? []).map((card) => (
        <li key={card.id}>
          <strong>{f.money(card.amountCents)}</strong>{' '}
          {card.status === 'PENDING'
            ? t('pendingSend', { name: card.recipientName, email: card.recipientEmail })
            : card.status === 'VOID'
              ? t('voided', { name: card.recipientName })
              : t('sentTo', { name: card.recipientName, email: card.recipientEmail })}
          {card.status === 'REDEEMED' ? <span className="pill">{t('redeemedBy')}</span> : null}
        </li>
      ))}
    </ul>
  );
}
