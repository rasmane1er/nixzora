import type { Metadata } from 'next';
import { Logo } from '@nixzora/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner } from '@/components/ui';
import { param, type SearchParams } from '@/lib/format';
import { signIn } from './actions';

export const metadata: Metadata = { title: 'Sign in' };

const REASONS: Record<string, string> = {
  expired: 'Your session ended. Sign in again.',
  denied: 'That account does not have Ops Center access.',
  signedOut: 'You are signed out.',
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const reason = Object.keys(REASONS).find((key) => param(params, key));

  return (
    <main className="auth">
      <div className="auth__card">
        <Logo size={40} />
        <div>
          <h1>Ops Center</h1>
          <p className="muted">Staff sign-in. Two-step verification is required.</p>
        </div>
        <Banner
          error={param(params, 'error') ?? (reason === 'denied' ? REASONS.denied : undefined)}
          notice={reason && reason !== 'denied' ? REASONS[reason] : undefined}
        />
        <form action={signIn} className="form">
          <label>
            Work email
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <SubmitButton>Sign in</SubmitButton>
        </form>
      </div>
    </main>
  );
}
