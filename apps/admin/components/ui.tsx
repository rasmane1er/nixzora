import Link from 'next/link';
import { type ReactNode } from 'react';
import { OpsText, PagesNav } from './OpsText';
import { SubmitButton } from './SubmitButton';

export { StatusPill } from './OpsText';

/** Success or error banner driven by ?notice= / ?error= after a form action. */
export function Banner({ notice, error }: { notice?: string; error?: string }) {
  if (error) {
    return (
      <p className="banner banner--error" role="alert">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p className="banner banner--ok" role="status">
        {notice}
      </p>
    );
  }
  return null;
}

export function PageHeader({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function Pager({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <PagesNav>
      {page > 1 ? (
        <Link href={href(page - 1)}>
          <OpsText k="previous" />
        </Link>
      ) : (
        <span />
      )}
      <span className="muted">
        <OpsText k="pageOf" vars={{ page, total: totalPages }} />
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)}>
          <OpsText k="next" />
        </Link>
      ) : (
        <span />
      )}
    </PagesNav>
  );
}

/** A one-button form for small actions such as suspend or remove. */
export function ActionButton({
  action,
  label,
  fields = {},
  tone = 'secondary',
}: {
  action: (form: FormData) => Promise<void>;
  label: string;
  fields?: Record<string, string>;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <form action={action} className="inline-form">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton tone={tone}>{label}</SubmitButton>
    </form>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
