import { type ReturnView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { param, query, type SearchParams } from '@/lib/format';
import { ReturnList } from './ReturnList';

export const metadata: Metadata = { title: 'Returns' };

const TABS = [
  ['REQUESTED', 'To review'],
  ['APPROVED', 'Awaiting parcel'],
  ['REFUNDED', 'Refunded'],
  ['REJECTED', 'Rejected'],
] as const;

export default async function ReturnsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = param(params, 'status') ?? 'REQUESTED';
  const [me, returns] = await Promise.all([
    currentStaff(),
    load<ReturnView[]>(`/admin/returns${query({ status })}`),
  ]);
  const back = `/returns${query({ status })}`;

  return (
    <>
      <PageHeader eyebrow="Operations" title="Returns" />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <nav className="toolbar" aria-label="Return status">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/returns?status=${key}`}
            className={`btn ${key === status ? 'btn--primary' : 'btn--secondary'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {returns.length === 0 ? (
        <section className="card">
          <Empty>Nothing here.</Empty>
        </section>
      ) : (
        <ReturnList returns={returns} canDecide={can(me, 'orders.fulfill')} back={back} showOrder />
      )}
    </>
  );
}
