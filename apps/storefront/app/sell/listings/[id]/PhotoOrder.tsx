'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useT } from '@/components/I18nProvider';
import { deletePhoto, reorderPhotos } from '../../actions';

type Photo = { id: string; url: string; alt: string };

/** The listing's photos in order: the first is the main photo shoppers see in search and lists. */
export function PhotoOrder({ productId, photos }: { productId: string; photos: Photo[] }) {
  const t = useT('sellerTools');
  const tc = useT('common');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ids = photos.map((p) => p.id);

  const run = (call: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const result = await call();
      if (!result.ok) setError(result.error ?? t('didNotWork'));
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
              <figcaption className="hint">
                {i === 0 ? t('mainPhoto') : t('photoN', { n: i + 1 })}
              </figcaption>
            </figure>
            <div className="seller-photos__tools">
              <button
                type="button"
                className="btn btn--link"
                disabled={pending || i === 0}
                aria-label={t('moveEarlier', { n: i + 1 })}
                onClick={() => move(i, i - 1)}
              >
                ←
              </button>
              <button
                type="button"
                className="btn btn--link"
                disabled={pending || i === photos.length - 1}
                aria-label={t('moveLater', { n: i + 1 })}
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
                  {t('makeMain')}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn--link"
                disabled={pending}
                aria-label={t('removePhoto', { n: i + 1 })}
                onClick={() => run(() => deletePhoto(productId, photo.id))}
              >
                {tc('remove')}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
