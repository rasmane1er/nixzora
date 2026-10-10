import type { MessageKey } from './index';
import type { Vars } from './translate';

/**
 * The heading of a smart-picks row (p10-02), shared by the website and the app:
 * "Because you searched for “trail shoes”", "Goes with your cart"…
 */
export function smartRowTitle(
  row: { kind: string; source: string | null; subject: string | null },
  t: (key: MessageKey<'ads'>, vars?: Vars) => string,
): string {
  const vars = { subject: row.subject ?? '' };
  if (row.kind === 'interest') {
    return t(row.source === 'assistant' ? 'row_interest_assistant' : 'row_interest_search', vars);
  }
  return t(`row_${row.kind}` as MessageKey<'ads'>, vars);
}
