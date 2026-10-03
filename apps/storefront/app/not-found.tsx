import Link from 'next/link';
import { getT } from '@/lib/i18n';

export default async function NotFound() {
  const t = await getT('errors');
  return (
    <div className="wrap section">
      <section className="card auth stack">
        <h1>{t('notFoundTitle')}</h1>
        <p className="muted">{t('notFoundBody')}</p>
        <Link className="btn btn--primary" href="/search">
          {t('browseAll')}
        </Link>
      </section>
    </div>
  );
}
