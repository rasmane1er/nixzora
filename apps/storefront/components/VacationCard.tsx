import { calendarDay } from '@nixzora/i18n';
import { easternToday, type SellerView, VACATION_MESSAGE_MAX } from '@nixzora/validation';
import { endVacation, saveVacation } from '@/app/sell/settings/vacation-actions';
import { getLocale, getT } from '@/lib/i18n';

/** Vacation mode (p10-32) in Seller Central → Settings. */
export async function VacationCard({ seller }: { seller: SellerView }) {
  const [t, locale] = await Promise.all([getT('vacation'), getLocale()]);
  const v = seller.vacation ?? null;
  const today = easternToday();
  return (
    <section id="vacation" className={`card form vacation-card${seller.away ? ' is-away' : ''}`}>
      <h2>{t('title')}</h2>
      {seller.away ? (
        <p className="banner banner--info" role="status">
          {seller.away.until
            ? t('statusAway', { date: calendarDay(seller.away.until, locale) })
            : t('statusAwayOpen')}
        </p>
      ) : v ? (
        <p className="banner banner--info" role="status">
          {t('statusScheduled', { from: calendarDay(v.from, locale) })}
        </p>
      ) : null}
      <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
        {t('lead')}
      </p>
      <form action={saveVacation} className="stack" style={{ gap: 12 }}>
        <div className="form-row">
          <label>
            {t('from')}
            <input
              type="date"
              name="from"
              required
              min={v && v.from < today ? v.from : today}
              defaultValue={v?.from ?? today}
            />
          </label>
          <label>
            {t('until')} <span className="hint">{t('untilHint')}</span>
            <input type="date" name="until" min={today} defaultValue={v?.until ?? ''} />
          </label>
        </div>
        <label>
          {t('message')}
          <textarea
            name="message"
            rows={2}
            maxLength={VACATION_MESSAGE_MAX}
            defaultValue={v?.message ?? ''}
          />
        </label>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn--primary" type="submit">
            {v ? t('update') : t('start')}
          </button>
          {v ? (
            <button className="btn btn--secondary" type="submit" formAction={endVacation}>
              {t('end')}
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
