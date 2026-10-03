import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@nixzora/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner } from '@/components/ui';
import { param, type SearchParams } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { verifyCode } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return { title: t('verifyTitle') };
}

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const t = await getT('ops');
  return (
    <main className="auth">
      <div className="auth__card">
        <Logo size={40} />
        <div>
          <h1>{t('enterCode')}</h1>
          <p className="muted">{t('verifyIntro')}</p>
        </div>
        <Banner error={param(params, 'error')} />
        <form action={verifyCode} className="form">
          <label>
            {t('code')}
            <input
              name="code"
              inputMode="text"
              autoComplete="one-time-code"
              placeholder="123456"
              required
              autoFocus
            />
          </label>
          <SubmitButton>{t('verify')}</SubmitButton>
        </form>
        <Link href="/login" className="muted">
          {t('differentAccount')}
        </Link>
      </div>
    </main>
  );
}
