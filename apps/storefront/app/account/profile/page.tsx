import { rich } from '@nixzora/i18n';
import { type AccountProfile } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { Avatar } from '@/components/Avatar';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { removeAvatar, updateProfile } from '../hub-actions';
import { AvatarUpload } from './AvatarUpload';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('account');
  return { title: t('editProfile'), robots: { index: false } };
}

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const profile = await accountApi<AccountProfile>('/me/profile', '/account/profile');
  const [t, tc] = await Promise.all([getT('account'), getT('common')]);
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');

  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 820 }}>
      <AccountHeader title={t('editProfile')} description={t('profileDescription')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <section className="card stack">
        <h2>{t('profilePhoto')}</h2>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar url={profile.avatarUrl} name={name} email={profile.email} size={96} />
          <div className="stack" style={{ gap: 8 }}>
            <AvatarUpload hasPhoto={!!profile.avatarUrl} />
            {profile.avatarUrl ? (
              <form action={removeAvatar}>
                <button className="btn btn--link" type="submit">
                  {t('removePhoto')}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card stack">
        <h2>{t('nameAndPhone')}</h2>
        <form action={updateProfile} className="form">
          <div className="form-row">
            <label>
              {t('firstName')}
              <input
                name="firstName"
                defaultValue={profile.firstName ?? ''}
                maxLength={60}
                autoComplete="given-name"
              />
            </label>
            <label>
              {t('lastName')}
              <input
                name="lastName"
                defaultValue={profile.lastName ?? ''}
                maxLength={60}
                autoComplete="family-name"
              />
            </label>
          </div>
          <label>
            {t('mobileNumber')} <span className="hint">{t('mobileHint')}</span>
            <input
              name="phone"
              type="tel"
              defaultValue={profile.phone ?? ''}
              maxLength={20}
              autoComplete="tel"
            />
          </label>
          <div>
            <button className="btn btn--primary" type="submit">
              {tc('save')}
            </button>
          </div>
        </form>
      </section>

      <section className="card stack">
        <h2>{t('email')}</h2>
        <p style={{ margin: 0 }}>
          <strong>{profile.email}</strong>{' '}
          <span
            className={`pill ${profile.emailVerified ? 'pill--delivered' : 'pill--pending_payment'}`}
          >
            {profile.emailVerified ? t('confirmed') : t('notConfirmed')}
          </span>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {rich(t('securityPointer'), {
            link: (chunk) => (
              <Link key="security" href="/account/security">
                {chunk}
              </Link>
            ),
          })}
        </p>
      </section>
    </div>
  );
}
