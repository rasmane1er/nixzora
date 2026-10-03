import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/AuthCard';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('auth');
  return { title: t('confirmEmailTitle'), robots: { index: false } };
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const token = param(await searchParams, 'token') ?? '';
  const t = await getT('auth');
  let error: string | undefined;
  try {
    await api('/auth/email/verify', { method: 'POST', auth: false, body: { token } });
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <AuthCard
      title={t('confirmEmailTitle')}
      error={error}
      notice={error ? undefined : t('emailConfirmed')}
    >
      <Link className="btn btn--primary btn--block" href="/account">
        {t('goToAccount')}
      </Link>
    </AuthCard>
  );
}
