'use client';

import { type FollowStatus } from '@nixzora/validation';
import { useState, useTransition } from 'react';
import { useT } from '@/components/I18nProvider';
import { setDealAlerts, setFollowing } from './actions';

/**
 * Follow a store (p10-24): the button, the follower count, and deal alerts once following.
 * Signed-out visitors get a sign-in link that comes back to the store.
 */
export function FollowButton({
  handle,
  store,
  initial,
  signedIn,
  showAlerts = true,
  hideCount = false,
}: {
  /** The Following page lists your stores without their follower counts. */
  hideCount?: boolean;
  handle: string;
  store: string;
  initial: FollowStatus;
  signedIn: boolean;
  showAlerts?: boolean;
}) {
  const t = useT('follows');
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!signedIn) {
    return (
      <div className="follow">
        <a
          className="btn btn--secondary btn--sm"
          href={`/account/login?next=${encodeURIComponent(`/s/${handle}`)}`}
          title={t('signInToFollow')}
        >
          {t('follow')}
        </a>
        <span className="muted">{t('followers', { count: status.followers })}</span>
      </div>
    );
  }
  const run = (call: () => ReturnType<typeof setFollowing>) =>
    start(async () => {
      const result = await call();
      if (result.ok) {
        setStatus(result.status);
        setError(null);
      } else setError(result.error);
    });
  return (
    <div className="follow">
      <button
        type="button"
        className={`btn btn--sm ${status.following ? 'btn--secondary' : 'btn--primary'}`}
        aria-pressed={status.following}
        aria-label={status.following ? t('unfollowStore', { store }) : t('followStore', { store })}
        disabled={pending}
        onClick={() => run(() => setFollowing(handle, !status.following))}
      >
        {status.following ? `✓ ${t('following')}` : t('follow')}
      </button>
      {hideCount ? null : (
        <span className="muted">{t('followers', { count: status.followers })}</span>
      )}
      {status.following && showAlerts ? (
        <label className="check follow__alerts" title={t('dealAlertsHint')}>
          <input
            type="checkbox"
            checked={status.notify}
            disabled={pending}
            onChange={(event) => {
              const notify = event.target.checked;
              run(() => setDealAlerts(handle, notify));
            }}
          />{' '}
          {t('dealAlerts')}
        </label>
      ) : null}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
