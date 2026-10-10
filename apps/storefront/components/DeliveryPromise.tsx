import { deliveryRange } from '@nixzora/i18n';
import { type DeliveryWindow } from '@nixzora/validation';
import { getLocale, getT } from '@/lib/i18n';

/** "Arrives Thu, Oct 15 – Tue, Oct 20" with how it is worked out (p10-04). */
export async function DeliveryPromise({
  window,
  twoDay = false,
}: {
  window: DeliveryWindow | null | undefined;
  /** NIXZORA Plus 2-day delivery (p10-15). */
  twoDay?: boolean;
}) {
  if (!window) return null;
  const [d, locale] = await Promise.all([getT('delivery'), getLocale()]);
  return (
    <p className="delivery-promise">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M2.25 6.75h11.25v9.75H2.25V6.75Zm11.25 3h4.5l3.75 3.75v3h-8.25M6.75 18.75a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        <strong>{d('arrives', { range: deliveryRange(window, locale) })}</strong>
        <span className="muted">{d(twoDay ? 'arrivesHintTwoDay' : 'arrivesHint')}</span>
      </span>
    </p>
  );
}
