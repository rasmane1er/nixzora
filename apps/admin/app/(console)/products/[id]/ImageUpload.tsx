'use client';

import { MAX_PRODUCT_IMAGES } from '@nixzora/validation';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/components/I18nProvider';
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
  const t = useT('opsCatalog');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const room = MAX_PRODUCT_IMAGES - existing;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = data.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    const alt = String(data.get('alt') ?? '').trim() || defaultAlt;

    if (!files.length) return setStatus({ kind: 'error', text: t('choosePhoto') });
    const bad = files.find((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (bad) {
      return setStatus({
        kind: 'error',
        text: t('badPhoto', { name: bad.name }),
      });
    }
    if (files.length > room) {
      return setStatus({
        kind: 'error',
        text: t('tooManyPhotos', { room, max: MAX_PRODUCT_IMAGES }),
      });
    }

    let done = 0;
    for (const file of files) {
      setStatus({
        kind: 'busy',
        text: t('uploadingCount', { n: done + 1, total: files.length }),
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
          text: done
            ? t('uploadFailedPartial', { name: file.name, error: failed, done })
            : t('uploadFailedFile', { name: file.name, error: failed }),
        });
      }
      done += 1;
    }

    form.reset();
    setStatus({ kind: 'ok', text: t('photosAdded', { count: done }) });
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
      return body?.message ?? t('uploadFailed');
    }
    const attached = await attachImage(productId, ticket.data.storageKey, alt);
    return attached.ok ? null : attached.error;
  }

  if (room <= 0) {
    return (
      <p className="muted" style={{ fontSize: 14 }}>
        {t('maxPhotos', { max: MAX_PRODUCT_IMAGES })}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <label>
        {t('addPhotos')} <span className="hint">{t('addPhotosHint', { room })}</span>
        <input type="file" name="files" accept={TYPES.join(',')} multiple required />
      </label>
      <label>
        {t('describePhotos')} <span className="hint">{t('describePhotosHint')}</span>
        <input name="alt" placeholder={defaultAlt} maxLength={180} />
      </label>
      {status.kind === 'busy' && status.of ? (
        <progress max={status.of} value={status.done} aria-label={t('uploadProgress')} />
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
          {status.kind === 'busy' ? t('uploading') : t('uploadPhotos')}
        </button>
      </div>
    </form>
  );
}
