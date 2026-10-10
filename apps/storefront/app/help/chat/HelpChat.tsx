'use client';

import { deliveryRange } from '@nixzora/i18n';
import {
  type HelpAction,
  type HelpButton,
  type HelpConversation,
  type HelpOrderCard,
} from '@nixzora/validation';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormat, useLocale, useT } from '@/components/I18nProvider';
import { type HelpResult, helpAction, sendHelpMessage, startHelpOver } from './actions';

function OrderCard({ order }: { order: HelpOrderCard }) {
  const t = useT('helpAgent');
  const o = useT('order');
  const f = useFormat();
  const locale = useLocale();
  return (
    <Link href={`/orders/${order.number}`} className="help-order">
      <span className="help-order__head">
        <strong>{order.number}</strong>
        <span className="help-order__status">{o(`status_${order.status}`)}</span>
      </span>
      <span className="help-order__items">
        {order.items.join(', ')}
        {order.itemCount > order.items.length ? ` · ${t('items', { count: order.itemCount })}` : ''}
      </span>
      <span className="muted">
        {f.money(order.totalCents, order.currency)}
        {order.placedAt ? ` · ${t('placed', { date: f.date(order.placedAt) })}` : ''}
      </span>
      {order.estimatedDelivery ? (
        <span className="help-order__eta">
          {t('arrives', { window: deliveryRange(order.estimatedDelivery, locale) })}
        </span>
      ) : null}
    </Link>
  );
}

function ButtonRow({
  buttons,
  pending,
  onAction,
}: {
  buttons: HelpButton[];
  pending: boolean;
  onAction: (action: HelpAction) => void;
}) {
  const t = useT('helpAgent');
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!buttons.length) return null;
  return (
    <div className="help-buttons">
      {buttons.map((button) => {
        const key = `${button.kind}-${'orderNumber' in button ? button.orderNumber : ''}`;
        switch (button.kind) {
          case 'order':
            return (
              <Link
                key={key}
                className="btn btn--secondary btn--sm"
                href={`/orders/${button.orderNumber}`}
              >
                {t('btn_order')}
              </Link>
            );
          case 'return':
            return (
              <Link
                key={key}
                className="btn btn--primary btn--sm"
                href={`/orders/${button.orderNumber}#return`}
              >
                {t('btn_return')}
              </Link>
            );
          case 'track':
            return button.url ? (
              <a
                key={key}
                className="btn btn--primary btn--sm"
                href={button.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('btn_track')}
              </a>
            ) : null;
          case 'orders':
            return (
              <Link key={key} className="btn btn--secondary btn--sm" href="/account/orders">
                {t('btn_orders')}
              </Link>
            );
          case 'contact':
            return (
              <Link key={key} className="btn btn--secondary btn--sm" href="/help/contact">
                {t('btn_contact')}
              </Link>
            );
          case 'handoff':
            return (
              <button
                key={key}
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={pending}
                onClick={() => onAction({ kind: 'handoff' })}
              >
                {t('btn_handoff')}
              </button>
            );
          case 'choose':
            return (
              <button
                key={key}
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={pending}
                onClick={() =>
                  onAction({
                    kind: 'choose',
                    intent: button.intent,
                    orderNumber: button.orderNumber,
                  })
                }
              >
                {button.orderNumber}
              </button>
            );
          case 'cancel':
            return confirming === button.orderNumber ? (
              <div key={key} className="help-confirm" role="group">
                <span>{t('confirmCancel', { number: button.orderNumber })}</span>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  disabled={pending}
                  onClick={() => {
                    setConfirming(null);
                    onAction({ kind: 'cancel', orderNumber: button.orderNumber });
                  }}
                >
                  {t('confirmYes')}
                </button>
                <button
                  type="button"
                  className="btn btn--link btn--sm"
                  onClick={() => setConfirming(null)}
                >
                  {t('confirmNo')}
                </button>
              </div>
            ) : (
              <button
                key={key}
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={pending}
                onClick={() => setConfirming(button.orderNumber)}
              >
                {t('btn_cancel')}
              </button>
            );
        }
      })}
    </div>
  );
}

/**
 * The help chat (p10-20). Every answer comes from the API, which reads the shopper's orders;
 * cancelling and handing off only happen from the buttons.
 */
export function HelpChat({ initial, prefill }: { initial: HelpConversation; prefill: string }) {
  const t = useT('helpAgent');
  const [chat, setChat] = useState(initial);
  const [draft, setDraft] = useState(prefill);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  const apply = (call: () => Promise<HelpResult>) =>
    startTransition(async () => {
      const result = await call();
      setSent(null);
      if (result.ok) {
        setChat(result.conversation);
        setError(null);
      } else setError(result.error);
    });

  const ask = (text: string) => {
    const content = text.trim();
    if (!content || pending) return;
    setDraft('');
    setSent(content);
    apply(() => sendHelpMessage(content));
  };

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.turns.length, pending]);

  const suggestions = [t('s_track'), t('s_cancel'), t('s_return'), t('s_refund'), t('s_human')];
  return (
    <div className="assistant help-chat">
      <div className="help-chat__bar">
        {chat.status === 'HANDED_OFF' && chat.supportReference ? (
          <span className="help-chat__handed" role="status">
            {t('handedOff', { reference: chat.supportReference })}
          </span>
        ) : (
          <span />
        )}
        {chat.id ? (
          <button
            type="button"
            className="btn btn--link btn--sm"
            disabled={pending}
            onClick={() => apply(startHelpOver)}
          >
            {t('startOver')}
          </button>
        ) : null}
      </div>
      <div className="assistant__log" aria-live="polite">
        {chat.turns.map((turn) =>
          turn.role === 'USER' ? (
            <p key={turn.id} className="bubble bubble--user">
              <span className="sr-only">{t('you')}: </span>
              {turn.text}
            </p>
          ) : (
            <div key={turn.id} className="help-turn">
              <p className="bubble help-turn__bubble">
                <span className="help-turn__who">{t('agent')}</span>
                {turn.text}
              </p>
              {turn.orders.length ? (
                <div className="help-orders">
                  {turn.orders.map((order) => (
                    <OrderCard key={order.number} order={order} />
                  ))}
                </div>
              ) : null}
              <ButtonRow
                buttons={turn.buttons}
                pending={pending}
                onAction={(action) => apply(() => helpAction(action))}
              />
            </div>
          ),
        )}
        {chat.turns.length === 1 && !sent ? (
          <div className="suggestions">
            {suggestions.map((s) => (
              <button key={s} type="button" className="suggestion" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {sent ? <p className="bubble bubble--user">{sent}</p> : null}
        {pending ? (
          <p className="bubble bubble--thinking" role="status">
            {t('sending')}
          </p>
        ) : null}
        {error ? (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        ) : null}
        <div ref={end} />
      </div>
      <form
        className="assistant__form"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <label className="sr-only" htmlFor="help-input">
          {t('placeholder')}
        </label>
        <input
          id="help-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('placeholder')}
          maxLength={1000}
          autoComplete="off"
        />
        <button className="btn btn--primary" type="submit" disabled={pending || !draft.trim()}>
          {t('send')}
        </button>
      </form>
    </div>
  );
}
