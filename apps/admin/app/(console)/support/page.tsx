import { type MessageKey } from '@nixzora/i18n';
import { type SupportRequestView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, query, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { replySupport } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return { title: t('nav_support') };
}

const TABS = ['OPEN', 'ANSWERED', 'CLOSED'] as const;

export default async function SupportPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = param(params, 'status') ?? 'OPEN';
  const requests = await load<SupportRequestView[]>(`/admin/support${query({ status })}`);
  const back = `/support${query({ status })}`;
  const [t, ops, help, common, f] = await Promise.all([
    getT('opsPeople'),
    getT('ops'),
    getT('help'),
    getT('common'),
    getFormat(),
  ]);

  return (
    <>
      <PageHeader eyebrow={t('customers')} title={ops('nav_support')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <nav className="toolbar" aria-label={t('supportStatus')}>
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/support?status=${key}`}
            className={`btn ${key === status ? 'btn--primary' : 'btn--secondary'}`}
          >
            {t(`tab_${key}`)}
          </Link>
        ))}
      </nav>
      {requests.length === 0 ? (
        <Empty>{t('nothingHere')}</Empty>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {requests.map((r) => (
            <section key={r.id} className="card">
              <h2 style={{ marginBottom: 4 }}>{r.subject}</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                <span className="mono">{r.reference}</span> ·{' '}
                {help(`topic_${r.topic}` as MessageKey<'help'>)} · {r.name ? `${r.name} · ` : ''}
                <a href={`mailto:${r.email}`}>{r.email}</a>
                {r.orderNumber ? (
                  <>
                    {' '}
                    · <Link href={`/orders?q=${r.orderNumber}`}>{r.orderNumber}</Link>
                  </>
                ) : null}{' '}
                · {f.dateTime(r.createdAt)}
              </p>
              <p style={{ whiteSpace: 'pre-line' }}>{r.message}</p>
              {r.pageUrl ? <p className="muted">{t('pageUrl', { url: r.pageUrl })}</p> : null}
              {r.staffReply ? (
                <p className="banner banner--ok" style={{ whiteSpace: 'pre-line' }}>
                  {r.answeredAt
                    ? t('ourReplyAt', { date: f.dateTime(r.answeredAt), reply: r.staffReply })
                    : t('ourReply', { reply: r.staffReply })}
                </p>
              ) : null}
              <form action={replySupport} className="form">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="back" value={back} />
                <label>
                  {t('reply')} <span className="hint">{t('replyHint')}</span>
                  <textarea name="reply" rows={4} maxLength={5000} />
                </label>
                <div className="form-row">
                  <label>
                    {t('thenMarkAs')}
                    <select name="status" defaultValue="ANSWERED">
                      <option value="ANSWERED">{t('mark_ANSWERED')}</option>
                      <option value="OPEN">{t('mark_OPEN')}</option>
                      <option value="CLOSED">{t('mark_CLOSED')}</option>
                    </select>
                  </label>
                </div>
                <div>
                  <SubmitButton>{common('save')}</SubmitButton>
                </div>
              </form>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
