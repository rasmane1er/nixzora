'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setClipped } from '@/app/coupons/actions';
import { useT } from './I18nProvider';

/**
 * Clip coupons (p10-18): "Clip coupon" turns into "Coupon clipped ✓" (tap again to remove). A
 * signed-out shopper is sent to sign in and comes back here.
 */
export function ClipButton({
  couponId,
  label,
  initial,
  compact = false,
}: {
  couponId: string;
  /** "Save 15% with coupon" */
  label: string;
  initial: boolean;
  compact?: boolean;
}) {
  const t = useT('clips');
  const router = useRouter();
  const path = usePathname();
  const [clipped, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className={`clip${clipped ? ' clip--on' : ''}${compact ? ' clip--compact' : ''}`}>
      <button
        type="button"
        className="clip__button"
        aria-pressed={clipped}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await setClipped(couponId, !clipped);
            if (result.ok) {
              setState(!clipped);
              router.refresh();
            } else if (result.signIn) {
              router.push(`/account/login?next=${encodeURIComponent(path)}`);
            } else setError(result.error);
          })
        }
      >
        <span className="clip__box" aria-hidden="true">
          {clipped ? '✓' : ''}
        </span>
        <span>
          <span className="clip__label">{label}</span>
          <span className="clip__action">
            {pending ? t('clipping') : clipped ? t('clipped') : t('clip')}
          </span>
        </span>
      </button>
      {clipped && !compact ? <span className="hint">{t('clippedNote')}</span> : null}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
