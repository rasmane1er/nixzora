'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from './I18nProvider';

export type NavItem = { href: string; label: string };

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const t = useT('ops');
  return (
    <nav aria-label={t('opsCenter')}>
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
