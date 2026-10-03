import { Logo } from '@nixzora/ui';
import { Nav, type NavItem } from '@/components/Nav';
import { SideMenu } from '@/components/SideMenu';
import { SubmitButton } from '@/components/SubmitButton';
import { can, currentStaff } from '@/lib/auth';
import { signOut } from '../login/actions';

// Every console page depends on the signed-in staff member, so nothing here is static.
export const dynamic = 'force-dynamic';

const NAV: (NavItem & { permission: string })[] = [
  { href: '/', label: 'Dashboard', permission: 'admin.access' },
  { href: '/orders', label: 'Orders', permission: 'orders.read.all' },
  { href: '/returns', label: 'Returns', permission: 'orders.read.all' },
  { href: '/products', label: 'Products', permission: 'catalog.write' },
  { href: '/categories', label: 'Categories & brands', permission: 'catalog.write' },
  { href: '/inventory', label: 'Inventory', permission: 'inventory.write' },
  { href: '/sellers', label: 'Sellers', permission: 'sellers.manage' },
  { href: '/listings', label: 'Listing review', permission: 'catalog.write' },
  { href: '/reviews', label: 'Reviews', permission: 'reviews.moderate' },
  { href: '/coupons', label: 'Coupons', permission: 'promotions.manage' },
  { href: '/support', label: 'Support', permission: 'support.manage' },
  { href: '/users', label: 'Customers & staff', permission: 'users.read' },
  { href: '/ai', label: 'AI operations', permission: 'admin.access' },
  { href: '/audit', label: 'Audit log', permission: 'audit.read' },
  { href: '/security', label: 'My security', permission: 'admin.access' },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const me = await currentStaff();
  const items = NAV.filter((item) => can(me, item.permission));
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';

  return (
    <div className="shell">
      <aside className="side">
        <Logo size={32} />
        <SideMenu>
          <div>
            <p className="side__label">Ops Center</p>
            <Nav items={items} />
          </div>
          <div className="side__foot">
            <span className="env">{env}</span>
            <span title={me.email}>{me.email}</span>
            <span className="muted">{me.roles.join(', ')}</span>
            <form action={signOut}>
              <SubmitButton tone="secondary">Sign out</SubmitButton>
            </form>
          </div>
        </SideMenu>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
