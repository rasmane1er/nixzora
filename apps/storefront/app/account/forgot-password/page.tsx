import type { Metadata } from 'next';
import { AuthCard, Submit } from '@/components/AuthCard';
import { param, type SearchParams } from '@/lib/params';
import { forgotPassword } from '../actions';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default async function ForgotPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Reset your password"
      intro="We’ll email you a link to choose a new one."
      error={param(params, 'error')}
      notice={
        param(params, 'sent')
          ? 'If that email has an account, a reset link is on its way.'
          : undefined
      }
    >
      <form action={forgotPassword} className="form">
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <Submit>Send link</Submit>
      </form>
    </AuthCard>
  );
}
