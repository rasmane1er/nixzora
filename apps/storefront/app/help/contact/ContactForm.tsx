'use client';

import { rich } from '@nixzora/i18n';
import { SUPPORT_TOPICS } from '@nixzora/validation';
import Link from 'next/link';
import { useActionState } from 'react';
import { contactSupport, type SupportState } from '@/app/account/hub-actions';
import { useT } from '@/components/I18nProvider';

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
  const t = useT('help');
  const tc = useT('common');
  const [state, act, pending] = useActionState<SupportState, FormData>(contactSupport, {});
  if (state.ok) {
    return (
      <div className="card stack">
        <p className="banner banner--ok" role="status" style={{ margin: 0 }}>
          {rich(t('sentThanks', { reference: state.ok.reference }), {
            b: (c) => <strong key="b">{c}</strong>,
          })}
        </p>
        <p style={{ margin: 0 }}>
          {t('sentAnswer')}
          {signedIn ? (
            <>
              {' '}
              {rich(t('sentFollow'), {
                support: (c) => (
                  <Link key="support" href="/account/support">
                    {c}
                  </Link>
                ),
              })}
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
        {t('topicLabel')}
        <select name="topic" defaultValue={topic}>
          {SUPPORT_TOPICS.map((topicValue) => (
            <option key={topicValue} value={topicValue}>
              {t(`topic_${topicValue}`)}
            </option>
          ))}
        </select>
      </label>
      {!signedIn ? (
        <div className="form-row">
          <label>
            {t('yourName')}
            <input name="name" autoComplete="name" maxLength={120} />
          </label>
          <label>
            {t('emailForAnswer')}
            <input name="email" type="email" required autoComplete="email" maxLength={254} />
          </label>
        </div>
      ) : null}
      <label>
        {t('orderNumber')} <span className="hint">{t('orderNumberHint')}</span>
        <input
          name="orderNumber"
          defaultValue={orderNumber}
          maxLength={9}
          autoCapitalize="characters"
        />
      </label>
      <label>
        {t('subject')}
        <input
          name="subject"
          required
          minLength={3}
          maxLength={150}
          placeholder={problem ? t('subjectPlaceholderProblem') : t('subjectPlaceholder')}
        />
      </label>
      <label>
        {problem ? t('messageProblem') : t('message')}
        <textarea name="message" required minLength={10} maxLength={5000} rows={6} />
      </label>
      {problem ? (
        <label>
          {t('pageOrScreen')} <span className="hint">{tc('optional')}</span>
          <input name="pageUrl" defaultValue={pageUrl} maxLength={500} />
        </label>
      ) : null}
      <div>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {pending ? t('sending') : t('sendMessage')}
        </button>
      </div>
    </form>
  );
}
