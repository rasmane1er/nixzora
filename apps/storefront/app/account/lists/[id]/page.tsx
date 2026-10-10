import { type ShoppingListView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AccountHeader } from '@/components/AccountHeader';
import { CopyLink } from '@/components/CopyLink';
import { ProductCard } from '@/components/ProductCard';
import { accountApi } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { SITE_URL } from '@/lib/params';
import { deleteList, removeListItem, resetListLink } from '../actions';
import { ListForm } from '../ListForm';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('lists');
  return { title: t('metaTitle'), robots: { index: false } };
}

export default async function ListPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const list = await accountApi<ShoppingListView>(`/me/lists/${id}`, `/account/lists/${id}`).catch(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    },
  );
  const [t, f] = await Promise.all([getT('lists'), getFormat()]);

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title={list.name}
        description={[
          t(`kind_${list.kind}`),
          t('itemCount', { count: list.itemCount }),
          list.eventDate ? t('eventOn', { date: f.date(`${list.eventDate}T12:00:00`) }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <Link href="/account/lists" className="btn btn--secondary">
            {t('backToLists')}
          </Link>
        }
      />

      <section className="card stack" aria-labelledby="share-title" style={{ gap: 10 }}>
        <h2 id="share-title">{t('shareTitle')}</h2>
        {list.isShared ? (
          <>
            <p className="muted">{t('shareHint')}</p>
            <CopyLink url={`${SITE_URL}/lists/${list.shareToken}`} />
            <form action={resetListLink}>
              <input type="hidden" name="id" value={list.id} />
              <button className="btn btn--link" type="submit">
                {t('resetLink')}
              </button>{' '}
              <span className="muted" style={{ fontSize: 13 }}>
                {t('resetHint')}
              </span>
            </form>
          </>
        ) : (
          <p className="muted">{t('shareOff')}</p>
        )}
      </section>

      {list.items.length ? (
        <div className="grid">
          {list.items.map((item) => (
            <div key={item.product.id} className="stack" style={{ gap: 6 }}>
              <ProductCard product={item.product} />
              {item.quantity > 1 || item.note ? (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  {item.quantity > 1 ? t('wantQty', { count: item.quantity }) : null}
                  {item.quantity > 1 && item.note ? ' · ' : null}
                  {item.note}
                </p>
              ) : null}
              <form action={removeListItem}>
                <input type="hidden" name="id" value={list.id} />
                <input type="hidden" name="productId" value={item.product.id} />
                <button className="btn btn--link" type="submit">
                  {t('remove')}
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty card">
          <p>{t('empty')}</p>
        </div>
      )}

      <ListForm list={list} />
      <form action={deleteList}>
        <input type="hidden" name="id" value={list.id} />
        <button className="btn btn--danger" type="submit">
          {t('deleteList')}
        </button>
      </form>
    </div>
  );
}
