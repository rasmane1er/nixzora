import type { Metadata } from 'next';
import { AuthCard, Submit } from '@/components/AuthCard';
import { param, type SearchParams } from '@/lib/params';
import { resetPassword } from '../actions';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <AuthCard title="Choose a new password" error={param(params, 'error')}>
      <form action={resetPassword} className="form">
        <input type="hidden" name="token" value={param(params, 'token') ?? ''} />
        <label>
          New password <span className="hint">At least 12 characters.</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <Submit>Save password</Submit>
      </form>
    </AuthCard>
  );
}
