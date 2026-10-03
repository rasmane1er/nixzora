import type { Metadata } from 'next';
import { AuthCard, Submit } from '@/components/AuthCard';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { verifyCode } from '../../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('auth');
  return { title: t('verifyMetaTitle'), robots: { index: false } };
}

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const t = await getT('auth');
  return (
    <AuthCard title={t('verifyTitle')} intro={t('verifyIntro')} error={param(params, 'error')}>
      <form action={verifyCode} className="form">
        <input type="hidden" name="next" value={param(params, 'next') ?? '/account'} />
        <label>
          {t('code')}
          <input name="code" autoComplete="one-time-code" required autoFocus placeholder="123456" />
        </label>
        <Submit>{t('verifyButton')}</Submit>
      </form>
    </AuthCard>
  );
}
