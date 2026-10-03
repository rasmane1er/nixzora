'use client';

import { useState, useTransition } from 'react';
import { useT } from '@/components/I18nProvider';
import { type CopyDraft, suggestCopy } from '../actions';

/**
 * "Suggest description": a draft written from the product's specs (by Claude when enabled, with
 * every number checked against the specs). Staff can drop it into the description and edit it;
 * nothing is saved until they press Save.
 */
export function CopySuggestion({ productId, target }: { productId: string; target: string }) {
  const [draft, setDraft] = useState<CopyDraft | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useT('opsCatalog');

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
        {pending ? t('drafting') : t('suggestDescription')}
      </button>
      {draft?.error ? (
        <p className="banner banner--error" role="alert">
          {draft.error}
        </p>
      ) : null}
      {draft?.description ? (
        <div className="copy-suggest__draft" role="status">
          <span className="pill">{draft.aiWritten ? t('aiDraft') : t('draftFromSpecs')}</span>
          <p>{draft.description}</p>
          {draft.notes?.map((note) => (
            <p key={note} className="muted small">
              {note}
            </p>
          ))}
          <div className="row">
            <button type="button" className="btn btn--primary btn--small" onClick={use}>
              {t('useThisText')}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={() => setDraft(null)}
            >
              {t('discard')}
            </button>
          </div>
          <p className="muted small">{t('checkBeforeSaving')}</p>
        </div>
      ) : null}
    </div>
  );
}
