import { Logo } from '@nixzora/ui';
import Link from 'next/link';
import { type SellerMeResponse } from '@nixzora/validation';
import { api, catalog, currentCart } from '@/lib/api';
import { departmentName, getT } from '@/lib/i18n';
import { isSignedIn } from '@/lib/session';

export async function SiteHeader() {
  const [categories, cart, signedIn] = await Promise.all([
    catalog.categories().catch(() => []),
    currentCart(),
    isSignedIn(),
  ]);
  const count = cart?.itemCount ?? 0;
  const t = await getT('common');
  const l = await getT('layout');
  const names = await Promise.all(categories.map((category) => departmentName(category)));
  // Sellers get their dashboard; everyone else is invited to sell.
  const hasStore = signedIn
    ? await api<SellerMeResponse>('/seller/me')
        .then((me) => Boolean(me.seller))
        .catch(() => false)
    : false;

  return (
    <header className="site-header">
      <div className="wrap site-header__row">
        <Link href="/" className="logo" aria-label={l('home')}>
          <Logo size={34} />
        </Link>
        <form action="/search" className="site-search" role="search">
          <input
            type="search"
            name="q"
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel')}
          />
          <button className="btn btn--primary" type="submit">
            {t('search')}
          </button>
        </form>
        <nav className="site-header__links" aria-label={l('accountAndCart')}>
          <Link href="/assistant" className="hide-sm">
            {t('assistant')}
          </Link>
          <Link href={signedIn ? '/account' : '/account/login'}>
            {signedIn ? t('account') : t('signIn')}
          </Link>
          <Link href="/sell" className="hide-sm">
            {hasStore ? t('sellerDashboard') : t('sell')}
          </Link>
          <Link href="/cart" className="cart-link">
            {t('cart')}
            <span className="cart-count" aria-label={t('cartItems', { count })}>
              {count}
            </span>
          </Link>
        </nav>
      </div>
      {categories.length ? (
        <nav className="wrap cat-nav" aria-label={l('departments')}>
          {categories.map((category, i) => (
            <Link key={category.id} href={`/c/${category.slug}`}>
              {names[i]}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
