'use client';

import { useState } from 'react';
import { useT } from '@/components/I18nProvider';
import { requestReviewPhotoUpload } from './actions';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX = 4;

/**
 * Photos for a review (p10-05): each uploads straight to storage as soon as it is picked; the
 * form sends the keys with the review. The API checks and re-encodes them before they show.
 */
export function ReviewPhotoPicker() {
  const t = useT('community');
  const [photos, setPhotos] = useState<{ key: string; preview: string }[]>([]);
  const [status, setStatus] = useState<{ busy?: boolean; error?: string }>({});

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].slice(0, MAX - photos.length);
    event.target.value = '';
    for (const file of files) {
      if (!TYPES.includes(file.type) || file.size > 8 * 1024 * 1024) {
        setStatus({ error: t('photoFailed') });
        continue;
      }
      setStatus({ busy: true });
      const ticket = await requestReviewPhotoUpload(file.type, file.size);
      if (!ticket.ok) {
        setStatus({ error: ticket.error });
        continue;
      }
      const put = await fetch(ticket.data.uploadUrl, {
        method: 'PUT',
        headers: ticket.data.headers,
        body: file,
      }).catch(() => null);
      if (!put?.ok) {
        setStatus({ error: t('photoFailed') });
        continue;
      }
      const preview = URL.createObjectURL(file);
      setPhotos((current) => [...current, { key: ticket.data.storageKey, preview }].slice(0, MAX));
      setStatus({});
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="photosSent" value="1" />
      {photos.map((photo) => (
        <input key={photo.key} type="hidden" name="photoKeys" value={photo.key} />
      ))}
      {photos.length ? (
        <ul className="review-photo-picks">
          {photos.map((photo, i) => (
            <li key={photo.key}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={photo.preview} alt="" width={72} height={72} />
              <button
                type="button"
                aria-label={t('removePhoto', { n: i + 1 })}
                onClick={() => setPhotos((current) => current.filter((p) => p.key !== photo.key))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {photos.length < MAX ? (
        <label
          className="btn btn--secondary btn--sm"
          style={{ width: 'fit-content', cursor: 'pointer' }}
        >
          {status.busy ? t('photoUploading') : t('addPhotos')}
          <input
            type="file"
            accept={TYPES.join(',')}
            multiple
            onChange={onChange}
            disabled={status.busy}
            className="sr-only"
          />
        </label>
      ) : null}
      {status.error ? (
        <span className="hint" role="alert" style={{ color: 'var(--err-fg)' }}>
          {status.error}
        </span>
      ) : null}
    </div>
  );
}

/** A review's photos: thumbnails that open full size in a dialog. */
export function ReviewPhotoStrip({
  photos,
  author,
}: {
  photos: { url: string }[];
  author: string;
}) {
  const t = useT('community');
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <ul className="review-photos">
        {photos.map((photo, i) => (
          <li key={photo.url}>
            <button type="button" onClick={() => setOpen(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- shoppers' photos, fixed size */}
              <img
                src={photo.url}
                alt={t('reviewPhoto', { n: i + 1, author })}
                width={88}
                height={88}
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && photos[open] ? (
        <div
          className="photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={t('reviewPhoto', { n: open + 1, author })}
        >
          <button
            type="button"
            className="photo-viewer__close"
            onClick={() => setOpen(null)}
            autoFocus
          >
            {t('closePhoto')}
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-size shopper photo */}
          <img src={photos[open].url} alt={t('reviewPhoto', { n: open + 1, author })} />
        </div>
      ) : null}
    </>
  );
}
