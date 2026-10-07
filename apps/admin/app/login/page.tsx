import type { Metadata } from 'next';
import { Logo } from '@nixzora/ui';
import { LanguagePicker } from '@/components/LanguagePicker';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner } from '@/components/ui';
import { param, type SearchParams } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { signIn } from './actions';

/** Staff reset their password on the storefront: same account, same reset email. */
const FORGOT_PASSWORD_URL = `${(process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/account/forgot-password`;

export async function generateMetadata(): Promise<Metadata> {
  const common = await getT('common');
  return { title: common('signIn') };
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [t, common] = await Promise.all([getT('ops'), getT('common')]);
  const REASONS: Record<string, string> = {
    expired: t('reasonExpired'),
    denied: t('reasonDenied'),
    signedOut: t('reasonSignedOut'),
  };
  const reason = Object.keys(REASONS).find((key) => param(params, key));

  return (
    <main className="auth">
      <div className="auth__card">
        <Logo size={40} />
        <div>
          <h1>{t('opsCenter')}</h1>
          <p className="muted">{t('loginIntro')}</p>
        </div>
        <Banner
          error={param(params, 'error') ?? (reason === 'denied' ? REASONS.denied : undefined)}
          notice={reason && reason !== 'denied' ? REASONS[reason] : undefined}
        />
        <form action={signIn} className="form">
          <label>
            {t('workEmail')}
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <label>
            {t('password')}
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <SubmitButton>{common('signIn')}</SubmitButton>
        </form>
        <p>
          <a href={FORGOT_PASSWORD_URL}>{t('forgotPassword')}</a>
        </p>
        <LanguagePicker id="login-language" />
      </div>
    </main>
  );
}
