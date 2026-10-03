import type { Metadata } from 'next';
import { AuthCard, Submit } from '@/components/AuthCard';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { resetPassword } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('auth');
  return { title: t('resetTitle'), robots: { index: false } };
}

export default async function ResetPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const t = await getT('auth');
  return (
    <AuthCard title={t('resetTitle')} error={param(params, 'error')}>
      <form action={resetPassword} className="form">
        <input type="hidden" name="token" value={param(params, 'token') ?? ''} />
        <label>
          {t('newPassword')} <span className="hint">{t('newPasswordHint')}</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <Submit>{t('savePassword')}</Submit>
      </form>
    </AuthCard>
  );
}
