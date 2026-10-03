'use client';

import { rich } from '@nixzora/i18n';
import Link from 'next/link';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useT } from '@/components/I18nProvider';

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  const t = useT('sellApply');
  return (
    <button className="btn btn--primary" type="submit" disabled={!ready || pending}>
      {pending ? t('submitting') : t('submit')}
    </button>
  );
}

/** The three agreements; "Submit" stays disabled until all are checked. */
export function AgreementSubmit({ errors }: { errors: Record<string, string> }) {
  const t = useT('sellApply');
  const [checked, setChecked] = useState({ agreement: false, returns: false, accurate: false });
  const ready = checked.agreement && checked.returns && checked.accurate;
  const box = (key: keyof typeof checked, name: string, label: React.ReactNode) => (
    <label className="check">
      <input
        type="checkbox"
        name={name}
        checked={checked[key]}
        onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
        aria-invalid={Boolean(errors[name])}
      />
      <span>
        {label}
        {errors[name] ? <span className="field-error"> {errors[name]}</span> : null}
      </span>
    </label>
  );
  return (
    <>
      {box(
        'agreement',
        'acceptAgreement',
        <>
          {rich(t('agreeAgreement'), {
            link: (chunk) => (
              <Link key="link" href="/policies/sellers" target="_blank">
                {chunk}
              </Link>
            ),
          })}
        </>,
      )}
      {box(
        'returns',
        'acceptReturnPolicy',
        <>
          {rich(t('agreeReturns'), {
            link: (chunk) => (
              <Link key="link" href="/policies/sellers#returns" target="_blank">
                {chunk}
              </Link>
            ),
          })}
        </>,
      )}
      {box('accurate', 'confirmAccurate', t('confirmAccurate'))}
      <SubmitButton ready={ready} />
    </>
  );
}
