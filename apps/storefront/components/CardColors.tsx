'use client';

import { type CardColor } from '@nixzora/validation';
import Link from 'next/link';
import { createContext, type ReactNode, useContext, useState } from 'react';

/**
 * Photos per color on cards (ADR-0051): pointing at a swatch shows that color's photo, and
 * choosing one keeps it and opens the product in that color.
 */
type State = {
  /** Shown while the pointer is on a swatch. */
  preview: CardColor | null;
  /** Chosen with a click or tap; the card's link opens the product in it. */
  chosen: CardColor | null;
  setPreview: (color: CardColor | null) => void;
  choose: (color: CardColor) => void;
};

const Ctx = createContext<State | null>(null);

export function CardColorScope({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<CardColor | null>(null);
  const [chosen, setChosen] = useState<CardColor | null>(null);
  return (
    <Ctx.Provider value={{ preview, chosen, setPreview, choose: setChosen }}>
      {children}
    </Ctx.Provider>
  );
}

/** The card's link, to the product in the chosen color. */
export function CardColorLink({
  slug,
  className,
  children,
}: {
  slug: string;
  className: string;
  children: ReactNode;
}) {
  const chosen = useContext(Ctx)?.chosen;
  return (
    <Link
      href={chosen ? `/p/${slug}?color=${encodeURIComponent(chosen.name)}` : `/p/${slug}`}
      className={className}
    >
      {children}
    </Link>
  );
}

/** The card's photo: the pointed-at or chosen color's, when it has one. */
export function CardColorPhoto({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority: boolean;
}) {
  const state = useContext(Ctx);
  const color = state?.preview ?? state?.chosen;
  const photo = color?.imageUrl ?? null;
  return (
    // Product photos come from our media host/CDN; sizes are fixed by the card.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo ?? src}
      alt={photo && color ? `${alt}, ${color.name}` : alt}
      loading={priority ? 'eager' : 'lazy'}
      width={400}
      height={300}
    />
  );
}

/** Swatches: point to preview a color's photo, click or tap to choose it. */
export function CardSwatches({
  slug,
  colors,
  label,
  colorLabels,
  more,
}: {
  slug: string;
  colors: CardColor[];
  /** "Colors: Black, Sand" */
  label: string;
  /** "See it in Black", one per shown color. */
  colorLabels: string[];
  /** "+2", linking to the product, when not every color fits. */
  more: string | null;
}) {
  const state = useContext(Ctx);
  return (
    <ul className="card-swatches" aria-label={label} onMouseLeave={() => state?.setPreview(null)}>
      {colors.map((color, i) => {
        const on = state?.chosen?.name === color.name;
        return (
          <li key={color.name}>
            <button
              type="button"
              className={`card-swatch${on ? ' card-swatch--on' : ''}`}
              title={color.name}
              aria-label={colorLabels[i]}
              aria-pressed={on}
              onMouseEnter={() => state?.setPreview(color)}
              onFocus={() => state?.setPreview(color)}
              onBlur={() => state?.setPreview(null)}
              onClick={() => state?.choose(color)}
              style={
                color.swatch
                  ? {
                      background: color.swatch2
                        ? `linear-gradient(135deg, ${color.swatch} 50%, ${color.swatch2} 50%)`
                        : color.swatch,
                    }
                  : undefined
              }
            >
              {color.swatch ? null : color.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- that color's photo
                <img src={color.imageUrl} alt="" width={24} height={24} loading="lazy" />
              ) : (
                <span aria-hidden="true">{color.name.charAt(0)}</span>
              )}
            </button>
          </li>
        );
      })}
      {more ? (
        <li>
          <Link href={`/p/${slug}`} className="card-swatch card-swatch--more">
            {more}
          </Link>
        </li>
      ) : null}
    </ul>
  );
}
