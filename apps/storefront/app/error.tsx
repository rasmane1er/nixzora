'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap section">
      <section className="card auth stack">
        <h1>Something went wrong</h1>
        <p className="muted">We couldn’t load this page. Please try again in a moment.</p>
        <button className="btn btn--primary" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </div>
  );
}
