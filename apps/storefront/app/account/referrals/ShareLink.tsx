'use client';

import { useState } from 'react';
import { useT } from '@/components/I18nProvider';

/** Copy the invite link, or share it with the device's share sheet where there is one. */
export function ShareLink({ link, text }: { link: string; text: string }) {
  const t = useT('referrals');
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  return (
    <div className="share-link">
      <input readOnly value={link} aria-label={t('yourLink')} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="btn btn--primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked: the field is selectable.
          }
        }}
      >
        {copied ? t('copied') : t('copy')}
      </button>
      {canShare ? (
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void navigator.share({ text, url: link }).catch(() => undefined)}
        >
          {t('share')}
        </button>
      ) : null}
    </div>
  );
}
