'use client';

import { useState } from 'react';
import { requestBrandingUpload } from '@/app/sell/apply/actions';
import { useT } from '@/components/I18nProvider';

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
  const t = useT('sellApply');
  const tc = useT('common');
  const name = logo ? t('storeLogo') : t('storeBanner');

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!(TYPES as readonly string[]).includes(file.type)) {
      return setStatus({ error: t('uploadType') });
    }
    if (file.size > 5 * 1024 * 1024) return setStatus({ error: t('uploadSize') });
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
    if (!put?.ok) return setStatus({ error: t('uploadFailed') });
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
          <img src={image.url} alt={name} />
        ) : (
          <span className="brand-upload__empty">
            <span aria-hidden="true">+</span>
            {status.busy ? t('uploading') : logo ? t('uploadLogo') : t('uploadBanner')}
          </span>
        )}
        <input
          type="file"
          accept={TYPES.join(',')}
          onChange={onChange}
          disabled={status.busy}
          className="sr-only"
          aria-label={name}
        />
      </label>
      <div className="stack" style={{ gap: 4 }}>
        <strong>{name}</strong>
        <span className="hint">
          {logo ? t('logoRecommended') : t('bannerRecommended')} {t('uploadFormats')}
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
            {tc('remove')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
