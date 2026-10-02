import { statusLabel } from '@/lib/format';
import { Pill } from './ui';

const TONES: Record<string, 'neutral' | 'ok' | 'warn' | 'error'> = {
  PENDING_PAYMENT: 'warn',
  PAID: 'neutral',
  FULFILLING: 'neutral',
  SHIPPED: 'ok',
  DELIVERED: 'ok',
  CANCELLED: 'error',
  PARTIALLY_REFUNDED: 'warn',
  REFUNDED: 'neutral',
};

export function OrderStatusPill({ status }: { status: string }) {
  return <Pill label={statusLabel(status)} tone={TONES[status] ?? 'neutral'} />;
}
