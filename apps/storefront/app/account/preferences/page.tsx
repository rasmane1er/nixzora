import { type AccountPreferences } from '@nixzora/validation';
import type { Metadata } from 'next';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { savePreferences } from '../hub-actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('accountActivity');
  return { title: t('prefsMetaTitle'), robots: { index: false } };
}

export default async function PreferencesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [prefs, t] = await Promise.all([
    accountApi<AccountPreferences>('/me/preferences', '/account/preferences'),
    getT('accountActivity'),
  ]);

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title={t('prefsTitle')} description={t('prefsDescription')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <form action={savePreferences} className="card form" style={{ maxWidth: 720 }}>
        <fieldset className="pref-list">
          <legend className="sr-only">{t('emailsLegend')}</legend>
          <label className="pref">
            <input type="checkbox" checked disabled aria-describedby="pref-orders" />
            <span className="stack" style={{ gap: 2 }}>
              <strong>{t('prefOrders')}</strong>
              <span className="muted" id="pref-orders">
                {t('prefOrdersHint')}
              </span>
            </span>
          </label>
          <label className="pref">
            <input type="checkbox" name="reviewRequests" defaultChecked={prefs.reviewRequests} />
            <span className="stack" style={{ gap: 2 }}>
              <strong>{t('prefReviews')}</strong>
              <span className="muted">{t('prefReviewsHint')}</span>
            </span>
          </label>
          <label className="pref">
            <input type="checkbox" name="marketingEmails" defaultChecked={prefs.marketingEmails} />
            <span className="stack" style={{ gap: 2 }}>
              <strong>{t('prefDeals')}</strong>
              <span className="muted">{t('prefDealsHint')}</span>
            </span>
          </label>
        </fieldset>
        <div>
          <button className="btn btn--primary" type="submit">
            {t('savePreferences')}
          </button>
        </div>
        <p className="hint">{t('pushHint')}</p>
      </form>
    </div>
  );
}
