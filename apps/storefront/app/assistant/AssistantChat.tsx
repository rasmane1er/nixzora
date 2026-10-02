'use client';

import { type AssistantChatResponse, type AssistantMessage } from '@nixzora/validation';
import { Price, formatMoney } from '@nixzora/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { addToCart } from '../cart/actions';
import { askAssistant } from './actions';

type Turn =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; response: AssistantChatResponse };

/** "$1,500" rather than "$1,500.00" for round budgets. */
const usd = (cents: number) => formatMoney(cents, 'USD').replace(/\.00$/, '');

function Understood({ need }: { need: AssistantChatResponse['need'] }) {
  const chips = [
    need.categoryName,
    need.minPriceCents !== null && need.maxPriceCents !== null
      ? `${usd(need.minPriceCents)} – ${usd(need.maxPriceCents)}`
      : need.maxPriceCents !== null
        ? `Up to ${usd(need.maxPriceCents)}`
        : need.minPriceCents !== null
          ? `From ${usd(need.minPriceCents)}`
          : null,
    ...need.mustHave,
  ].filter(Boolean) as string[];
  if (!chips.length) return null;
  return (
    <div className="understood" aria-label="What the assistant understood">
      <span className="understood__label">Understood</span>
      {chips.map((chip) => (
        <span key={chip} className="understood__chip">
          {chip}
        </span>
      ))}
    </div>
  );
}

function AddButton({ variantId, title }: { variantId: string | null; title: string }) {
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
        aria-label={state === 'added' ? `Added ${title} to cart` : `Add ${title} to cart`}
        onClick={() =>
          startTransition(async () => {
            const result = await addToCart(variantId, 1);
            setState(result.ok ? 'added' : 'error');
            setMessage(result.ok ? 'Added' : result.error);
          })
        }
      >
        {pending ? 'Adding…' : state === 'added' ? 'Added ✓' : 'Add to cart'}
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
                  <span>{pick.product.category.name}</span>
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
                  prefix="From"
                />
                <p className="pick__reason">{pick.reason}</p>
                {pick.matched.length ? (
                  <ul className="pick__matched" aria-label="Matches your request">
                    {pick.matched.map((m) => (
                      <li key={m}>✓ {m}</li>
                    ))}
                  </ul>
                ) : null}
                <span className={`stock${pick.product.inStock ? '' : ' stock--out'}`}>
                  {pick.product.inStock ? 'In stock' : 'Sold out'}
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
          <table className="plain">
            <caption className="sr-only">Comparison of the picks</caption>
            <thead>
              <tr>
                <th scope="col">Compare</th>
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
      ) : null}
      {response.suggestions.length ? (
        <div className="suggestions" aria-label="Follow-up ideas">
          {response.suggestions.map((s) => (
            <button key={s} type="button" className="suggestion" onClick={() => onAsk(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <p className="answer__note">
        Products, prices and stock come from the live catalog
        {response.model === 'local' ? '' : ` · written by ${response.model}`}.
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
            <p className="muted">Try one of these:</p>
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
            Searching the catalog…
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
          Message the assistant
        </label>
        <input
          id="assistant-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            turns.length ? 'Ask a follow-up, e.g. “something lighter”' : 'Describe what you need'
          }
          maxLength={1000}
          autoComplete="off"
        />
        <button className="btn btn--primary" type="submit" disabled={pending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
