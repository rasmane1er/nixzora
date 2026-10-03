'use client';

import { type ProductCopySuggestion } from '@nixzora/validation';
import { useState, useTransition } from 'react';
import { suggestListingCopy } from '../../actions';

/**
 * AI listing assistant (p7-09): drafts a description from the listing's specs. Every number in
 * an AI draft is checked against the specs; otherwise a plain draft from the specs is offered.
 * Nothing is saved until the seller presses "Save details".
 */
export function DescriptionAssistant({ productId, target }: { productId: string; target: string }) {
  const [draft, setDraft] = useState<ProductCopySuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ask = () =>
    startTransition(async () => {
      setError(null);
      const result = await suggestListingCopy(productId);
      if (result.ok) setDraft(result.data);
      else setError(result.error);
    });

  const use = () => {
    const field = document.getElementById(target) as HTMLTextAreaElement | null;
    if (!field || !draft) return;
    field.value = draft.description;
    field.focus();
    setDraft(null);
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          disabled={pending}
          onClick={ask}
        >
          {pending ? 'Drafting…' : 'Suggest a description'}
        </button>{' '}
        <span className="hint">Written from the specs below. Save the specs first.</span>
      </div>
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}
      {draft ? (
        <div className="card stack" role="status" style={{ gap: 8, padding: 16 }}>
          <span className="pill">{draft.aiWritten ? 'AI draft' : 'Draft from your specs'}</span>
          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{draft.description}</p>
          {draft.notes.map((note) => (
            <p key={note} className="muted" style={{ margin: 0, fontSize: 13 }}>
              {note}
            </p>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn--primary btn--sm" onClick={use}>
              Use this text
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setDraft(null)}
            >
              Discard
            </button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Check it matches your product, then press Save details.
          </p>
        </div>
      ) : null}
    </div>
  );
}
