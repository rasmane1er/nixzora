import type { Metadata } from 'next';
import { AuthCard, Submit } from '@/components/AuthCard';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { forgotPassword } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('auth');
  return { title: t('forgotTitle'), robots: { index: false } };
}

export default async function ForgotPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const t = await getT('auth');
  return (
    <AuthCard
      title={t('forgotTitle')}
      intro={t('forgotIntro')}
      error={param(params, 'error')}
      notice={param(params, 'sent') ? t('resetLinkSent') : undefined}
    >
      <form action={forgotPassword} className="form">
        <label>
          {t('email')}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <Submit>{t('sendLink')}</Submit>
      </form>
    </AuthCard>
  );
}
