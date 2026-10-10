'use client';

import { type AssistantChatResponse, type AssistantMessage } from '@nixzora/validation';
import { INTL_LOCALE, type MessageKey } from '@nixzora/i18n';
import { Price } from '@nixzora/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { CardSignals } from '@/components/CardSignals';
import { useFormat, useLocale, useT } from '@/components/I18nProvider';
import { addToCart } from '../cart/actions';
import { askAssistant } from './actions';

type Turn =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; response: AssistantChatResponse };

/** A department in the visitor's language when it is one NIXZORA knows, else as given. */
function useDepartmentName() {
  const d = useT('departments');
  return (slug: string | null, name: string | null) => {
    if (!slug) return name;
    const known = d(slug as MessageKey<'departments'>);
    return known === slug ? name : known;
  };
}

function Understood({ need }: { need: AssistantChatResponse['need'] }) {
  const t = useT('assistant');
  const f = useFormat();
  const departmentName = useDepartmentName();
  /** "$1,500" rather than "$1,500.00" for round budgets. */
  const usd = (cents: number) => f.money(cents, 'USD').replace(/[.,]00(?=\D*$)/, '');
  const chips = [
    departmentName(need.category, need.categoryName),
    need.minPriceCents !== null && need.maxPriceCents !== null
      ? `${usd(need.minPriceCents)} – ${usd(need.maxPriceCents)}`
      : need.maxPriceCents !== null
        ? t('upTo', { price: usd(need.maxPriceCents) })
        : need.minPriceCents !== null
          ? t('fromPrice', { price: usd(need.minPriceCents) })
          : null,
    ...need.mustHave,
  ].filter(Boolean) as string[];
  if (!chips.length) return null;
  return (
    <div className="understood" aria-label={t('understoodLabel')}>
      <span className="understood__label">{t('understood')}</span>
      {chips.map((chip) => (
        <span key={chip} className="understood__chip">
          {chip}
        </span>
      ))}
    </div>
  );
}

function AddButton({ variantId, title }: { variantId: string | null; title: string }) {
  const t = useT('assistant');
  const [state, setState] = useState<'idle' | 'added' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  if (!variantId) return null;
  return (
    <div className="pick__buy">
      <button
        type="button"
        className="btn btn--primary btn--sm"
        disabled={pending}
        aria-label={state === 'added' ? t('addedTitle', { title }) : t('addTitle', { title })}
        onClick={() =>
          startTransition(async () => {
            const result = await addToCart(variantId, 1);
            setState(result.ok ? 'added' : 'error');
            setMessage(result.ok ? t('added') : result.error);
          })
        }
      >
        {pending ? t('adding') : state === 'added' ? t('addedCheck') : t('addToCart')}
      </button>
      {state === 'error' ? (
        <span className="field-error" role="alert">
          {message}
        </span>
      ) : null}
    </div>
  );
}

function Answer({
  response,
  onAsk,
}: {
  response: AssistantChatResponse;
  onAsk: (text: string) => void;
}) {
  const t = useT('assistant');
  const p = useT('product');
  const locale = useLocale();
  const departmentName = useDepartmentName();
  return (
    <div className="answer">
      <Understood need={response.need} />
      <p className="answer__reply">{response.reply}</p>
      {response.picks.length ? (
        <div className="picks">
          {response.picks.map((pick) => (
            <article key={pick.product.id} className="pick" aria-label={pick.product.title}>
              {pick.badge ? <span className="pick__badge">{pick.badge}</span> : null}
              <Link
                href={`/p/${pick.product.slug}`}
                className="pick__img"
                tabIndex={-1}
                aria-hidden="true"
              >
                {pick.product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pick.product.image.url}
                    alt=""
                    width={320}
                    height={240}
                    loading="lazy"
                  />
                ) : (
                  <span>
                    {departmentName(pick.product.category.slug, pick.product.category.name)}
                  </span>
                )}
              </Link>
              <div className="pick__body">
                <span className="product-card__brand">{pick.product.brand?.name ?? ' '}</span>
                <Link href={`/p/${pick.product.slug}`} className="pick__title">
                  {pick.product.title}
                </Link>
                <Price
                  cents={pick.product.priceFromCents}
                  compareAtCents={pick.product.compareAtCents}
                  currency={pick.product.currency}
                  prefix={p('from')}
                  locale={INTL_LOCALE[locale]}
                  wasLabel={p('was')}
                />
                <CardSignals product={pick.product} />
                <p className="pick__reason">{pick.reason}</p>
                {pick.matched.length ? (
                  <ul className="pick__matched" aria-label={t('matches')}>
                    {pick.matched.map((m) => (
                      <li key={m}>✓ {m}</li>
                    ))}
                  </ul>
                ) : null}
                <span className={`stock${pick.product.inStock ? '' : ' stock--out'}`}>
                  {pick.product.inStock ? p('inStock') : p('soldOut')}
                </span>
                {pick.product.inStock ? (
                  <AddButton variantId={pick.variantId} title={pick.product.title} />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {response.comparison && response.picks.length > 1 ? (
        <div className="compare">
          <div className="table-scroll">
            <table className="plain">
              <caption className="sr-only">{t('comparisonCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('compare')}</th>
                  {response.picks.map((pick) => (
                    <th key={pick.product.id} scope="col">
                      {pick.product.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {response.comparison.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.values.map((value, i) => (
                      <td key={i}>{value ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {response.suggestions.length ? (
        <div className="suggestions" aria-label={t('followUps')}>
          {response.suggestions.map((s) => (
            <button key={s} type="button" className="suggestion" onClick={() => onAsk(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <p className="answer__note">
        {response.model === 'local' ? t('noteLocal') : t('noteModel', { model: response.model })}
      </p>
    </div>
  );
}

/** Conversation with the shopping assistant. Each answer is grounded in the live catalog. */
export function AssistantChat({
  initialQuery,
  examples,
}: {
  initialQuery: string;
  examples: string[];
}) {
  const t = useT('assistant');
  const c = useT('common');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  function ask(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    setError(null);
    const next: Turn[] = [...turns, { role: 'user', content }];
    setTurns(next);
    setDraft('');
    startTransition(async () => {
      const messages: AssistantMessage[] = next.map((t) => ({ role: t.role, content: t.content }));
      const result = await askAssistant(messages);
      if (result.ok) {
        setTurns((current) => [
          ...current,
          { role: 'assistant', content: result.response.reply, response: result.response },
        ]);
      } else setError(result.error);
    });
  }

  useEffect(() => {
    if (initialQuery && !started.current) {
      started.current = true;
      ask(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, pending]);

  return (
    <div className="assistant">
      <div className="assistant__log" aria-live="polite">
        {!turns.length && !pending ? (
          <div className="assistant__empty">
            <p className="muted">{t('tryThese')}</p>
            <div className="suggestions">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="suggestion"
                  onClick={() => ask(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {turns.map((turn, i) =>
          turn.role === 'user' ? (
            <p key={i} className="bubble bubble--user">
              {turn.content}
            </p>
          ) : (
            <Answer key={i} response={turn.response} onAsk={ask} />
          ),
        )}
        {pending ? (
          <p className="bubble bubble--thinking" role="status">
            {t('searching')}
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
        <label className="sr-only" htmlFor="assistant-input">
          {t('messageLabel')}
        </label>
        <input
          id="assistant-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={turns.length ? t('followUpPlaceholder') : t('describePlaceholder')}
          maxLength={1000}
          autoComplete="off"
        />
        <button className="btn btn--primary" type="submit" disabled={pending || !draft.trim()}>
          {c('send')}
        </button>
      </form>
    </div>
  );
}
