'use client';

import { useT } from '@/components/I18nProvider';

/** Shown when the API is unreachable or returns something unexpected. */
export default function ConsoleError({ reset }: { error: Error; reset: () => void }) {
  const t = useT('ops');
  const common = useT('common');
  return (
    <section className="card">
      <h2>{t('errorTitle')}</h2>
      <p className="muted">{t('errorBody')}</p>
      <button className="btn btn--primary" type="button" onClick={reset}>
        {common('tryAgain')}
      </button>
    </section>
  );
}
