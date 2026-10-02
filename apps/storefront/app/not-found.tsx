import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap section">
      <section className="card auth stack">
        <h1>We couldn’t find that</h1>
        <p className="muted">The page or product may have moved, or the link is incomplete.</p>
        <Link className="btn btn--primary" href="/search">
          Browse all products
        </Link>
      </section>
    </div>
  );
}
