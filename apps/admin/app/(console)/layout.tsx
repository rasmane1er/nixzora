import { type MessageKey } from '@nixzora/i18n';
import { Logo } from '@nixzora/ui';
import { Nav, type NavItem } from '@/components/Nav';
import { LanguagePicker } from '@/components/LanguagePicker';
import { SideMenu } from '@/components/SideMenu';
import { SubmitButton } from '@/components/SubmitButton';
import { can, currentStaff } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { roleLabel } from '@/lib/roles';
import { signOut } from '../login/actions';

// Every console page depends on the signed-in staff member, so nothing here is static.
export const dynamic = 'force-dynamic';

const NAV: { href: string; label: MessageKey<'ops'>; permission: string }[] = [
  { href: '/', label: 'nav_dashboard', permission: 'admin.access' },
  { href: '/orders', label: 'nav_orders', permission: 'orders.read.all' },
  { href: '/returns', label: 'nav_returns', permission: 'orders.read.all' },
  { href: '/risk', label: 'nav_risk', permission: 'risk.review' },
  { href: '/products', label: 'nav_products', permission: 'catalog.write' },
  { href: '/categories', label: 'nav_categories', permission: 'catalog.write' },
  { href: '/size-charts', label: 'nav_sizeCharts', permission: 'catalog.write' },
  { href: '/inventory', label: 'nav_inventory', permission: 'inventory.write' },
  { href: '/sellers', label: 'nav_sellers', permission: 'sellers.manage' },
  { href: '/listings', label: 'nav_listings', permission: 'catalog.write' },
  { href: '/reviews', label: 'nav_reviews', permission: 'reviews.moderate' },
  { href: '/questions', label: 'nav_questions', permission: 'reviews.moderate' },
  { href: '/coupons', label: 'nav_coupons', permission: 'promotions.manage' },
  { href: '/deals', label: 'nav_deals', permission: 'promotions.manage' },
  { href: '/bundles', label: 'nav_bundles', permission: 'promotions.manage' },
  { href: '/multi-buys', label: 'nav_multiBuys', permission: 'promotions.manage' },
  { href: '/clip-coupons', label: 'nav_clipCoupons', permission: 'promotions.manage' },
  { href: '/gift-cards', label: 'nav_gift_cards', permission: 'orders.read.all' },
  { href: '/ads', label: 'nav_ads', permission: 'promotions.manage' },
  { href: '/support', label: 'nav_support', permission: 'support.manage' },
  { href: '/messages', label: 'nav_messages', permission: 'support.manage' },
  { href: '/plus', label: 'nav_plus', permission: 'support.manage' },
  { href: '/users', label: 'nav_users', permission: 'users.read' },
  { href: '/ai', label: 'nav_ai', permission: 'admin.access' },
  { href: '/audit', label: 'nav_audit', permission: 'audit.read' },
  { href: '/security', label: 'nav_security', permission: 'admin.access' },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [me, t] = await Promise.all([currentStaff(), getT('ops')]);
  const common = await getT('common');
  const items: NavItem[] = NAV.filter((item) => can(me, item.permission)).map((item) => ({
    href: item.href,
    label: t(item.label),
  }));
  const env = t(process.env.NODE_ENV === 'production' ? 'env_production' : 'env_development');

  return (
    <div className="shell">
      <aside className="side">
        <Logo size={32} />
        <SideMenu>
          <div>
            <p className="side__label">{t('opsCenter')}</p>
            <Nav items={items} />
          </div>
          <div className="side__foot">
            <span className="env">{env}</span>
            <span title={me.email}>{me.email}</span>
            <span className="muted">{me.roles.map((key) => roleLabel(t, key)).join(', ')}</span>
            <LanguagePicker id="ops-language" />
            <form action={signOut}>
              <SubmitButton tone="secondary">{common('signOut')}</SubmitButton>
            </form>
          </div>
        </SideMenu>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
