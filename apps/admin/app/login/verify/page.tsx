import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@nixzora/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner } from '@/components/ui';
import { param, type SearchParams } from '@/lib/format';
import { verifyCode } from '../actions';

export const metadata: Metadata = { title: 'Two-step verification' };

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <main className="auth">
      <div className="auth__card">
        <Logo size={40} />
        <div>
          <h1>Enter your code</h1>
          <p className="muted">
            Open your authenticator app and enter the 6-digit code, or use one of your recovery
            codes.
          </p>
        </div>
        <Banner error={param(params, 'error')} />
        <form action={verifyCode} className="form">
          <label>
            Code
            <input
              name="code"
              inputMode="text"
              autoComplete="one-time-code"
              placeholder="123456"
              required
              autoFocus
            />
          </label>
          <SubmitButton>Verify</SubmitButton>
        </form>
        <Link href="/login" className="muted">
          ← Use a different account
        </Link>
      </div>
    </main>
  );
}
