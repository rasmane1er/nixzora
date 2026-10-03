'use client';

import { useActionState } from 'react';
import { useT } from '@/components/I18nProvider';
import { type ReviewState, submitReview } from './actions';

export function ReviewForm({
  slug,
  existing,
}: {
  slug: string;
  existing: { rating: number; title: string; body: string; status: string } | null;
}) {
  const t = useT('productPage');
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});

  if (state.ok) {
    return (
      <p className="banner banner--ok" role="status">
        {t('reviewThanks')}
      </p>
    );
  }

  return (
    <form action={action} className="form card">
      <h3>{existing ? t('editReview') : t('writeReview')}</h3>
      {existing?.status === 'PENDING' ? <p className="hint">{t('reviewPending')}</p> : null}
      {existing?.status === 'REJECTED' ? <p className="hint">{t('reviewRejected')}</p> : null}
      <input type="hidden" name="slug" value={slug} />
      <fieldset className="star-input">
        <legend className="hint" style={{ marginBottom: 6 }}>
          {t('rating')}
        </legend>
        {[5, 4, 3, 2, 1].map((n) => (
          <label key={n}>
            <input
              type="radio"
              name="rating"
              value={n}
              defaultChecked={(existing?.rating ?? 5) === n}
              required
            />{' '}
            {n}★
          </label>
        ))}
      </fieldset>
      <label>
        {t('headline')}
        <input name="title" required minLength={3} maxLength={120} defaultValue={existing?.title} />
      </label>
      <label>
        {t('yourReview')} <span className="hint">{t('reviewHint')}</span>
        <textarea
          name="body"
          required
          minLength={20}
          maxLength={5000}
          rows={4}
          defaultValue={existing?.body}
        />
      </label>
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {pending ? t('sending') : t('submitReview')}
        </button>
      </div>
    </form>
  );
}
