import { Logo } from '@nixzora/ui';
import Link from 'next/link';
import { type SavedAddress, type SellerMeResponse } from '@nixzora/validation';
import { api, catalog, currentCart } from '@/lib/api';
import { INTL_LOCALE } from '@nixzora/i18n';
import { departmentName, getLocale, getT } from '@/lib/i18n';
import { SearchBox } from './SearchBox';
import { isSignedIn } from '@/lib/session';

const ICONS = {
  assistant:
    'M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.25a7.5 7.5 0 0 1 15 0',
  sell: 'M3.75 9 5.25 3.75h13.5L20.25 9M3.75 9h16.5M3.75 9v.75a2.75 2.75 0 0 0 5.5 0M9.25 9v.75a2.75 2.75 0 0 0 5.5 0M14.75 9v.75a2.75 2.75 0 0 0 5.5 0M5.25 12.5v7.75h13.5V12.5M10 20.25v-4.5h4v4.5',
  cart: 'M2.25 3h2.1l2.4 11.25h11.1l2.4-8.25H6M9 19.5a1.25 1.25 0 1 0 0 .01M17.25 19.5a1.25 1.25 0 1 0 0 .01',
};

function HeaderIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export async function SiteHeader() {
  const [categories, cart, signedIn] = await Promise.all([
    catalog.categories().catch(() => []),
    currentCart(),
    isSignedIn(),
  ]);
  const count = cart?.itemCount ?? 0;
  const t = await getT('common');
  const l = await getT('layout');
  const s = await getT('search');
  const ph = await getT('photo');
  const dealsLabel = (await getT('deals'))('navDeals');
  const plusLabel = (await getT('plus'))('metaTitle');
  const couponsLabel = (await getT('clips'))('navCoupons');
  const locale = await getLocale();
  const names = await Promise.all(categories.map((category) => departmentName(category)));
  // Sellers get their dashboard; everyone else is invited to sell.
  const hasStore = signedIn
    ? await api<SellerMeResponse>('/seller/me')
        .then((me) => Boolean(me.seller))
        .catch(() => false)
    : false;
  // "Deliver to Alex · Washington 20001" (ADR-0053), from the default shipping address.
  const tu = await getT('shopUi');
  const addresses = signedIn
    ? await api<SavedAddress[]>('/me/addresses').catch(() => [] as SavedAddress[])
    : [];
  const address = addresses.find((a) => a.isDefaultShipping) ?? addresses[0];
  const deliverTo = address
    ? tu('deliverTo', {
        name: address.fullName.split(' ')[0] ?? address.fullName,
        place: `${address.city} ${address.postalCode}`,
      })
    : tu('deliverGuest');

  return (
    <header className="site-header">
      <div className="wrap site-header__row">
        <Link href="/" className="logo" aria-label={l('home')}>
          <Logo size={34} inverted />
        </Link>
        <SearchBox
          labels={{
            placeholder: t('searchPlaceholder'),
            label: t('searchLabel'),
            submit: t('search'),
            suggestions: s('suggestionsLabel'),
            didYouMean: s('didYouMean', { q: '{q}' }),
            searches: s('searches'),
            departments: s('departments'),
            brands: s('brands'),
            products: s('products'),
            photo: ph('searchByPhoto'),
          }}
          formatPrice={{ locale: INTL_LOCALE[locale], currency: 'USD' }}
        />
        <nav className="site-header__links" aria-label={l('accountAndCart')}>
          <Link href="/assistant" className="hide-sm header-link">
            <HeaderIcon d={ICONS.assistant} />
            {t('assistant')}
          </Link>
          <Link href={signedIn ? '/account' : '/account/login'} className="header-link">
            <HeaderIcon d={ICONS.account} />
            {signedIn ? t('account') : t('signIn')}
          </Link>
          <Link href="/sell" className="hide-sm header-link">
            <HeaderIcon d={ICONS.sell} />
            {hasStore ? t('sellerDashboard') : t('sell')}
          </Link>
          <Link href="/cart" className="cart-link header-link">
            <HeaderIcon d={ICONS.cart} />
            {t('cart')}
            <span className="cart-count" aria-label={t('cartItems', { count })}>
              {count}
            </span>
          </Link>
        </nav>
      </div>
      {categories.length ? (
        <nav className="wrap cat-nav" aria-label={l('departments')}>
          <Link
            href={signedIn ? '/account/addresses' : '/account/login'}
            className="cat-nav__deliver"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            {deliverTo}
          </Link>
          <Link href="/deals" className="cat-nav__deals">
            {dealsLabel}
          </Link>
          <Link href="/plus" className="cat-nav__plus">
            {plusLabel}
          </Link>
          <Link href="/coupons">{couponsLabel}</Link>
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
