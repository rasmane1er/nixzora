'use client';

import { useState, useTransition } from 'react';
import { type CopyDraft, suggestCopy } from '../actions';

/**
 * "Suggest description": a draft written from the product's specs (by Claude when enabled, with
 * every number checked against the specs). Staff can drop it into the description and edit it;
 * nothing is saved until they press Save.
 */
export function CopySuggestion({ productId, target }: { productId: string; target: string }) {
  const [draft, setDraft] = useState<CopyDraft | null>(null);
  const [pending, startTransition] = useTransition();

  const use = () => {
    const field = document.getElementById(target) as HTMLTextAreaElement | null;
    if (!field || !draft?.description) return;
    field.value = draft.description;
    field.focus();
    setDraft(null);
  };

  return (
    <div className="copy-suggest">
      <button
        type="button"
        className="btn btn--secondary btn--small"
        disabled={pending}
        onClick={() => startTransition(async () => setDraft(await suggestCopy(productId)))}
      >
        {pending ? 'Drafting…' : 'Suggest description'}
      </button>
      {draft?.error ? (
        <p className="banner banner--error" role="alert">
          {draft.error}
        </p>
      ) : null}
      {draft?.description ? (
        <div className="copy-suggest__draft" role="status">
          <span className="pill">{draft.aiWritten ? 'AI draft' : 'Draft from specs'}</span>
          <p>{draft.description}</p>
          {draft.notes?.map((note) => (
            <p key={note} className="muted small">
              {note}
            </p>
          ))}
          <div className="row">
            <button type="button" className="btn btn--primary btn--small" onClick={use}>
              Use this text
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={() => setDraft(null)}
            >
              Discard
            </button>
          </div>
          <p className="muted small">Check it against the product before saving.</p>
        </div>
      ) : null}
    </div>
  );
}
