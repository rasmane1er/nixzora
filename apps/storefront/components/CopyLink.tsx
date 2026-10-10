'use client';

import { useState } from 'react';
import { useT } from './I18nProvider';

/** A read-only link with a "Copy link" button. */
export function CopyLink({ url }: { url: string }) {
  const t = useT('lists');
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-link">
      <input readOnly value={url} aria-label={t('shareTitle')} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => setCopied(true));
        }}
      >
        {copied ? t('copied') : t('copyLink')}
      </button>
    </div>
  );
}
