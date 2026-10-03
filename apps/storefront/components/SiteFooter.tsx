import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__row">
        <div className="stack" style={{ gap: 6 }}>
          <strong>NIXZORA</strong>
          <span className="muted">
            Computers and electronics, explained. Free shipping over $99 · 30-day returns.
          </span>
        </div>
        <nav aria-label="Footer">
          <Link href="/search">All products</Link>
          <Link href="/account">Your orders</Link>
          <Link href="/status">Platform status</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </div>
      <div className="wrap muted" style={{ marginTop: 16, fontSize: 13 }}>
        Demo store: products, brands and prices are fictional.
      </div>
    </footer>
  );
}
