import { type ReactNode } from 'react';

export function AuthCard({
  title,
  intro,
  error,
  notice,
  children,
}: {
  title: string;
  intro?: ReactNode;
  error?: string;
  notice?: string;
  children: ReactNode;
}) {
  return (
    <div className="wrap">
      <section className="card auth stack">
        <h1>{title}</h1>
        {intro ? <p className="muted">{intro}</p> : null}
        {error ? (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="banner banner--ok" role="status">
            {notice}
          </p>
        ) : null}
        {children}
      </section>
    </div>
  );
}

export function Submit({ children }: { children: ReactNode }) {
  return (
    <button className="btn btn--primary btn--block" type="submit">
      {children}
    </button>
  );
}
