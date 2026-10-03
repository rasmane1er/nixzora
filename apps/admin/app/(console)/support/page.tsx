import { SUPPORT_TOPIC_LABEL, type SupportRequestView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, param, query, type SearchParams } from '@/lib/format';
import { replySupport } from './actions';

export const metadata: Metadata = { title: 'Support' };

const TABS = [
  ['OPEN', 'Waiting for us'],
  ['ANSWERED', 'Answered'],
  ['CLOSED', 'Closed'],
] as const;

export default async function SupportPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = param(params, 'status') ?? 'OPEN';
  const requests = await load<SupportRequestView[]>(`/admin/support${query({ status })}`);
  const back = `/support${query({ status })}`;

  return (
    <>
      <PageHeader eyebrow="Customers" title="Support" />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <nav className="toolbar" aria-label="Support status">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/support?status=${key}`}
            className={`btn ${key === status ? 'btn--primary' : 'btn--secondary'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {requests.length === 0 ? (
        <Empty>Nothing here.</Empty>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {requests.map((r) => (
            <section key={r.id} className="card">
              <h2 style={{ marginBottom: 4 }}>{r.subject}</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                <span className="mono">{r.reference}</span> · {SUPPORT_TOPIC_LABEL[r.topic]} ·{' '}
                {r.name ? `${r.name} · ` : ''}
                <a href={`mailto:${r.email}`}>{r.email}</a>
                {r.orderNumber ? (
                  <>
                    {' '}
                    · <Link href={`/orders?q=${r.orderNumber}`}>{r.orderNumber}</Link>
                  </>
                ) : null}{' '}
                · {dateTime(r.createdAt)}
              </p>
              <p style={{ whiteSpace: 'pre-line' }}>{r.message}</p>
              {r.pageUrl ? <p className="muted">Page: {r.pageUrl}</p> : null}
              {r.staffReply ? (
                <p className="banner banner--ok" style={{ whiteSpace: 'pre-line' }}>
                  Our reply{r.answeredAt ? ` (${dateTime(r.answeredAt)})` : ''}: {r.staffReply}
                </p>
              ) : null}
              <form action={replySupport} className="form">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="back" value={back} />
                <label>
                  Reply <span className="hint">Emailed to the customer.</span>
                  <textarea name="reply" rows={4} maxLength={5000} />
                </label>
                <div className="form-row">
                  <label>
                    Then mark as
                    <select name="status" defaultValue="ANSWERED">
                      <option value="ANSWERED">Answered</option>
                      <option value="OPEN">Still open</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </label>
                </div>
                <div>
                  <SubmitButton>Save</SubmitButton>
                </div>
              </form>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
