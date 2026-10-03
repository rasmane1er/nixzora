'use client';

import { SUPPORT_TOPIC_LABEL, SUPPORT_TOPICS } from '@nixzora/validation';
import Link from 'next/link';
import { useActionState } from 'react';
import { contactSupport, type SupportState } from '@/app/account/hub-actions';

export function ContactForm({
  signedIn,
  topic,
  orderNumber,
  pageUrl,
}: {
  signedIn: boolean;
  topic: string;
  orderNumber?: string;
  pageUrl?: string;
}) {
  const [state, act, pending] = useActionState<SupportState, FormData>(contactSupport, {});
  if (state.ok) {
    return (
      <div className="card stack">
        <p className="banner banner--ok" role="status" style={{ margin: 0 }}>
          Thanks, we got your message. Your reference is <strong>{state.ok.reference}</strong>.
        </p>
        <p style={{ margin: 0 }}>
          We answer by email within one business day.
          {signedIn ? (
            <>
              {' '}
              You can also follow it in <Link href="/account/support">Your support requests</Link>.
            </>
          ) : null}
        </p>
      </div>
    );
  }
  const problem = topic === 'PROBLEM';
  return (
    <form action={act} className="card form">
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <label>
        What is it about?
        <select name="topic" defaultValue={topic}>
          {SUPPORT_TOPICS.map((t) => (
            <option key={t} value={t}>
              {SUPPORT_TOPIC_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      {!signedIn ? (
        <div className="form-row">
          <label>
            Your name
            <input name="name" autoComplete="name" maxLength={120} />
          </label>
          <label>
            Email for our answer
            <input name="email" type="email" required autoComplete="email" maxLength={254} />
          </label>
        </div>
      ) : null}
      <label>
        Order number <span className="hint">Optional, like NX-7KQ4M2.</span>
        <input
          name="orderNumber"
          defaultValue={orderNumber}
          maxLength={9}
          autoCapitalize="characters"
        />
      </label>
      <label>
        Subject
        <input
          name="subject"
          required
          minLength={3}
          maxLength={150}
          placeholder={
            problem ? 'e.g. The checkout button does nothing' : 'e.g. Package not arrived'
          }
        />
      </label>
      <label>
        {problem ? 'What happened, and what did you expect?' : 'How can we help?'}
        <textarea name="message" required minLength={10} maxLength={5000} rows={6} />
      </label>
      {problem ? (
        <label>
          Page or screen <span className="hint">Optional.</span>
          <input name="pageUrl" defaultValue={pageUrl} maxLength={500} />
        </label>
      ) : null}
      <div>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  );
}
