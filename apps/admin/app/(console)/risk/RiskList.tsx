import { type MessageKey } from '@nixzora/i18n';
import { type RiskAssessmentView, type RiskSignal } from '@nixzora/validation';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { StatusPill } from '@/components/ui';
import { getFormat, getT } from '@/lib/i18n';
import { reviewRisk } from './actions';

/** Fraud reviews: what was held, the signals behind the score, and the reviewer's buttons. */
export async function RiskList({
  reviews,
  canReview,
  back,
}: {
  reviews: RiskAssessmentView[];
  canReview: boolean;
  back: string;
}) {
  const [t, f] = await Promise.all([getT('opsRisk'), getFormat()]);
  const describe = (signal: RiskSignal) => {
    const vars: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(signal.values ?? {})) {
      if (key.endsWith('Cents') && typeof value === 'number') {
        vars[key.slice(0, -'Cents'.length)] = f.money(value);
      } else vars[key] = value;
    }
    const key = `signal_${signal.code}` as MessageKey<'opsRisk'>;
    const label = t(key, vars);
    return label === key ? signal.code : label;
  };

  return (
    <div className="stack">
      {reviews.map((r) => (
        <article key={r.id} className="card" style={{ marginBottom: 12 }}>
          <div className="page-header" style={{ marginBottom: 8 }}>
            <div>
              {r.order || r.seller ? (
                <strong>{t(`subject_${r.subject}` as MessageKey<'opsRisk'>)} </strong>
              ) : null}
              {r.order ? (
                <Link className="mono" href={`/orders/${r.order.id}`}>
                  {r.order.number}
                </Link>
              ) : r.seller ? (
                <Link href={`/sellers/${r.seller.id}`}>{r.seller.displayName}</Link>
              ) : (
                <span className="muted">{t('declinedCheckout', { email: r.email ?? '—' })}</span>
              )}{' '}
              {r.status ? <StatusPill value={r.status} /> : null}{' '}
              <span className="muted">{f.dateTime(r.createdAt)}</span>
            </div>
            <strong>{t('score', { score: r.score })}</strong>
          </div>
          <p className="muted">
            {r.amountCents !== null ? t('amount', { amount: f.money(r.amountCents) }) : null}
            {r.order ? <> · {r.order.email}</> : null}
            {r.ipAddress ? <> · {t('ip', { ip: r.ipAddress })}</> : null}
            {r.enforced ? null : <> · {t('shadow')}</>}
          </p>
          <h3>{t('why')}</h3>
          <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
            {r.signals.map((signal) => (
              <li key={signal.code}>
                {describe(signal)}{' '}
                <span className="muted mono">
                  {t('points', { points: signal.points > 0 ? `+${signal.points}` : signal.points })}
                </span>
              </li>
            ))}
          </ul>
          {r.reviewedBy && r.reviewedAt ? (
            <p className="muted">
              {t('reviewedBy', { email: r.reviewedBy, date: f.dateTime(r.reviewedAt) })}
              {r.reviewNote ? <> — “{r.reviewNote}”</> : null}
            </p>
          ) : null}
          {canReview && (r.status === 'OPEN' || r.status === 'CONFIRMED') ? (
            <form action={reviewRisk} className="inline-form" style={{ flexWrap: 'wrap', gap: 10 }}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="back" value={back} />
              <input
                name="note"
                maxLength={1000}
                placeholder={t('notePlaceholder')}
                aria-label={t('noteLabel')}
                style={{ width: 240 }}
              />
              <SubmitButton
                name="outcome"
                value="clear"
                tone={r.status === 'OPEN' ? 'primary' : 'secondary'}
              >
                {r.status === 'OPEN' ? t('clear') : t('reopenClear')}
              </SubmitButton>
              {r.status === 'OPEN' ? (
                <SubmitButton tone="danger" name="outcome" value="confirm">
                  {r.subject === 'CHECKOUT'
                    ? t('confirmOrder')
                    : r.subject === 'PAYOUT'
                      ? t('confirmPayout')
                      : t('confirmChargeback')}
                </SubmitButton>
              ) : null}
            </form>
          ) : null}
        </article>
      ))}
    </div>
  );
}
