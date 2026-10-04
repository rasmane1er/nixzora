'use client';

import { type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useT } from './I18nProvider';

/** Disables itself while its form is submitting, so staff can't double-submit. */
export function SubmitButton({
  children,
  tone = 'primary',
  name,
  value,
}: {
  children: ReactNode;
  tone?: 'primary' | 'secondary' | 'danger';
  /** For forms with several submit buttons: which one was pressed. */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const t = useT('ops');
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={`btn btn--${tone}`}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? t('working') : children}
    </button>
  );
}
