'use client';

import { LOCALE_LABEL, LOCALES, type Locale } from '@nixzora/i18n';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLanguage } from '@/app/i18n/actions';
import { useLocale, useT } from './I18nProvider';

/** English / Français / Español, saved at once (and on the account when signed in). */
export function LanguagePicker({ id = 'language' }: { id?: string }) {
  const locale = useLocale();
  const t = useT('layout');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="language-picker" htmlFor={id}>
      <span aria-hidden="true">🌐</span>
      <span className="sr-only">{t('chooseLanguage')}</span>
      <select
        id={id}
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as Locale;
          start(async () => {
            await setLanguage(next);
            router.refresh();
          });
        }}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALE_LABEL[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
