'use client';

import { useFormat, useT } from '@/components/I18nProvider';

/** "★★★★☆" with an accessible label. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const t = useT('productPage');
  const f = useFormat();
  const full = Math.round(value);
  return (
    <span
      className="stars"
      style={{ fontSize: size }}
      role="img"
      aria-label={t('starsLabel', { value: f.number(value) })}
    >
      {'★'.repeat(full)}
      <span className="stars--muted">{'★'.repeat(5 - full)}</span>
    </span>
  );
}
