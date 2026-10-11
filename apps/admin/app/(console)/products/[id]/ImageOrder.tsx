'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useT } from '@/components/I18nProvider';
import { deleteImage, reorderImages, setImageColor } from '../actions';

type Photo = { id: string; url: string; alt: string; color?: string | null };

/** The product's photos in order: the first is the main photo shoppers see in search and lists. */
export function ImageOrder({
  productId,
  photos,
  colors = [],
}: {
  productId: string;
  photos: Photo[];
  /** Photos per color (p10-29): the product's colors, when it has two or more. */
  colors?: string[];
}) {
  const router = useRouter();
  const pc = useT('photoColors');
  const t = useT('opsCatalog');
  const tc = useT('common');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ids = photos.map((p) => p.id);

  const run = (call: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const result = await call();
      if (!result.ok) setError(result.error ?? t('photoActionFailed'));
      router.refresh();
    });

  const move = (from: number, to: number) => {
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    run(() => reorderImages(productId, next));
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}
      <ol className="photo-order" aria-busy={pending}>
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.alt} width={120} height={120} />
              <figcaption className="hint">
                {i === 0 ? t('mainPhoto') : t('photoNumber', { n: i + 1 })}
              </figcaption>
            </figure>
            {colors.length > 1 ? (
              <label className="image-color">
                <span className="muted small">{pc('showsColor')}</span>
                <select
                  value={photo.color ?? ''}
                  disabled={pending}
                  onChange={(e) =>
                    run(() => setImageColor(productId, photo.id, e.target.value || null))
                  }
                >
                  <option value="">{pc('everyColor')}</option>
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="photo-order__tools">
              <button
                type="button"
                className="btn btn--secondary btn--small"
                disabled={pending || i === 0}
                aria-label={t('movePhotoEarlier', { n: i + 1 })}
                onClick={() => move(i, i - 1)}
              >
                ←
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--small"
                disabled={pending || i === photos.length - 1}
                aria-label={t('movePhotoLater', { n: i + 1 })}
                onClick={() => move(i, i + 1)}
              >
                →
              </button>
              {i > 0 ? (
                <button
                  type="button"
                  className="btn btn--secondary btn--small"
                  disabled={pending}
                  onClick={() => move(i, 0)}
                >
                  {t('makeMain')}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn--secondary btn--small"
                disabled={pending}
                aria-label={t('removePhoto', { n: i + 1 })}
                onClick={() => run(() => deleteImage(productId, photo.id))}
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
