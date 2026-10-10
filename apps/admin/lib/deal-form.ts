import { DEAL_KINDS, type DealCreate } from '@nixzora/validation';

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** A datetime-local value ("2026-10-12T09:00") in the browser's zone → ISO, or null. */
export function localToIso(value: unknown, tzOffsetMinutes: number): string | null {
  const m = typeof value === 'string' ? LOCAL.exec(value) : null;
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, h, mi) + tzOffsetMinutes * 60_000).toISOString();
}

/** The deal form's fields as the API expects them (the API validates the rest). */
export function dealFromForm(form: FormData): Partial<DealCreate> & { problem?: 'times' } {
  const offset = Number(form.get('tzOffset'));
  const tz = Number.isFinite(offset) && Math.abs(offset) <= 14 * 60 ? offset : 0;
  const startsAt = localToIso(form.get('startsAt'), tz);
  const endsAt = localToIso(form.get('endsAt'), tz);
  const kind = (DEAL_KINDS as readonly string[]).includes(String(form.get('kind')))
    ? (String(form.get('kind')) as DealCreate['kind'])
    : 'DAY';
  const quantity = String(form.get('quantity') ?? '').trim();
  return {
    productId: String(form.get('productId') ?? ''),
    kind,
    percentOff: Number(form.get('percentOff')),
    ...(startsAt && endsAt ? { startsAt, endsAt } : { problem: 'times' as const }),
    quantity: quantity ? Number(quantity) : null,
  };
}
