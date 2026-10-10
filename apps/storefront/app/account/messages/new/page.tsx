import { type PublicSeller } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AccountHeader } from '@/components/AccountHeader';
import { AskStoreForm } from '@/components/MessageForms';
import { api } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('inbox');
  return { title: t('askStore'), robots: { index: false } };
}

/** First message to a store: /account/messages/new?store=<handle>[&product=<id>][&order=<number>]. */
export default async function NewMessagePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const store = param(params, 'store') ?? '';
  if (!/^[a-z0-9-]{2,60}$/.test(store)) notFound();
  const here = `/account/messages/new?${new URLSearchParams(
    Object.entries({
      store,
      product: param(params, 'product'),
      order: param(params, 'order'),
    }).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString()}`;
  if (!(await isSignedIn())) redirect(`/account/login?next=${encodeURIComponent(here)}`);
  const seller = await api<PublicSeller>(`/catalog/sellers/${store}`, {
    auth: false,
    revalidate: 60,
  }).catch(() => null);
  if (!seller) notFound();
  const t = await getT('inbox');
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 760 }}>
      <AccountHeader
        title={t('contactStore', { store: seller.displayName })}
        actions={
          <Link href="/account/messages" className="btn btn--secondary">
            {t('back')}
          </Link>
        }
      />
      <section className="card">
        <AskStoreForm
          store={store}
          storeName={seller.displayName}
          productId={param(params, 'product')}
          orderNumber={param(params, 'order')}
        />
      </section>
      <p className="muted" style={{ fontSize: 14 }}>
        {t('safety')}
      </p>
    </div>
  );
}
