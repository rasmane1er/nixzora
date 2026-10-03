import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard, Submit } from '@/components/AuthCard';
import { SocialSignIn } from '@/components/SocialSignIn';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { socialProviders } from '../social-actions';
import { signIn } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('auth');
  return { title: t('signInTitle'), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = param(params, 'next') ?? '/account';
  const providers = await socialProviders();
  const t = await getT('auth');
  return (
    <AuthCard
      title={t('signInTitle')}
      intro={t('signInIntro')}
      error={param(params, 'error')}
      notice={param(params, 'reset') ? t('passwordChangedNotice') : undefined}
    >
      <SocialSignIn providers={providers} next={next} intent="signin" />
      <form action={signIn} className="form">
        <input type="hidden" name="next" value={next} />
        <label>
          {t('email')}
          <input name="email" type="email" autoComplete="email" required autoFocus />
        </label>
        <label>
          {t('password')}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <Submit>{t('signInButton')}</Submit>
      </form>
      <p className="muted" style={{ fontSize: 14 }}>
        <Link href="/account/forgot-password">{t('forgotPassword')}</Link>
        <br />
        {rich(t('newToNixzora'), {
          link: (chunk) => (
            <Link key="register" href={`/account/register?next=${encodeURIComponent(next)}`}>
              {chunk}
            </Link>
          ),
        })}
      </p>
    </AuthCard>
  );
}
