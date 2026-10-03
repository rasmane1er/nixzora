import Link from 'next/link';
import { getT } from '@/lib/i18n';

export default async function NotFound() {
  const t = await getT('ops');
  return (
    <main className="auth">
      <div className="auth__card">
        <h1>{t('notFoundTitle')}</h1>
        <p className="muted">{t('notFoundBody')}</p>
        <Link className="btn btn--primary" href="/">
          {t('backToDashboard')}
        </Link>
      </div>
    </main>
  );
}
