'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { attachPhoto, requestPhotoUpload } from '../../actions';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Three steps: ask the API for a one-time upload link (server action, so the seller's token
 * stays on the server), send the file straight from the browser to storage, then attach it.
 */
export function PhotoUpload({ productId, defaultAlt }: { productId: string; defaultAlt: string }) {
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
      return setStatus({ kind: 'error', text: 'Choose a photo first.' });
    }
    if (!TYPES.includes(file.type)) {
      return setStatus({ kind: 'error', text: 'Use a JPEG, PNG, WebP or AVIF photo.' });
    }
    if (file.size > MAX_BYTES) {
      return setStatus({ kind: 'error', text: 'Photos can be up to 10 MB.' });
    }

    setStatus({ kind: 'busy', text: 'Uploading…' });
    const ticket = await requestPhotoUpload(file.type, file.size);
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

    const attached = await attachPhoto(productId, ticket.data.storageKey, alt);
    if (!attached.ok) return setStatus({ kind: 'error', text: attached.error });

    form.reset();
    setStatus({ kind: 'ok', text: 'Photo added.' });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <label>
        Add a photo <span className="hint">JPEG, PNG, WebP or AVIF, up to 10 MB.</span>
        <input type="file" name="file" accept={TYPES.join(',')} required />
      </label>
      <label>
        Describe the photo <span className="hint">For shoppers using screen readers.</span>
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
        <button className="btn btn--secondary" type="submit" disabled={status.kind === 'busy'}>
          {status.kind === 'busy' ? 'Uploading…' : 'Upload photo'}
        </button>
      </div>
    </form>
  );
}
