'use client';

import { useState } from 'react';
import { requestBrandingUpload } from '@/app/sell/apply/actions';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * A store logo or banner. The file goes straight to storage; the form then carries its key
 * (`<name>Key`) and preview URL (`<name>Url`), so it is saved with the rest of the step.
 */
export function BrandingUpload({
  kind,
  keyValue,
  urlValue,
}: {
  kind: 'logo' | 'banner';
  keyValue?: string;
  urlValue?: string;
}) {
  const [image, setImage] = useState({ key: keyValue ?? '', url: urlValue ?? '' });
  const [status, setStatus] = useState<{ busy?: boolean; error?: string }>({});
  const logo = kind === 'logo';

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!(TYPES as readonly string[]).includes(file.type)) {
      return setStatus({ error: 'Use a PNG, JPEG or WebP image.' });
    }
    if (file.size > 5 * 1024 * 1024) return setStatus({ error: 'Images can be up to 5 MB.' });
    setStatus({ busy: true });
    const ticket = await requestBrandingUpload({
      kind,
      contentType: file.type as (typeof TYPES)[number],
      sizeBytes: file.size,
    });
    if (!ticket.ok) return setStatus({ error: ticket.error });
    const put = await fetch(ticket.data.uploadUrl, {
      method: 'PUT',
      headers: ticket.data.headers,
      body: file,
    }).catch(() => null);
    if (!put?.ok) return setStatus({ error: 'The upload failed. Try again.' });
    setImage({ key: ticket.data.storageKey, url: ticket.data.publicUrl });
    setStatus({});
  }

  return (
    <div className={`brand-upload brand-upload--${kind}`}>
      <input type="hidden" name={`${kind}Key`} value={image.key} />
      <input type="hidden" name={`${kind}Url`} value={image.url} />
      <label className="brand-upload__drop">
        {image.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a just-uploaded preview
          <img src={image.url} alt={logo ? 'Store logo' : 'Store banner'} />
        ) : (
          <span className="brand-upload__empty">
            <span aria-hidden="true">+</span>
            {status.busy ? 'Uploading…' : logo ? 'Upload logo' : 'Upload banner'}
          </span>
        )}
        <input
          type="file"
          accept={TYPES.join(',')}
          onChange={onChange}
          disabled={status.busy}
          className="sr-only"
          aria-label={logo ? 'Store logo' : 'Store banner'}
        />
      </label>
      <div className="stack" style={{ gap: 4 }}>
        <strong>{logo ? 'Store logo' : 'Store banner'}</strong>
        <span className="hint">
          {logo ? 'Recommended: 500 × 500 px.' : 'Recommended: 1600 × 500 px.'} PNG, JPEG or WebP,
          up to 5 MB.
        </span>
        {status.error ? (
          <span className="hint" role="alert" style={{ color: 'var(--err-fg)' }}>
            {status.error}
          </span>
        ) : null}
        {image.key ? (
          <button
            type="button"
            className="link-button"
            onClick={() => setImage({ key: '', url: '' })}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
