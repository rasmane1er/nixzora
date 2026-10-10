import { type ShoppingListSummary } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';
import { ListForm } from './ListForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('lists');
  return { title: t('metaTitle'), robots: { index: false } };
}

/** Your lists and registries (p10-08). */
export default async function ListsPage() {
  const [lists, t, f] = await Promise.all([
    accountApi<ShoppingListSummary[]>('/me/lists', '/account/lists'),
    getT('lists'),
    getFormat(),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title={t('title')} description={t('lead')} />
      {lists.length ? (
        <ul className="list-tiles">
          {lists.map((list) => (
            <li key={list.id}>
              <Link href={`/account/lists/${list.id}`} className="list-tile card">
                <span className="list-tile__art" aria-hidden="true">
                  {list.previews.slice(0, 4).map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny previews
                    <img key={src} src={src} alt="" width={60} height={45} loading="lazy" />
                  ))}
                </span>
                <strong>{list.name}</strong>
                <span className="muted">
                  {t(`kind_${list.kind}`)} · {t('itemCount', { count: list.itemCount })} ·{' '}
                  {list.isShared ? t('shared') : t('private')}
                  {list.eventDate
                    ? ` · ${t('eventOn', { date: f.date(`${list.eventDate}T12:00:00`) })}`
                    : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty card">
          <p>{t('none')}</p>
        </div>
      )}
      <ListForm />
    </div>
  );
}
