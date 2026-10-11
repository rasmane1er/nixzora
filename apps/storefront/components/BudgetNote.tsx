import { budgetCheck, type BudgetView } from '@nixzora/validation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';

/**
 * Monthly budget (p10-35): in the cart and at checkout, what this order leaves of the shopper's
 * budget, or a heads-up that it goes over. Only for signed-in shoppers with a budget; never blocks.
 */
export async function BudgetNote({ orderCents }: { orderCents: number }) {
  let budget: BudgetView;
  try {
    budget = await api<BudgetView>('/me/budget');
  } catch {
    return null;
  }
  const check = budgetCheck(budget, orderCents);
  if (check.kind === 'none') return null;
  const [t, f] = await Promise.all([getT('budget'), getFormat()]);
  const cap = f.money(budget.monthlyCents!);
  return (
    <p className={`budget-note${check.kind === 'over' ? ' budget-note--over' : ''}`} role="status">
      {check.kind === 'over'
        ? t('cartOver', { amount: f.money(check.overCents), budget: cap })
        : t('cartAfter', { amount: f.money(check.leftAfterCents), budget: cap })}{' '}
      <Link href="/account/budget">{t('manage')}</Link>
    </p>
  );
}
