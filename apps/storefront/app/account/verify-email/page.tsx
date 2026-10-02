import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { api, errorMessage } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const token = param(await searchParams, 'token') ?? '';
  let error: string | undefined;
  try {
    await api('/auth/email/verify', { method: 'POST', auth: false, body: { token } });
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <AuthCard
      title="Confirm your email"
      error={error}
      notice={error ? undefined : 'Thanks — your email is confirmed.'}
    >
      <Link className="btn btn--primary btn--block" href="/account">
        Go to your account
      </Link>
    </AuthCard>
  );
}
