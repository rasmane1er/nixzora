import { INTL_LOCALE } from '@nixzora/i18n';
import { type ReactNode } from 'react';
import { getLocale, getT } from '@/lib/i18n';

/** Midday so the calendar day stays the same in every server time zone. */
function parseDay(updated: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(updated) ? `${updated}T12:00:00` : updated);
}

/**
 * Long-form policy pages (privacy, terms): readable line length, plain headings.
 * `updated` is a day ("2026-10-03"), shown in the visitor's language. `translationNote` adds a
 * line, outside English, saying the English version prevails.
 */
export async function LegalPage({
  title,
  updated,
  translationNote = false,
  children,
}: {
  title: string;
  updated: string;
  translationNote?: boolean;
  children: ReactNode;
}) {
  const [t, locale] = await Promise.all([getT('legal'), getLocale()]);
  const day = parseDay(updated);
  return (
    <div className="wrap section">
      <article className="legal">
        <h1>{title}</h1>
        {translationNote && locale !== 'en' ? (
          <p className="muted">
            <em>{t('translationNote')}</em>
          </p>
        ) : null}
        <p className="muted">
          {t('lastUpdated', {
            date: Number.isNaN(day.getTime())
              ? updated
              : new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: 'long' }).format(day),
          })}
        </p>
        {children}
      </article>
    </div>
  );
}

export const CONTACT_EMAIL = 'opportunitycorridorllc@gmail.com';
