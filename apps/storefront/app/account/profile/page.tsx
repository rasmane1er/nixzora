import { type AccountProfile } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { Avatar } from '@/components/Avatar';
import { accountApi } from '@/lib/account';
import { param, type SearchParams } from '@/lib/params';
import { removeAvatar, updateProfile } from '../hub-actions';
import { AvatarUpload } from './AvatarUpload';

export const metadata: Metadata = { title: 'Edit profile', robots: { index: false } };

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const profile = await accountApi<AccountProfile>('/me/profile', '/account/profile');
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');

  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 820 }}>
      <AccountHeader
        title="Edit profile"
        description="How we greet you and how couriers reach you."
      />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <section className="card stack">
        <h2>Profile photo</h2>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar url={profile.avatarUrl} name={name} email={profile.email} size={96} />
          <div className="stack" style={{ gap: 8 }}>
            <AvatarUpload hasPhoto={!!profile.avatarUrl} />
            {profile.avatarUrl ? (
              <form action={removeAvatar}>
                <button className="btn btn--link" type="submit">
                  Remove photo
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card stack">
        <h2>Name and phone</h2>
        <form action={updateProfile} className="form">
          <div className="form-row">
            <label>
              First name
              <input
                name="firstName"
                defaultValue={profile.firstName ?? ''}
                maxLength={60}
                autoComplete="given-name"
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                defaultValue={profile.lastName ?? ''}
                maxLength={60}
                autoComplete="family-name"
              />
            </label>
          </div>
          <label>
            Mobile number{' '}
            <span className="hint">For delivery questions only. We never sell it.</span>
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
              Save
            </button>
          </div>
        </form>
      </section>

      <section className="card stack">
        <h2>Email</h2>
        <p style={{ margin: 0 }}>
          <strong>{profile.email}</strong>{' '}
          <span
            className={`pill ${profile.emailVerified ? 'pill--delivered' : 'pill--pending_payment'}`}
          >
            {profile.emailVerified ? 'Confirmed' : 'Not confirmed'}
          </span>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Password, two-step verification and devices are in{' '}
          <Link href="/account/security">Password &amp; security</Link>.
        </p>
      </section>
    </div>
  );
}
