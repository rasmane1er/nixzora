import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard, Submit } from '@/components/AuthCard';
import { SocialSignIn } from '@/components/SocialSignIn';
import { param, type SearchParams } from '@/lib/params';
import { socialProviders } from '../social-actions';
import { register } from '../actions';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = param(params, 'next') ?? '/account';
  const providers = await socialProviders();
  return (
    <AuthCard title="Create an account" error={param(params, 'error')}>
      <SocialSignIn providers={providers} next={next} intent="signup" />
      <form action={register} className="form">
        <input type="hidden" name="next" value={next} />
        <label>
          First name <span className="hint">Optional</span>
          <input name="firstName" autoComplete="given-name" maxLength={100} />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password{' '}
          <span className="hint">At least 12 characters. A short sentence works well.</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <Submit>Create account</Submit>
      </form>
      <p className="muted" style={{ fontSize: 14 }}>
        Already have one?{' '}
        <Link href={`/account/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
    </AuthCard>
  );
}
