import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth__card">
        <h1>Not found</h1>
        <p className="muted">That page or record does not exist.</p>
        <Link className="btn btn--primary" href="/">
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
