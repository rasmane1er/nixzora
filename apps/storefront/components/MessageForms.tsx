'use client';

import { useActionState, useRef } from 'react';
import { type MessageState, reply, startConversation } from '../app/account/messages/actions';
import { useT } from './I18nProvider';

/** The reply box under a thread (customer or store side). */
export function ReplyForm({ id, side }: { id: string; side: 'customer' | 'seller' }) {
  const t = useT('inbox');
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<MessageState, FormData>(async (prev, form) => {
    const result = await reply(prev, form);
    if (result.ok) ref.current?.reset();
    return result;
  }, {});
  return (
    <form action={action} ref={ref} className="message-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="side" value={side} />
      <textarea
        name="body"
        required
        maxLength={2000}
        rows={3}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
      />
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {pending ? t('sending') : t('send')}
        </button>
      </div>
    </form>
  );
}

/** "Ask the store": the first message to a store about a product or an order. */
export function AskStoreForm({
  store,
  storeName,
  productId,
  orderNumber,
}: {
  store: string;
  storeName: string;
  productId?: string;
  orderNumber?: string;
}) {
  const t = useT('inbox');
  const [state, action, pending] = useActionState<MessageState, FormData>(startConversation, {});
  return (
    <form action={action} className="message-form">
      <input type="hidden" name="store" value={store} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      {orderNumber ? <input type="hidden" name="orderNumber" value={orderNumber} /> : null}
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {t('askStoreHint', { store: storeName })}
      </p>
      <textarea
        name="body"
        required
        maxLength={2000}
        rows={4}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
      />
      {state.error ? (
        <p className="banner banner--error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {pending ? t('sending') : t('send')}
        </button>
      </div>
    </form>
  );
}
