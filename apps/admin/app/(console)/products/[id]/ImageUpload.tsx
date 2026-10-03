'use client';

import { MAX_PRODUCT_IMAGES } from '@nixzora/validation';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { attachImage, requestUpload } from '../actions';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024;

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string; done?: number; of?: number };

/**
 * Upload several photos at once. Each one takes three steps: ask the API for a one-time upload
 * link (server action, so the staff token stays on the server), send the file straight from
 * the browser to storage, then attach it. Files go one after another, in the order chosen.
 */
export function ImageUpload({
  productId,
  defaultAlt,
  existing,
}: {
  productId: string;
  defaultAlt: string;
  existing: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const room = MAX_PRODUCT_IMAGES - existing;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = data.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    const alt = String(data.get('alt') ?? '').trim() || defaultAlt;

    if (!files.length) return setStatus({ kind: 'error', text: 'Choose at least one photo.' });
    const bad = files.find((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (bad) {
      return setStatus({
        kind: 'error',
        text: `${bad.name}: use a JPEG, PNG, WebP or AVIF photo up to 10 MB.`,
      });
    }
    if (files.length > room) {
      return setStatus({
        kind: 'error',
        text: `You can add ${room} more ${room === 1 ? 'photo' : 'photos'} (up to ${MAX_PRODUCT_IMAGES} per product).`,
      });
    }

    let done = 0;
    for (const file of files) {
      setStatus({
        kind: 'busy',
        text: `Uploading ${done + 1} of ${files.length}…`,
        done,
        of: files.length,
      });
      const failed = await uploadOne(
        file,
        files.length > 1 ? `${alt}, photo ${existing + done + 1}` : alt,
      );
      if (failed) {
        router.refresh();
        return setStatus({
          kind: 'error',
          text: `${file.name}: ${failed}${done ? ` The first ${done} uploaded.` : ''}`,
        });
      }
      done += 1;
    }

    form.reset();
    setStatus({ kind: 'ok', text: done === 1 ? 'Photo added.' : `${done} photos added.` });
    router.refresh();
  }

  async function uploadOne(file: File, alt: string): Promise<string | null> {
    const ticket = await requestUpload(file.type, file.size);
    if (!ticket.ok) return ticket.error;
    const put = await fetch(ticket.data.uploadUrl, {
      method: 'PUT',
      headers: ticket.data.headers,
      body: file,
    }).catch(() => null);
    if (!put?.ok) {
      const body = (await put?.json().catch(() => null)) as { message?: string } | null;
      return body?.message ?? 'The upload failed. Try again.';
    }
    const attached = await attachImage(productId, ticket.data.storageKey, alt);
    return attached.ok ? null : attached.error;
  }

  if (room <= 0) {
    return (
      <p className="muted" style={{ fontSize: 14 }}>
        This product has the maximum of {MAX_PRODUCT_IMAGES} photos. Remove one to add another.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <label>
        Add photos{' '}
        <span className="hint">
          Choose several at once: every angle, close-ups and the item in use. JPEG, PNG, WebP or
          AVIF, up to 10 MB each; {room} more allowed.
        </span>
        <input type="file" name="files" accept={TYPES.join(',')} multiple required />
      </label>
      <label>
        Describe the photos <span className="hint">For shoppers using screen readers.</span>
        <input name="alt" placeholder={defaultAlt} maxLength={180} />
      </label>
      {status.kind === 'busy' && status.of ? (
        <progress max={status.of} value={status.done} aria-label="Upload progress" />
      ) : null}
      {status.text ? (
        <p
          className={`banner ${status.kind === 'error' ? 'banner--error' : 'banner--ok'}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
        >
          {status.text}
        </p>
      ) : null}
      <div>
        <button className="btn btn--primary" type="submit" disabled={status.kind === 'busy'}>
          {status.kind === 'busy' ? 'Uploading…' : 'Upload photos'}
        </button>
      </div>
    </form>
  );
}
