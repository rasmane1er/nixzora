const formatters = new Map<string, Intl.NumberFormat>();

/** 134900, "USD" → "$1,349.00" */
export function money(cents: number, currency = 'USD'): string {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    formatters.set(currency, formatter);
  }
  return formatter.format(cents / 100);
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Confirmed',
  FULFILLING: 'Preparing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  PARTIALLY_REFUNDED: 'Partly refunded',
  REFUNDED: 'Refunded',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Variant options as one line: "32GB · Graphite". */
export function optionsText(options: Record<string, string>): string {
  return Object.values(options).join(' · ');
}

const UNITS: Record<string, string> = {
  in: 'in',
  hz: 'Hz',
  gb: 'GB',
  tb: 'TB',
  kg: 'kg',
  g: 'g',
  w: 'W',
  mah: 'mAh',
  hours: 'hours',
  mm: 'mm',
};

/** "refresh_hz" → "Refresh (Hz)", "battery_hours" → "Battery (hours)", "cpu_cores" → "Cpu cores". */
export function attributeLabel(key: string): string {
  const parts = key.split('_');
  const unit = parts.length > 1 ? UNITS[parts.at(-1)!] : undefined;
  const words = (unit ? parts.slice(0, -1) : parts).join(' ');
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return unit ? `${label} (${unit})` : label;
}
