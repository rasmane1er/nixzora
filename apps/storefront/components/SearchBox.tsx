'use client';

import { type SearchSuggestions } from '@nixzora/validation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

type Option = { id: string; href: string; label: string; detail?: string; image?: string };
type Group = { title: string; options: Option[] };

export type SearchBoxLabels = {
  placeholder: string;
  label: string;
  submit: string;
  suggestions: string;
  didYouMean: string;
  searches: string;
  departments: string;
  brands: string;
  products: string;
  /** Search by photo (p10-14). */
  photo: string;
};

/**
 * The header search box (p10-03): suggests searches, departments, brands and products while the
 * shopper types, with "did you mean" for typos. An ARIA combobox: arrow keys move, Enter opens,
 * Escape closes. Without JavaScript it is a plain search form.
 */
export function SearchBox({
  labels,
  initial = '',
  formatPrice,
}: {
  labels: SearchBoxLabels;
  initial?: string;
  formatPrice: { locale: string; currency: string };
}) {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState(initial);
  const [data, setData] = useState<SearchSuggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const q = text.trim();
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/search/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<SearchSuggestions>) : null))
        .then((next) => {
          setData(next);
          setActive(-1);
        })
        .catch(() => undefined);
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  // Close when focus or a click goes elsewhere.
  useEffect(() => {
    const away = (event: Event) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('focusin', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('focusin', away);
    };
  }, []);

  const money = new Intl.NumberFormat(formatPrice.locale, {
    style: 'currency',
    currency: formatPrice.currency,
  });
  const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;
  // Suggestions for an emptied box are stale: show nothing.
  const current = text.trim() ? data : null;
  const groups: Group[] = current
    ? [
        {
          title: labels.searches,
          options: [
            ...(current.correction
              ? [
                  {
                    id: 'fix',
                    href: search(current.correction),
                    label: labels.didYouMean.replace('{q}', current.correction),
                  },
                ]
              : []),
            ...current.completions.map((c, i) => ({ id: `c${i}`, href: search(c), label: c })),
          ],
        },
        {
          title: labels.departments,
          options: current.categories.map((c) => ({
            id: `d-${c.slug}`,
            href: `/c/${c.slug}`,
            label: c.name,
          })),
        },
        {
          title: labels.brands,
          options: current.brands.map((b) => ({
            id: `b-${b.slug}`,
            href: `/search?brand=${encodeURIComponent(b.slug)}`,
            label: b.name,
          })),
        },
        {
          title: labels.products,
          options: current.products.map((p) => ({
            id: `p-${p.id}`,
            href: `/p/${p.slug}`,
            label: p.title,
            detail: money.format(p.priceFromCents / 100),
            image: p.image?.url,
          })),
        },
      ].filter((group) => group.options.length)
    : [];
  const flat = groups.flatMap((group) => group.options);
  const showing = open && flat.length > 0;
  const optionId = (option: Option) => `${listId}-${option.id}`;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <form
      ref={box}
      action="/search"
      className="site-search"
      role="search"
      onSubmit={(event) => {
        const chosen = flat[active];
        if (showing && chosen) {
          event.preventDefault();
          go(chosen.href);
        } else {
          setOpen(false);
        }
      }}
    >
      <input
        type="search"
        name="q"
        value={text}
        placeholder={labels.placeholder}
        aria-label={labels.label}
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showing && flat[active] ? optionId(flat[active]) : undefined}
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && flat.length) {
            event.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % flat.length);
          } else if (event.key === 'ArrowUp' && flat.length) {
            event.preventDefault();
            setActive((i) => (i <= 0 ? flat.length - 1 : i - 1));
          } else if (event.key === 'Escape') {
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      <Link
        href="/search/photo"
        className="site-search__photo"
        aria-label={labels.photo}
        title={labels.photo}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.4-2h7l1.4 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12.5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      </Link>
      <button className="btn btn--primary" type="submit">
        {labels.submit}
      </button>
      <div
        id={listId}
        role="listbox"
        aria-label={labels.suggestions}
        className="suggest"
        hidden={!showing}
      >
        {groups.map((group) => (
          <div key={group.title} role="group" aria-label={group.title} className="suggest__group">
            <div className="suggest__title" aria-hidden="true">
              {group.title}
            </div>
            {group.options.map((option) => {
              const index = flat.indexOf(option);
              return (
                <div
                  key={option.id}
                  id={optionId(option)}
                  role="option"
                  aria-selected={index === active}
                  className="suggest__option"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => go(option.href)}
                  onPointerEnter={() => setActive(index)}
                >
                  {option.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small thumbnail
                    <img src={option.image} alt="" width={40} height={30} />
                  ) : null}
                  <span className="suggest__label">{option.label}</span>
                  {option.detail ? <span className="suggest__detail">{option.detail}</span> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </form>
  );
}
