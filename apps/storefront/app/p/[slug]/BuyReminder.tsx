'use client';

import { calendarDay } from '@nixzora/i18n';
import {
  addDays,
  BUY_REMINDER_MAX_DAYS,
  buyReminderChoices,
  easternToday,
} from '@nixzora/validation';
import { useState, useTransition } from 'react';
import { useLocale, useT } from '@/components/I18nProvider';
import { setBuyReminder } from './actions';

/** "Remind me to buy" (p10-36): pick a day; that morning we send today's price. */
export function BuyReminder({
  productId,
  slug,
  signedIn,
  initial,
}: {
  productId: string;
  slug: string;
  signedIn: boolean;
  initial: string | null;
}) {
  const t = useT('buyReminders');
  const locale = useLocale();
  const [date, setDate] = useState<string | null>(initial);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = easternToday();

  if (!signedIn) {
    return (
      <a
        className="btn btn--link buy-reminder__toggle"
        href={`/account/login?next=${encodeURIComponent(`/p/${slug}`)}`}
      >
        {t('signIn')}
      </a>
    );
  }

  const save = (next: string | null) =>
    start(async () => {
      const result = await setBuyReminder(productId, next);
      if (!result.ok) return setError(result.error);
      setError(null);
      setDate(next);
      setOpen(false);
    });

  return (
    <div className="buy-reminder">
      {date && !open ? (
        <p className="buy-reminder__status" role="status">
          <span aria-hidden="true">🔔 </span>
          {t('isSet', { date: calendarDay(date, locale) })}{' '}
          <button type="button" className="btn btn--link" onClick={() => setOpen(true)}>
            {t('change')}
          </button>
          {' · '}
          <button
            type="button"
            className="btn btn--link"
            disabled={pending}
            onClick={() => save(null)}
          >
            {t('cancel')}
          </button>
        </p>
      ) : !open ? (
        <button
          type="button"
          className="btn btn--link buy-reminder__toggle"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          {t('button')}
        </button>
      ) : (
        <fieldset className="buy-reminder__panel" disabled={pending}>
          <legend>{t('pick')}</legend>
          <div className="buy-reminder__chips">
            {buyReminderChoices().map((choice) => (
              <button
                key={choice.key}
                type="button"
                className="chip"
                aria-pressed={date === choice.date}
                onClick={() => save(choice.date)}
              >
                <strong>{t(choice.key)}</strong> · {calendarDay(choice.date, locale)}
              </button>
            ))}
          </div>
          <form
            className="buy-reminder__date"
            onSubmit={(event) => {
              event.preventDefault();
              if (custom) save(custom);
            }}
          >
            <label>
              <span className="sr-only">{t('pickDate')}</span>
              <input
                type="date"
                value={custom}
                min={addDays(today, 1)}
                max={addDays(today, BUY_REMINDER_MAX_DAYS)}
                onChange={(event) => setCustom(event.target.value)}
                aria-label={t('pickDate')}
              />
            </label>
            <button type="submit" className="btn btn--secondary btn--sm" disabled={!custom}>
              {t('set')}
            </button>
          </form>
          <span className="hint">{t('hint')}</span>
        </fieldset>
      )}
      {error ? (
        <span className="hint" role="alert" style={{ color: 'var(--err-fg)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
