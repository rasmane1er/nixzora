'use client';

import { type OrderView } from '@nixzora/validation';
import { rich } from '@nixzora/i18n';
import { useActionState } from 'react';
import { useT } from '@/components/I18nProvider';
import { Stars } from '@/components/Stars';
import { rateSeller, type RatingState } from './actions';

type Shipment = OrderView['shipments'][number];

/** Rate a delivered seller parcel 1–5. The comment goes to the seller and NIXZORA only. */
export function RateSellerForm({
  number,
  token,
  shipment,
}: {
  number: string;
  token?: string;
  shipment: Shipment;
}) {
  const t = useT('order');
  const tCommon = useT('common');
  const [state, action, pending] = useActionState<RatingState, FormData>(rateSeller, {});
  const seller = shipment.seller!;
  const current = shipment.rating;
  if (state.ok && current) {
    return (
      <p className="rating-line" role="status">
        <Stars value={current.value} size={14} /> {t('ratingThanks', { name: seller.displayName })}
      </p>
    );
  }
  return (
    <details className="seller-rating">
      <summary>
        {current
          ? rich(t('yourRatingChange'), {
              stars: () => <Stars key="stars" value={current.value} size={14} />,
            })
          : t('rateSeller', { name: seller.displayName })}
      </summary>
      <form action={action} className="form" style={{ marginTop: 10, gap: 10 }}>
        <input type="hidden" name="number" value={number} />
        <input type="hidden" name="token" value={token ?? ''} />
        <input type="hidden" name="seller" value={seller.handle} />
        {state.error ? (
          <p className="banner banner--error" role="alert">
            {state.error}
          </p>
        ) : null}
        <fieldset className="star-input">
          <legend className="hint" style={{ marginBottom: 6 }}>
            {t('ratingLegend')}
          </legend>
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n}>
              <input
                type="radio"
                name="rating"
                value={n}
                defaultChecked={current?.value === n}
                required
              />{' '}
              {n}★
            </label>
          ))}
        </fieldset>
        <label>
          {t('commentForSeller')} <span className="hint">{t('commentHint')}</span>
          <textarea
            name="comment"
            rows={2}
            maxLength={1000}
            defaultValue={current?.comment ?? ''}
          />
        </label>
        <div>
          <button type="submit" className="btn btn--secondary btn--sm" disabled={pending}>
            {pending ? tCommon('saving') : current ? t('updateRating') : t('sendRating')}
          </button>
        </div>
      </form>
    </details>
  );
}
