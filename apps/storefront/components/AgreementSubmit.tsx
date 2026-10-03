'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn--primary" type="submit" disabled={!ready || pending}>
      {pending ? 'Submitting…' : 'Submit application →'}
    </button>
  );
}

/** The three agreements; "Submit" stays disabled until all are checked. */
export function AgreementSubmit({ errors }: { errors: Record<string, string> }) {
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
          I agree to the{' '}
          <Link href="/policies/sellers" target="_blank">
            NIXZORA Seller Agreement
          </Link>
          .
        </>,
      )}
      {box(
        'returns',
        'acceptReturnPolicy',
        <>
          I agree to the{' '}
          <Link href="/policies/sellers#returns" target="_blank">
            Marketplace Return &amp; Refund Policy
          </Link>
          .
        </>,
      )}
      {box('accurate', 'confirmAccurate', 'I confirm that the information I provided is accurate.')}
      <SubmitButton ready={ready} />
    </>
  );
}
