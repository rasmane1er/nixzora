'use client';

import { type ReactNode } from 'react';
import { type MessageKey, type Vars } from '@nixzora/i18n';
import { useT } from './I18nProvider';

/** One translated Ops Center phrase, for shared components that also render on the server. */
export function OpsText({ k, vars }: { k: MessageKey<'ops'>; vars?: Vars }) {
  const t = useT('ops');
  return <>{t(k, vars)}</>;
}

/** A status code from the API ("PENDING_PAYMENT") in the staff member's language. */
export function StatusPill({ value }: { value: string }) {
  const t = useT('ops');
  const code = value.toLowerCase();
  const key = `status_${code}` as MessageKey<'ops'>;
  const label = t(key);
  return <span className={`pill pill--${code}`}>{label === key ? code : label}</span>;
}

/** The page links under a long list. */
export function PagesNav({ children }: { children: ReactNode }) {
  const t = useT('ops');
  return (
    <nav className="pager" aria-label={t('pages')}>
      {children}
    </nav>
  );
}
