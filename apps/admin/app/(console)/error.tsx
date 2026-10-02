'use client';

/** Shown when the API is unreachable or returns something unexpected. */
export default function ConsoleError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="card">
      <h2>Something went wrong</h2>
      <p className="muted">
        The Ops Center could not load this page. Check that the API is running, then try again.
      </p>
      <button className="btn btn--primary" type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
