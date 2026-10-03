'use client';

import { useEffect, useRef, useState } from 'react';

type Photo = { id: string; url: string; alt: string };

const smooth = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/**
 * A row of full-width slides that snap into place. Swiping (touch or trackpad) scrolls it
 * natively; arrows, thumbnails and the keyboard scroll it to a slide. The visible slide is
 * read back from the scroll position, so every way of moving stays in sync.
 */
function useSlides(track: React.RefObject<HTMLDivElement | null>, count: number) {
  const [index, setIndex] = useState(0);

  const go = (to: number, behavior?: ScrollBehavior) => {
    const el = track.current;
    if (!el || count === 0) return;
    const next = Math.max(0, Math.min(count - 1, to));
    el.scrollTo({ left: next * el.clientWidth, behavior: behavior ?? smooth() });
    setIndex(next);
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [track]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') go(index + 1);
    else if (event.key === 'ArrowLeft') go(index - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(count - 1);
    else return;
    event.preventDefault();
  };

  return { index, go, onKeyDown };
}

function Arrows({ index, count, go }: { index: number; count: number; go: (to: number) => void }) {
  if (count < 2) return null;
  return (
    <>
      <button
        type="button"
        className="gallery__arrow gallery__arrow--prev"
        aria-label="Previous photo"
        disabled={index === 0}
        onClick={() => go(index - 1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="gallery__arrow gallery__arrow--next"
        aria-label="Next photo"
        disabled={index === count - 1}
        onClick={() => go(index + 1)}
      >
        ›
      </button>
      <span className="gallery__count" aria-hidden="true">
        {index + 1} / {count}
      </span>
    </>
  );
}

/** Product photos: swipe or use the arrows and thumbnails; tap a photo to see it full screen. */
export function Gallery({ photos, fallback }: { photos: Photo[]; fallback: string }) {
  const mainTrack = useRef<HTMLDivElement>(null);
  const fullTrack = useRef<HTMLDivElement>(null);
  const main = useSlides(mainTrack, photos.length);
  const full = useSlides(fullTrack, photos.length);
  const dialog = useRef<HTMLDialogElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);

  // Keep the active thumbnail in view when there are more than fit.
  useEffect(() => {
    const strip = thumbs.current;
    const active = strip?.children[main.index] as HTMLElement | undefined;
    if (!strip || !active) return;
    const left = active.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + active.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollTo({
        left: left - strip.clientWidth / 2 + active.offsetWidth / 2,
        behavior: smooth(),
      });
  }, [main.index]);

  const open = (at: number) => {
    dialog.current?.showModal();
    setZoomed(true);
    // The dialog has its width only once it is open.
    requestAnimationFrame(() => full.go(at, 'auto'));
  };
  const close = () => dialog.current?.close();
  const onClose = () => {
    setZoomed(false);
    main.go(full.index, 'auto');
  };

  if (!photos.length) {
    return (
      <div className="gallery">
        <div className="gallery__main product-card__img">
          <span aria-hidden="true">{fallback}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery">
      <section
        className="gallery__main"
        aria-roledescription="carousel"
        aria-label={`Product photos, ${photos.length} in total`}
      >
        <div ref={mainTrack} className="gallery__track" tabIndex={0} onKeyDown={main.onKeyDown}>
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              className="gallery__slide"
              aria-roledescription="slide"
              aria-label={`Photo ${i + 1} of ${photos.length}: ${photo.alt}. Open full screen.`}
              tabIndex={-1}
              onClick={() => open(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                width={800}
                height={600}
                loading={i === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
            </button>
          ))}
        </div>
        <Arrows index={main.index} count={photos.length} go={main.go} />
        <span className="sr-only" aria-live="polite">
          Photo {main.index + 1} of {photos.length}
        </span>
      </section>

      {photos.length > 1 ? (
        <div ref={thumbs} className="gallery__thumbs" role="group" aria-label="Choose a photo">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              aria-label={`Show photo ${i + 1}: ${photo.alt}`}
              aria-current={i === main.index ? 'true' : undefined}
              onClick={() => main.go(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" loading="lazy" width={160} height={160} />
            </button>
          ))}
        </div>
      ) : null}

      <dialog
        ref={dialog}
        className="lightbox"
        aria-label="Product photos, full screen"
        onClose={onClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div
          ref={fullTrack}
          className="gallery__track lightbox__track"
          tabIndex={0}
          onKeyDown={full.onKeyDown}
        >
          {photos.map((photo) => (
            <div key={photo.id} className="lightbox__slide" onClick={close}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt}
                loading={zoomed ? 'eager' : 'lazy'}
                onClick={(event) => event.stopPropagation()}
                draggable={false}
              />
            </div>
          ))}
        </div>
        <Arrows index={full.index} count={photos.length} go={full.go} />
        <button type="button" className="lightbox__close" aria-label="Close" onClick={close}>
          ×
        </button>
      </dialog>
    </div>
  );
}
