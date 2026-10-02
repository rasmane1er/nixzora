import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard, Submit } from '@/components/AuthCard';
import { SocialSignIn } from '@/components/SocialSignIn';
import { param, type SearchParams } from '@/lib/params';
import { socialProviders } from '../social-actions';
import { signIn } from '../actions';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = param(params, 'next') ?? '/account';
  const providers = await socialProviders();
  return (
    <AuthCard
      title="Sign in"
      intro="See your orders, save addresses and check out faster."
      error={param(params, 'error')}
      notice={
        param(params, 'reset') ? 'Password changed. Sign in with your new password.' : undefined
      }
    >
      <SocialSignIn providers={providers} next={next} intent="signin" />
      <form action={signIn} className="form">
        <input type="hidden" name="next" value={next} />
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required autoFocus />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <Submit>Sign in</Submit>
      </form>
      <p className="muted" style={{ fontSize: 14 }}>
        <Link href="/account/forgot-password">Forgot your password?</Link>
        <br />
        New to NIXZORA?{' '}
        <Link href={`/account/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </AuthCard>
  );
}
