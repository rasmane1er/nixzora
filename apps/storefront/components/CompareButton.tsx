'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { clearCompare, compareHref, toggleCompare, useCompareList } from '@/lib/compare-store';
import { useT } from './I18nProvider';

/** "Compare" on a product page: adds it to (or takes it out of) the comparison. */
export function CompareButton({ slug }: { slug: string }) {
  const t = useT('compare');
  const list = useCompareList();
  const [full, setFull] = useState(false);
  const on = list.includes(slug);
  return (
    <span className="compare-button">
      <label className="check">
        <input type="checkbox" checked={on} onChange={() => setFull(!toggleCompare(slug))} />{' '}
        {on ? t('added') : t('add')}
      </label>
      {list.length >= 2 && on ? (
        <Link href={compareHref(list)}>{t('tray', { count: list.length })}</Link>
      ) : null}
      {full ? (
        <span className="muted" role="status">
          {t('full')}
        </span>
      ) : null}
    </span>
  );
}

/** A bar at the bottom of the screen while products are picked to compare. */
export function CompareTray() {
  const t = useT('compare');
  const list = useCompareList();
  const path = usePathname();
  if (!list.length || path === '/compare') return null;
  return (
    <div className="compare-tray" role="region" aria-label={t('title')}>
      <span>{list.length < 2 ? t('needMore') : t('tray', { count: list.length })}</span>
      {list.length >= 2 ? (
        <Link className="btn btn--primary btn--sm" href={compareHref(list)}>
          {t('title')}
        </Link>
      ) : null}
      <button className="btn btn--link" type="button" onClick={clearCompare}>
        {t('clear')}
      </button>
    </div>
  );
}
