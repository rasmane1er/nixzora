import type { Metadata } from 'next';
import { AuthCard, Submit } from '@/components/AuthCard';
import { param, type SearchParams } from '@/lib/params';
import { verifyCode } from '../../actions';

export const metadata: Metadata = { title: 'Two-step verification', robots: { index: false } };

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Enter your code"
      intro="Open your authenticator app and enter the 6-digit code, or use a recovery code."
      error={param(params, 'error')}
    >
      <form action={verifyCode} className="form">
        <input type="hidden" name="next" value={param(params, 'next') ?? '/account'} />
        <label>
          Code
          <input name="code" autoComplete="one-time-code" required autoFocus placeholder="123456" />
        </label>
        <Submit>Verify</Submit>
      </form>
    </AuthCard>
  );
}
