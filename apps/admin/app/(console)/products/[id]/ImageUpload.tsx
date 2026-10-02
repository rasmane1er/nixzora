'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { attachImage, requestUpload } from '../actions';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Three steps: ask the API for a one-time upload link (server action, staff token stays on
 * the server), send the file straight from the browser to storage, then attach it.
 */
export function ImageUpload({ productId, defaultAlt }: { productId: string; defaultAlt: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; text?: string }>({
    kind: 'idle',
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('file');
    const alt = String(data.get('alt') ?? '').trim() || defaultAlt;

    if (!(file instanceof File) || file.size === 0) {
      return setStatus({ kind: 'error', text: 'Choose an image first.' });
    }
    if (!TYPES.includes(file.type)) {
      return setStatus({ kind: 'error', text: 'Use a JPEG, PNG, WebP or AVIF image.' });
    }
    if (file.size > MAX_BYTES) {
      return setStatus({ kind: 'error', text: 'Images can be up to 10 MB.' });
    }

    setStatus({ kind: 'busy', text: 'Uploading…' });
    const ticket = await requestUpload(file.type, file.size);
    if (!ticket.ok) return setStatus({ kind: 'error', text: ticket.error });

    const put = await fetch(ticket.data.uploadUrl, {
      method: 'PUT',
      headers: ticket.data.headers,
      body: file,
    }).catch(() => null);
    if (!put?.ok) {
      const body = (await put?.json().catch(() => null)) as { message?: string } | null;
      return setStatus({ kind: 'error', text: body?.message ?? 'The upload failed. Try again.' });
    }

    const attached = await attachImage(productId, ticket.data.storageKey, alt);
    if (!attached.ok) return setStatus({ kind: 'error', text: attached.error });

    form.reset();
    setStatus({ kind: 'ok', text: 'Image added.' });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <label>
        Add an image <span className="hint">JPEG, PNG, WebP or AVIF, up to 10 MB.</span>
        <input type="file" name="file" accept={TYPES.join(',')} required />
      </label>
      <label>
        Description for screen readers
        <input name="alt" placeholder={defaultAlt} maxLength={200} />
      </label>
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
          {status.kind === 'busy' ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </form>
  );
}
