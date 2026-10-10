import { type SharedListView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { ProductCard } from '@/components/ProductCard';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';

type Props = { params: Promise<{ token: string }> };

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

async function load(token: string): Promise<SharedListView | null> {
  if (!TOKEN.test(token)) return null;
  return api<SharedListView>(`/lists/${token}`, { auth: false }).catch(() => null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const list = await load((await params).token);
  const t = await getT('lists');
  // Private links: never indexed, and the title stays generic for link previews.
  return { title: list ? list.name : t('metaTitle'), robots: { index: false, follow: false } };
}

/** A list or registry someone shared by its private link (p10-08). */
export default async function SharedListPage({ params }: Props) {
  const list = await load((await params).token);
  const [t, f] = await Promise.all([getT('lists'), getFormat()]);
  if (!list) {
    return (
      <div className="wrap section">
        <div className="empty card">
          <p>{t('notFound')}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">
          {t('sharedBy', { name: list.owner, kind: t(`kind_${list.kind}`) })}
        </p>
        <h1>{list.name}</h1>
        <p className="muted">
          {list.eventDate
            ? `${t('eventOn', { date: f.date(`${list.eventDate}T12:00:00`) })} · `
            : ''}
          {t('itemCount', { count: list.itemCount })}
        </p>
        {list.note ? <p>{list.note}</p> : null}
      </div>
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
            </div>
          ))}
        </div>
      ) : (
        <div className="empty card">
          <p>{t('empty')}</p>
        </div>
      )}
      <p className="muted" style={{ fontSize: 13 }}>
        {t('sharedLead')}
      </p>
    </div>
  );
}
