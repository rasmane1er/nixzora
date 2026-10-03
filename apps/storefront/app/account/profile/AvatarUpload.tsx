'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/components/I18nProvider';
import { requestAvatarUpload, setAvatar } from '../hub-actions';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Pick a photo; it uploads straight to storage, then becomes the profile photo. */
export function AvatarUpload({ hasPhoto }: { hasPhoto: boolean }) {
  const router = useRouter();
  const t = useT('account');
  const [status, setStatus] = useState<{ busy?: boolean; error?: string }>({});

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) return setStatus({ error: t('photoTypeError') });
    if (file.size > 5 * 1024 * 1024) return setStatus({ error: t('photoSizeError') });
    setStatus({ busy: true });
    const ticket = await requestAvatarUpload(file.type, file.size);
    if (!ticket.ok) return setStatus({ error: ticket.error });
    const put = await fetch(ticket.data.uploadUrl, {
      method: 'PUT',
      headers: ticket.data.headers,
      body: file,
    }).catch(() => null);
    if (!put?.ok) return setStatus({ error: t('uploadFailed') });
    const saved = await setAvatar(ticket.data.storageKey);
    if (!saved.ok) return setStatus({ error: saved.error });
    setStatus({});
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <label
        className="btn btn--secondary btn--sm"
        style={{ width: 'fit-content', cursor: 'pointer' }}
      >
        {status.busy ? t('uploading') : hasPhoto ? t('changePhoto') : t('addPhoto')}
        <input
          type="file"
          accept={TYPES.join(',')}
          onChange={onChange}
          disabled={status.busy}
          className="sr-only"
        />
      </label>
      {status.error ? (
        <span className="hint" role="alert" style={{ color: 'var(--err-fg)' }}>
          {status.error}
        </span>
      ) : (
        <span className="hint">{t('photoHint')}</span>
      )}
    </div>
  );
}
