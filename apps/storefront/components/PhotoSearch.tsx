'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { searchByPhoto } from '@/app/search/photo/actions';

export type PhotoSearchLabels = {
  choose: string;
  drop: string;
  formats: string;
  searching: string;
  privacy: string;
  tooLarge: string;
  unreadable: string;
  failed: string;
  yourPhoto: string;
};

/** Longest side sent to the API: plenty for matching, and small to upload on a phone. */
const MAX_SIDE = 1024;

/** Shrinks a photo in the browser and returns it as base64 JPEG (no data: prefix). */
async function shrink(file: Blob): Promise<{ base64: string; preview: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const preview = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: preview.slice(preview.indexOf(',') + 1), preview };
}

/**
 * Search by photo (p10-14): pick, take (phones offer the camera), drop or paste a picture. It is
 * shrunk here, sent once, and never stored; the results page is addressed by the result's id.
 */
export function PhotoSearch({
  labels,
  compact = false,
}: {
  labels: PhotoSearchLabels;
  compact?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();

  const send = (file: Blob | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setError(null);
    start(async () => {
      let shrunk: { base64: string; preview: string };
      try {
        shrunk = await shrink(file);
      } catch {
        setError(labels.unreadable);
        return;
      }
      setPreview(shrunk.preview);
      const outcome = await searchByPhoto(shrunk.base64).catch(() => ({
        error: 'failed' as const,
      }));
      if ('id' in outcome) router.push(`/search/photo?r=${outcome.id}`);
      else setError(labels[outcome.error]);
    });
  };

  // Paste a picture anywhere on the page.
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      if (item) send(item.getAsFile());
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  });

  return (
    <div
      className={`photo-drop${dragging ? ' photo-drop--over' : ''}${compact ? ' photo-drop--compact' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        send(event.dataTransfer.files[0]);
      }}
      aria-busy={pending}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview, not a served image
        <img src={preview} alt={labels.yourPhoto} className="photo-drop__preview" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="40"
          height="40"
          aria-hidden="true"
          className="photo-drop__icon"
        >
          <path
            d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.4-2h7l1.4 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12.5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )}
      {pending ? (
        <p role="status" className="photo-drop__status">
          {labels.searching}
        </p>
      ) : (
        <p className="photo-drop__text">
          {compact ? null : <span className="hide-sm">{labels.drop} </span>}
          <label htmlFor={inputId} className="btn btn--primary">
            {labels.choose}
          </label>
        </p>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          send(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="hint">
        {labels.formats} {labels.privacy}
      </p>
    </div>
  );
}
