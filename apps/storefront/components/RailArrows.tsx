'use client';

/** Previous / next buttons for a sideways product row (mouse users; touch just swipes). */
export function RailArrows({ target }: { target: string }) {
  const scroll = (direction: 1 | -1) => {
    const track = document.getElementById(target);
    track?.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' });
  };
  return (
    <div className="rail__arrows">
      <button
        type="button"
        className="rail__arrow"
        aria-label="Scroll left"
        onClick={() => scroll(-1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="rail__arrow"
        aria-label="Scroll right"
        onClick={() => scroll(1)}
      >
        ›
      </button>
    </div>
  );
}
