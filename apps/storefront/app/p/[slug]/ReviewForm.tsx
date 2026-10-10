'use client';

import { useActionState } from 'react';
import { useT } from '@/components/I18nProvider';
import { type ReviewState, submitReview } from './actions';
import { ReviewPhotoPicker } from './ReviewPhotos';

export function ReviewForm({
  slug,
  existing,
  sized = false,
}: {
  slug: string;
  existing: {
    rating: number;
    title: string;
    body: string;
    status: string;
    fit?: 'SMALL' | 'TRUE' | 'LARGE' | null;
  } | null;
  /** Clothing and shoes ask how it fit (p10-26). */
  sized?: boolean;
}) {
  const t = useT('productPage');
  const sg = useT('sizeGuide');
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
      {sized ? (
        <fieldset className="fit-input">
          <legend className="hint" style={{ marginBottom: 6 }}>
            {sg('fitQuestion')}
          </legend>
          <input type="hidden" name="fitAsked" value="1" />
          {(['SMALL', 'TRUE', 'LARGE'] as const).map((fit) => (
            <label key={fit} className="check">
              <input type="radio" name="fit" value={fit} defaultChecked={existing?.fit === fit} />{' '}
              {sg(`fit_${fit}`)}
            </label>
          ))}
          <label className="check">
            <input type="radio" name="fit" value="" defaultChecked={!existing?.fit} />{' '}
            {sg('fitSkip')}
          </label>
        </fieldset>
      ) : null}
      <ReviewPhotoPicker />
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
