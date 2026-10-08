'use client';

import {
  REVIEW_SORTS,
  type ReviewPage,
  type ReviewSort,
  type ReviewView,
} from '@nixzora/validation';
import { useState, useTransition } from 'react';
import { useFormat, useT } from '@/components/I18nProvider';
import { Stars } from '@/components/Stars';
import { loadReviews } from './actions';

/**
 * A product's reviews: the first page comes from the server, "Show more" adds 10 at a time, and
 * the sort menu and star buttons reload from the first page. The rating summary next to the
 * list always counts every review.
 */
export function ReviewList({ slug, initial }: { slug: string; initial: ReviewPage }) {
  const t = useT('productPage');
  const f = useFormat();
  const [reviews, setReviews] = useState<ReviewView[]>(initial.reviews);
  const [page, setPage] = useState(initial);
  const [sort, setSort] = useState<ReviewSort>('relevant');
  const [rating, setRating] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const load = (next: { page: number; sort: ReviewSort; rating: number | null }) =>
    start(async () => {
      const result = await loadReviews(slug, next);
      setFailed(!result);
      if (!result) return;
      setPage(result);
      setReviews((current) => (next.page === 1 ? result.reviews : [...current, ...result.reviews]));
    });

  const choose = (next: { sort?: ReviewSort; rating?: number | null }) => {
    const sortNext = next.sort ?? sort;
    const ratingNext = next.rating === undefined ? rating : next.rating;
    setSort(sortNext);
    setRating(ratingNext);
    load({ page: 1, sort: sortNext, rating: ratingNext });
  };

  const counts = initial.summary.distribution;
  return (
    <div className="stack" style={{ gap: 12 }} aria-busy={pending}>
      <div className="review-tools">
        <label className="review-tools__sort">
          <span className="hint">{t('sortReviews')}</span>
          <select
            value={sort}
            onChange={(e) => choose({ sort: e.target.value as ReviewSort })}
            disabled={pending}
          >
            {REVIEW_SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`reviewSort_${value}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="chips" role="group" aria-label={t('filterByStars')}>
          <button
            type="button"
            className="chip"
            aria-pressed={rating === null}
            onClick={() => choose({ rating: null })}
            disabled={pending}
          >
            {t('allStars')}
          </button>
          {[5, 4, 3, 2, 1].map((star) =>
            counts[star - 1] ? (
              <button
                key={star}
                type="button"
                className="chip"
                aria-pressed={rating === star}
                onClick={() => choose({ rating: star })}
                disabled={pending}
              >
                {t('starChip', { count: star, total: counts[star - 1] ?? 0 })}
              </button>
            ) : null,
          )}
        </div>
      </div>

      <p className="hint" aria-live="polite" style={{ margin: 0 }}>
        {t('showingReviews', { shown: reviews.length, total: page.total })}
      </p>

      {reviews.map((review) => (
        <article key={review.id} className="review">
          <div className="rating-line">
            <Stars value={review.rating} />
            <strong>{review.title}</strong>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            {review.author} · {f.date(review.createdAt)}
          </span>
          {review.verifiedPurchase ? <span className="badge">{t('verifiedPurchase')}</span> : null}
          <p className="description">{review.body}</p>
        </article>
      ))}

      {failed ? (
        <p className="banner banner--error" role="alert">
          {t('reviewsLoadFailed')}
        </p>
      ) : null}
      {page.page < page.totalPages ? (
        <button
          type="button"
          className="btn btn--secondary"
          style={{ justifySelf: 'start' }}
          onClick={() => load({ page: page.page + 1, sort, rating })}
          disabled={pending}
        >
          {pending ? t('loadingReviews') : t('showMoreReviews')}
        </button>
      ) : null}
    </div>
  );
}
