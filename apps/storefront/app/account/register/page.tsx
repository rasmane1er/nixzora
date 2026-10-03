import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard, Submit } from '@/components/AuthCard';
import { SocialSignIn } from '@/components/SocialSignIn';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { socialProviders } from '../social-actions';
import { register } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('auth');
  return { title: t('registerTitle'), robots: { index: false } };
}

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = param(params, 'next') ?? '/account';
  const providers = await socialProviders();
  const t = await getT('auth');
  return (
    <AuthCard title={t('registerTitle')} error={param(params, 'error')}>
      <SocialSignIn providers={providers} next={next} intent="signup" />
      <form action={register} className="form">
        <input type="hidden" name="next" value={next} />
        <label>
          {t('firstName')} <span className="hint">{t('optional')}</span>
          <input name="firstName" autoComplete="given-name" maxLength={100} />
        </label>
        <label>
          {t('email')}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          {t('password')} <span className="hint">{t('passwordHint')}</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <Submit>{t('createAccountButton')}</Submit>
      </form>
      <p className="muted" style={{ fontSize: 14 }}>
        {rich(t('alreadyHaveOne'), {
          link: (chunk) => (
            <Link key="login" href={`/account/login?next=${encodeURIComponent(next)}`}>
              {chunk}
            </Link>
          ),
        })}
      </p>
    </AuthCard>
  );
}
