import { type ReferralView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { claimReferral } from './actions';
import { ShareLink } from './ShareLink';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('referrals');
  return { title: t('metaTitle'), robots: { index: false } };
}

/** Refer a friend (p10-23): your link, what you've earned, your invites, your welcome gift. */
export default async function ReferralsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [view, t, f] = await Promise.all([
    accountApi<ReferralView>('/me/referral', '/account/referrals'),
    getT('referrals'),
    getFormat(),
  ]);
  const friend = f.money(view.friendCents);
  const reward = f.money(view.rewardCents);
  const min = f.money(view.minOrderCents);
  const claim = param(params, 'claim');
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 860 }}>
      <AccountHeader
        title={t('title', { friend, reward })}
        description={t('lead', { friend, reward, min })}
      />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      {view.welcome ? (
        <section className="card welcome-gift">
          <h2>{t('welcomeTitle')}</h2>
          <p style={{ margin: 0 }}>
            {view.welcome.used
              ? t('welcomeUsed')
              : t('welcomeBody', {
                  code: view.welcome.code,
                  amount: f.money(view.welcome.amountCents),
                  min,
                  date: f.date(view.welcome.endsAt),
                })}
          </p>
        </section>
      ) : view.canClaim ? (
        <section className="card">
          <h2>{t('claimTitle')}</h2>
          <form action={claimReferral} className="coupon">
            <input
              name="code"
              aria-label={t('claimLabel')}
              placeholder={t('claimLabel')}
              defaultValue={claim ?? ''}
              maxLength={12}
              required
            />
            <button className="btn btn--primary btn--sm" type="submit">
              {t('claimButton')}
            </button>
          </form>
        </section>
      ) : null}

      <section className="card stack" style={{ gap: 12 }}>
        <h2>{t('yourLink')}</h2>
        <ShareLink link={view.link} text={t('shareText', { friend, link: view.link })} />
        <p className="muted" style={{ margin: 0 }}>
          {t('code', { code: view.code })}
        </p>
      </section>

      <div className="referral-stats">
        <div className="card">
          <strong>{t('earned', { amount: f.money(view.earnedCents) })}</strong>
        </div>
        <div className="card">
          <strong>
            {t('progress', { count: view.rewardedThisYear, limit: view.yearlyLimit })}
          </strong>
        </div>
      </div>

      <section className="card">
        <h2>{t('invitesTitle')}</h2>
        {view.invites.length ? (
          <ul className="referral-list">
            {view.invites.map((invite, i) => (
              <li key={`${invite.joinedAt}-${i}`}>
                <span>
                  <strong>{invite.name ?? t('aFriend')}</strong>
                  <span className="muted"> · {t('joined', { date: f.date(invite.joinedAt) })}</span>
                </span>
                <span className={`referral-status referral-status--${invite.status.toLowerCase()}`}>
                  {invite.status === 'REWARDED'
                    ? t('status_REWARDED', { amount: reward })
                    : invite.status === 'REJECTED'
                      ? `${t('status_REJECTED')}${invite.reason ? `: ${t(`reason_${invite.reason}`)}` : ''}`
                      : t('status_PENDING')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {t('none')}
          </p>
        )}
      </section>

      <section className="card">
        <h2>{t('howTitle')}</h2>
        <ol className="referral-rules">
          <li>{t('rule1', { friend, min })}</li>
          <li>{t('rule2', { reward })}</li>
          <li>{t('rule3', { limit: view.yearlyLimit })}</li>
        </ol>
      </section>
    </div>
  );
}
