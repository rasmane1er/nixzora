import { type ConversationView, type MessageAuthor } from '@nixzora/validation';
import Link from 'next/link';
import { getFormat, getT } from '@/lib/i18n';

/** A conversation's messages, the reader's own on the right (p10-12). */
export async function MessageThread({
  thread,
  side,
}: {
  thread: ConversationView;
  side: 'customer' | 'seller';
}) {
  const [t, f] = await Promise.all([getT('inbox'), getFormat()]);
  const mine: MessageAuthor = side === 'customer' ? 'CUSTOMER' : 'SELLER';
  return (
    <div className="stack" style={{ gap: 12 }}>
      {thread.product || thread.orderNumber ? (
        <p className="muted" style={{ margin: 0 }}>
          {thread.product ? (
            <Link href={`/p/${thread.product.slug}`}>{thread.product.title}</Link>
          ) : null}
          {thread.product && thread.orderNumber ? ' · ' : null}
          {thread.orderNumber ? t('order', { number: thread.orderNumber }) : null}
        </p>
      ) : null}
      <ol className="message-list">
        {thread.messages.map((m) => (
          <li
            key={m.id}
            className={m.author === mine ? 'mine' : m.author === 'STAFF' ? 'staff' : ''}
          >
            <span className="message-list__who">
              {m.author === mine ? t('you') : m.author === 'STAFF' ? t('staff') : thread.with} ·{' '}
              {f.dateTime(m.at)}
            </span>
            <span className="message-list__body">{m.body}</span>
            {m.redacted ? <span className="message-list__note">{t('redacted')}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
