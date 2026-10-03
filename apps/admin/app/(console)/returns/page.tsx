import { type ReturnView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { param, query, type SearchParams } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { ReturnList } from './ReturnList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsOrders');
  return { title: t('metaReturns') };
}

const TABS = ['REQUESTED', 'APPROVED', 'REFUNDED', 'REJECTED'] as const;

export default async function ReturnsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = param(params, 'status') ?? 'REQUESTED';
  const [t, me, returns] = await Promise.all([
    getT('opsOrders'),
    currentStaff(),
    load<ReturnView[]>(`/admin/returns${query({ status })}`),
  ]);
  const back = `/returns${query({ status })}`;

  return (
    <>
      <PageHeader eyebrow={t('eyebrowOperations')} title={t('metaReturns')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <nav className="toolbar" aria-label={t('returnStatusNav')}>
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/returns?status=${key}`}
            className={`btn ${key === status ? 'btn--primary' : 'btn--secondary'}`}
          >
            {t(`returnTab_${key}`)}
          </Link>
        ))}
      </nav>
      {returns.length === 0 ? (
        <section className="card">
          <Empty>{t('nothingHere')}</Empty>
        </section>
      ) : (
        <ReturnList returns={returns} canDecide={can(me, 'orders.fulfill')} back={back} showOrder />
      )}
    </>
  );
}
