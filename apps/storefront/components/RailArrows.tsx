'use client';

import { useT } from './I18nProvider';

/** Previous / next buttons for a sideways product row (mouse users; touch just swipes). */
export function RailArrows({ target }: { target: string }) {
  const t = useT('product');
  const scroll = (direction: 1 | -1) => {
    const track = document.getElementById(target);
    track?.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' });
  };
  return (
    <div className="rail__arrows">
      <button
        type="button"
        className="rail__arrow"
        aria-label={t('scrollLeft')}
        onClick={() => scroll(-1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="rail__arrow"
        aria-label={t('scrollRight')}
        onClick={() => scroll(1)}
      >
        ›
      </button>
    </div>
  );
}
