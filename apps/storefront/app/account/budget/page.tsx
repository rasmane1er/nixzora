import { type BudgetView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { saveBudget } from '../hub-actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('budget');
  return { title: t('title'), robots: { index: false } };
}

/** Monthly budget (p10-35): set a private cap and see this month's spending against it. */
export default async function BudgetPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [budget, t, f] = await Promise.all([
    accountApi<BudgetView>('/me/budget', '/account/budget'),
    getT('budget'),
    getFormat(),
  ]);
  const cap = budget.monthlyCents;
  const month = f.monthYear(`${budget.month}-15T12:00:00Z`);
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 720 }}>
      <AccountHeader title={t('title')} description={t('lead')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <section className="card stack" aria-live="polite">
        {cap ? (
          <>
            <p className="budget-figure">
              {budget.leftCents >= 0
                ? t('left', { amount: f.money(budget.leftCents) })
                : t('over', { amount: f.money(-budget.leftCents) })}
            </p>
            <div
              className={`budget-bar${budget.leftCents < 0 ? ' budget-bar--over' : ''}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={cap}
              aria-valuenow={Math.min(budget.spentCents, cap)}
              aria-label={t('title')}
            >
              <span style={{ width: `${Math.min(100, (budget.spentCents / cap) * 100)}%` }} />
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {t('spentOf', {
                spent: f.money(budget.spentCents),
                budget: f.money(cap),
                month,
              })}
            </p>
          </>
        ) : (
          <p style={{ margin: 0 }}>{t('notSet')}</p>
        )}
      </section>
      <form action={saveBudget} className="card stack">
        <label>
          {t('amountLabel')}
          <span className="budget-input">
            <span aria-hidden="true">$</span>
            <input
              name="amount"
              inputMode="decimal"
              defaultValue={cap ? String(cap / 100) : ''}
              placeholder="500"
              pattern="\d{1,6}(\.\d{1,2})?"
              required
            />
          </span>
          <span className="hint">{t('amountHint')}</span>
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn--primary" type="submit" name="intent" value="save">
            {t('save')}
          </button>
          {cap ? (
            <button
              className="btn btn--secondary"
              type="submit"
              name="intent"
              value="off"
              formNoValidate
            >
              {t('turnOff')}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
