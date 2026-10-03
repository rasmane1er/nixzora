'use client';

import { useT } from '@/components/I18nProvider';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useT('errors');
  const tc = useT('common');
  return (
    <div className="wrap section">
      <section className="card auth stack">
        <h1>{t('errorTitle')}</h1>
        <p className="muted">{t('errorBody')}</p>
        <button className="btn btn--primary" type="button" onClick={reset}>
          {tc('tryAgain')}
        </button>
      </section>
    </div>
  );
}
