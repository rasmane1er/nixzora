'use client';

import { useActionState } from 'react';
import { type ReviewState, submitReview } from './actions';

export function ReviewForm({
  slug,
  existing,
}: {
  slug: string;
  existing: { rating: number; title: string; body: string; status: string } | null;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});

  if (state.ok) {
    return (
      <p className="banner banner--ok" role="status">
        Thanks! Your review will appear once our team has checked it (usually within a day).
      </p>
    );
  }

  return (
    <form action={action} className="form card">
      <h3>{existing ? 'Edit your review' : 'Write a review'}</h3>
      {existing?.status === 'PENDING' ? (
        <p className="hint">Your review is waiting for moderation.</p>
      ) : null}
      {existing?.status === 'REJECTED' ? (
        <p className="hint">Your last review wasn’t published. Please keep it about the product.</p>
      ) : null}
      <input type="hidden" name="slug" value={slug} />
      <fieldset className="star-input">
        <legend className="hint" style={{ marginBottom: 6 }}>
          Rating
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
        Headline
        <input name="title" required minLength={3} maxLength={120} defaultValue={existing?.title} />
      </label>
      <label>
        Your review <span className="hint">What did you use it for? What stood out?</span>
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
          {pending ? 'Sending…' : 'Submit review'}
        </button>
      </div>
    </form>
  );
}
