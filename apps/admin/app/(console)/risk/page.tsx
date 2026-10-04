import { type MessageKey } from '@nixzora/i18n';
import { type PagedResult, type RiskAssessmentView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PagesNav } from '@/components/OpsText';
import { Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { param, query, type SearchParams } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { RiskList } from './RiskList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsRisk');
  return { title: t('metaRisk') };
}

/** Review states, plus the checkouts declined outright (nothing to review, kept for tuning). */
const TABS = ['OPEN', 'CLEARED', 'CONFIRMED', 'BLOCK'] as const;
type Tab = (typeof TABS)[number];

export default async function RiskPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = param(params, 'tab');
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'OPEN';
  const page = Math.max(1, Number(param(params, 'page')) || 1);
  const filter = tab === 'BLOCK' ? { decision: 'BLOCK' } : { status: tab };
  const [t, me, result] = await Promise.all([
    getT('opsRisk'),
    currentStaff(),
    load<PagedResult<RiskAssessmentView>>(`/admin/risk${query({ ...filter, page })}`),
  ]);
  const ops = await getT('ops');
  const back = `/risk${query({ tab, page })}`;

  return (
    <>
      <PageHeader eyebrow={t('eyebrow')} title={t('metaRisk')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted">{t('intro')}</p>
      <nav className="toolbar" aria-label={t('statusNav')}>
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/risk?tab=${key}`}
            className={`btn ${key === tab ? 'btn--primary' : 'btn--secondary'}`}
            aria-current={key === tab ? 'page' : undefined}
          >
            {t(`tab_${key}` as MessageKey<'opsRisk'>)}
          </Link>
        ))}
      </nav>
      {result.items.length === 0 ? (
        <section className="card">
          <Empty>{t('nothingHere')}</Empty>
        </section>
      ) : (
        <RiskList reviews={result.items} canReview={can(me, 'risk.review')} back={back} />
      )}
      {result.totalPages > 1 ? (
        <PagesNav>
          {page > 1 ? (
            <Link href={`/risk${query({ tab, page: page - 1 })}`}>{ops('previous')}</Link>
          ) : null}
          <span>{ops('pageOf', { page, total: result.totalPages })}</span>
          {page < result.totalPages ? (
            <Link href={`/risk${query({ tab, page: page + 1 })}`}>{ops('next')}</Link>
          ) : null}
        </PagesNav>
      ) : null}
    </>
  );
}
