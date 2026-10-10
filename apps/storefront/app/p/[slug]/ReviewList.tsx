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
import { loadReviews, voteHelpful } from './actions';
import { ReviewPhotoStrip } from './ReviewPhotos';

/**
 * A product's reviews: the first page comes from the server, "Show more" adds 10 at a time, and
 * the sort menu and star buttons reload from the first page. The rating summary next to the
 * list always counts every review.
 */
export function ReviewList({
  slug,
  initial,
  signedIn = false,
  initialVotes = [],
}: {
  slug: string;
  initial: ReviewPage;
  signedIn?: boolean;
  /** Reviews this customer already marked helpful. */
  initialVotes?: string[];
}) {
  const t = useT('productPage');
  const c = useT('community');
  const [withPhotos, setWithPhotos] = useState(false);
  const [votes, setVotes] = useState<Set<string>>(new Set(initialVotes));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const vote = async (review: ReviewView) => {
    const helpful = !votes.has(review.id);
    const result = await voteHelpful(review.id, helpful);
    if (!result.ok) return;
    setVotes((current) => {
      const next = new Set(current);
      if (helpful) next.add(review.id);
      else next.delete(review.id);
      return next;
    });
    setCounts((current) => ({ ...current, [review.id]: result.data.helpfulCount }));
  };
  const f = useFormat();
  const [reviews, setReviews] = useState<ReviewView[]>(initial.reviews);
  const [page, setPage] = useState(initial);
  const [sort, setSort] = useState<ReviewSort>('relevant');
  const [rating, setRating] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const load = (next: {
    page: number;
    sort: ReviewSort;
    rating: number | null;
    withPhotos?: boolean;
  }) =>
    start(async () => {
      const result = await loadReviews(slug, next);
      setFailed(!result);
      if (!result) return;
      setPage(result);
      setReviews((current) => (next.page === 1 ? result.reviews : [...current, ...result.reviews]));
    });

  const choose = (next: { sort?: ReviewSort; rating?: number | null; withPhotos?: boolean }) => {
    const sortNext = next.sort ?? sort;
    const ratingNext = next.rating === undefined ? rating : next.rating;
    const photosNext = next.withPhotos ?? withPhotos;
    setSort(sortNext);
    setRating(ratingNext);
    setWithPhotos(photosNext);
    load({ page: 1, sort: sortNext, rating: ratingNext, withPhotos: photosNext });
  };

  const stars = initial.summary.distribution;
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
            stars[star - 1] ? (
              <button
                key={star}
                type="button"
                className="chip"
                aria-pressed={rating === star}
                onClick={() => choose({ rating: star })}
                disabled={pending}
              >
                {t('starChip', { count: star, total: stars[star - 1] ?? 0 })}
              </button>
            ) : null,
          )}
          <button
            type="button"
            className="chip"
            aria-pressed={withPhotos}
            onClick={() => choose({ withPhotos: !withPhotos })}
            disabled={pending}
          >
            {c('withPhotos')}
          </button>
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
          <ReviewPhotoStrip photos={review.photos ?? []} author={review.author} />
          <div className="review-helpful">
            {(counts[review.id] ?? review.helpfulCount) > 0 ? (
              <span className="muted">
                {c('helpfulCount', { count: counts[review.id] ?? review.helpfulCount })}
              </span>
            ) : null}
            {signedIn ? (
              <button
                type="button"
                className="chip"
                aria-pressed={votes.has(review.id)}
                onClick={() => void vote(review)}
              >
                {votes.has(review.id) ? c('helpfulVoted') : c('helpful')}
              </button>
            ) : (
              <a
                className="muted"
                href={`/account/login?next=${encodeURIComponent(`/p/${slug}#reviews`)}`}
              >
                {c('signInToVote')}
              </a>
            )}
          </div>
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
          onClick={() => load({ page: page.page + 1, sort, rating, withPhotos })}
          disabled={pending}
        >
          {pending ? t('loadingReviews') : t('showMoreReviews')}
        </button>
      ) : null}
    </div>
  );
}
