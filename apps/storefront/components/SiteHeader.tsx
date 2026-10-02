import { Logo } from '@nixzora/ui';
import Link from 'next/link';
import { catalog, currentCart } from '@/lib/api';
import { isSignedIn } from '@/lib/session';

export async function SiteHeader() {
  const [categories, cart, signedIn] = await Promise.all([
    catalog.categories().catch(() => []),
    currentCart(),
    isSignedIn(),
  ]);
  const count = cart?.itemCount ?? 0;

  return (
    <header className="site-header">
      <div className="wrap site-header__row">
        <Link href="/" className="logo" aria-label="NIXZORA home">
          <Logo size={34} />
        </Link>
        <form action="/search" className="site-search" role="search">
          <input
            type="search"
            name="q"
            placeholder="Search laptops, monitors, headphones…"
            aria-label="Search products"
          />
          <button className="btn btn--primary" type="submit">
            Search
          </button>
        </form>
        <nav className="site-header__links" aria-label="Account and cart">
          <Link href="/assistant" className="hide-sm">
            Assistant
          </Link>
          <Link href={signedIn ? '/account' : '/account/login'}>
            {signedIn ? 'Account' : 'Sign in'}
          </Link>
          <Link href="/cart" className="cart-link">
            Cart
            <span className="cart-count" aria-label={`${count} items`}>
              {count}
            </span>
          </Link>
        </nav>
      </div>
      {categories.length ? (
        <nav className="wrap cat-nav" aria-label="Departments">
          {categories.map((category) => (
            <Link key={category.id} href={`/c/${category.slug}`}>
              {category.name}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
