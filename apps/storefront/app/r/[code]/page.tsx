import { type ReferralInvitePreview } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { isSignedIn } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('referrals');
  return { title: t('metaTitle'), robots: { index: false } };
}

/** An invite link (p10-23): who sent it, what the friend gets, and sign-up with the code. */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const raw = (await params).code;
  const code = /^[A-Za-z0-9]{6,12}$/.test(raw) ? raw.toUpperCase() : null;
  const [t, f] = await Promise.all([getT('referrals'), getFormat()]);
  const invite = code
    ? await api<ReferralInvitePreview>(`/referrals/${code}`, { auth: false }).catch(() => null)
    : null;
  if (!invite || !code) {
    return (
      <div className="wrap section">
        <div className="card invite">
          <h1>{t('metaTitle')}</h1>
          <p>{t('inviteInvalid')}</p>
          <Link className="btn btn--primary" href="/">
            NIXZORA
          </Link>
        </div>
      </div>
    );
  }
  const amount = f.money(invite.friendCents);
  const signedIn = await isSignedIn();
  return (
    <div className="wrap section">
      <div className="card invite">
        <p className="eyebrow">NIXZORA</p>
        <h1>
          {invite.firstName
            ? t('inviteTitle', { name: invite.firstName, amount })
            : t('inviteTitleAnon', { amount })}
        </h1>
        <p className="muted">{t('inviteLead', { amount, min: f.money(invite.minOrderCents) })}</p>
        {signedIn ? (
          <Link className="btn btn--primary" href={`/account/referrals?claim=${code}`}>
            {t('claimButton')}
          </Link>
        ) : (
          <Link className="btn btn--primary" href={`/account/register?ref=${code}`}>
            {t('inviteCta')}
          </Link>
        )}
        <p className="hint">{t('inviteSignIn', { code })}</p>
      </div>
    </div>
  );
}
