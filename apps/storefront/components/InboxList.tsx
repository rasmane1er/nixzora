import { type ConversationSummary } from '@nixzora/validation';
import Link from 'next/link';
import { getFormat, getT } from '@/lib/i18n';

/** Conversations, newest first; unread ones in bold. */
export async function InboxList({
  items,
  hrefBase,
}: {
  items: ConversationSummary[];
  hrefBase: string;
}) {
  const [t, f] = await Promise.all([getT('inbox'), getFormat()]);
  return (
    <ul className="inbox">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`${hrefBase}/${c.id}`}>
            {c.product?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- small thumbnail
              <img src={c.product.imageUrl} alt="" width={48} height={48} />
            ) : null}
            <span className="inbox__text">
              <span className={c.unread ? 'inbox__unread' : undefined}>
                {c.with} · {c.subject}
              </span>
              <span className="muted">{c.lastMessage?.body}</span>
            </span>
            <span className="muted" style={{ fontSize: 13, textAlign: 'right' }}>
              {c.lastMessage ? f.date(c.lastMessage.at) : null}
              {c.unread ? (
                <>
                  <br />
                  <span className="pill">{t('unread')}</span>
                </>
              ) : c.closed ? (
                <>
                  <br />
                  {t('closed')}
                </>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
