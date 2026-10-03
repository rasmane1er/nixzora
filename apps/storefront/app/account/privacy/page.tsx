import { type MeResponse } from '@nixzora/validation';
import type { Metadata } from 'next';
import { rich } from '@nixzora/i18n';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { closeAccount } from '../hub-actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('accountActivity');
  return { title: t('privacyTitle'), robots: { index: false } };
}

export default async function PrivacyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [me, t] = await Promise.all([
    accountApi<MeResponse>('/auth/me', '/account/privacy'),
    getT('accountActivity'),
  ]);

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title={t('privacyTitle')} description={t('privacyDescription')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <div className="account-grid">
        <section className="card stack">
          <h2>{t('downloadTitle')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t('downloadBody')}
          </p>
          <div>
            <a className="btn btn--primary" href="/account/export" download>
              {t('downloadButton')}
            </a>
          </div>
          <p className="hint">
            {rich(t('privacyNoticeHint'), {
              link: (chunk) => (
                <Link key="privacy" href="/privacy">
                  {chunk}
                </Link>
              ),
            })}
          </p>
        </section>

        <section className="card stack" id="close">
          <h2>{t('closeTitle')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t('closeBody')}
          </p>
          <details>
            <summary>{t('closeSummary')}</summary>
            <form action={closeAccount} className="form" style={{ marginTop: 12 }}>
              {me.hasPassword ? (
                <label>
                  {t('yourPassword')}
                  <input name="password" type="password" autoComplete="current-password" required />
                </label>
              ) : (
                <label>
                  {t('typeDelete')}
                  <input name="confirm" required pattern="DELETE" autoComplete="off" />
                </label>
              )}
              <label className="check">
                <input type="checkbox" name="understand" required /> {t('understand')}
              </label>
              <div>
                <button className="btn btn--danger" type="submit">
                  {t('closeButton')}
                </button>
              </div>
            </form>
          </details>
        </section>
      </div>
    </div>
  );
}
