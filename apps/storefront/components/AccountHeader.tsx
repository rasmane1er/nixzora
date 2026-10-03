import Link from 'next/link';

/** "Your Account › Orders": every account page starts with the way back to the hub. */
export function AccountHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="section-head" style={{ marginBottom: 0 }}>
      <div className="stack" style={{ gap: 6 }}>
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb">
            <li>
              <Link href="/account">Your account</Link>
            </li>
            <li aria-current="page">{title}</li>
          </ol>
        </nav>
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {actions ? <div className="account-head__actions">{actions}</div> : null}
    </div>
  );
}

export function Notices({ notice, error }: { notice?: string; error?: string }) {
  return (
    <>
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
    </>
  );
}
