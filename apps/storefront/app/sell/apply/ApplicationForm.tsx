'use client';

import { useActionState, useEffect } from 'react';
import type { SubmitState } from './actions';

/**
 * The review step's form. When the store is created, the seller portal opens as a full page
 * load in the same tab: the header, the session and the portal all change at once, which a
 * client-side redirect did not always manage (it left a blank page until the user reloaded).
 */
export function ApplicationForm({
  action,
  opening,
  children,
}: {
  action: (state: SubmitState, form: FormData) => Promise<SubmitState>;
  opening: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  useEffect(() => {
    // A full page load on purpose (see above), not router.push.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (state.done) window.location.assign('/sell?applied=1');
  }, [state.done]);
  return (
    <form id="form" action={formAction} className="card form stack" aria-busy={state.done}>
      {/* Locked once the store exists, so a second click cannot submit it again. */}
      <fieldset
        disabled={state.done}
        className="stack"
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        {children}
      </fieldset>
      {state.done ? (
        <p className="banner banner--ok" role="status">
          {opening}
        </p>
      ) : null}
    </form>
  );
}
