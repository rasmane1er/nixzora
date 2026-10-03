import { type ReactNode } from 'react';

/** Long-form policy pages (privacy, terms): readable line length, plain headings. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="wrap section">
      <article className="legal">
        <h1>{title}</h1>
        <p className="muted">Last updated {updated}</p>
        {children}
      </article>
    </div>
  );
}

export const CONTACT_EMAIL = 'opportunitycorridorllc@gmail.com';
