'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deletePhoto, reorderPhotos } from '../../actions';

type Photo = { id: string; url: string; alt: string };

/** The listing's photos in order: the first is the main photo shoppers see in search and lists. */
export function PhotoOrder({ productId, photos }: { productId: string; photos: Photo[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ids = photos.map((p) => p.id);

  const run = (call: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const result = await call();
      if (!result.ok) setError(result.error ?? 'That did not work. Try again.');
      router.refresh();
    });

  const move = (from: number, to: number) => {
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    run(() => reorderPhotos(productId, next));
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}
      <ol className="seller-photos" aria-busy={pending}>
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.alt} width={120} height={120} />
              <figcaption className="hint">{i === 0 ? 'Main photo' : `Photo ${i + 1}`}</figcaption>
            </figure>
            <div className="seller-photos__tools">
              <button
                type="button"
                className="btn btn--link"
                disabled={pending || i === 0}
                aria-label={`Move photo ${i + 1} earlier`}
                onClick={() => move(i, i - 1)}
              >
                ←
              </button>
              <button
                type="button"
                className="btn btn--link"
                disabled={pending || i === photos.length - 1}
                aria-label={`Move photo ${i + 1} later`}
                onClick={() => move(i, i + 1)}
              >
                →
              </button>
              {i > 0 ? (
                <button
                  type="button"
                  className="btn btn--link"
                  disabled={pending}
                  onClick={() => move(i, 0)}
                >
                  Make main
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn--link"
                disabled={pending}
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => run(() => deletePhoto(productId, photo.id))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
