import { type AdminConversationView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { moderateConversation } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('inbox');
  return { title: t('opsTitle') };
}

/** Reported customer ↔ store conversations (p10-12). */
export default async function MessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [threads, t, people, f] = await Promise.all([
    load<AdminConversationView[]>('/admin/messages?reported=1'),
    getT('inbox'),
    getT('opsPeople'),
    getFormat(),
  ]);
  return (
    <>
      <PageHeader eyebrow={people('customers')} title={t('opsTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ maxWidth: '75ch' }}>
        {t('opsLead')}
      </p>
      {threads.length === 0 ? (
        <section className="card">
          <Empty>{t('opsNone')}</Empty>
        </section>
      ) : (
        threads.map((thread) => (
          <section key={thread.id} className="card stack">
            <div>
              <strong>{thread.subject}</strong>
              <div className="muted">
                {t('colWith')}: {thread.with} ({thread.customerEmail}) · {t('colStore')}:{' '}
                {thread.sellerName}
                {thread.hidden ? ` · ${t('hidden')}` : ''}
              </div>
              <div>
                {t('colReason')}: {thread.reportReason}
              </div>
            </div>
            <ol className="activity">
              {thread.messages.map((m) => (
                <li key={m.id} style={{ display: 'block' }}>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {m.author === 'CUSTOMER' ? thread.with : thread.sellerName} · {f.dateTime(m.at)}
                  </div>
                  <div style={{ whiteSpace: 'pre-line' }}>{m.body}</div>
                </li>
              ))}
            </ol>
            <div className="inline-form">
              {thread.hidden ? (
                <ActionButton
                  action={moderateConversation}
                  label={t('restore')}
                  fields={{ id: thread.id, action: 'restore' }}
                />
              ) : (
                <ActionButton
                  action={moderateConversation}
                  label={t('hide')}
                  tone="danger"
                  fields={{ id: thread.id, action: 'hide' }}
                />
              )}
              <ActionButton
                action={moderateConversation}
                label={t('dismiss')}
                fields={{ id: thread.id, action: 'dismiss' }}
              />
            </div>
          </section>
        ))
      )}
    </>
  );
}
