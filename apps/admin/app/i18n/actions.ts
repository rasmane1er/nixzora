'use server';

import { isLocale, LOCALE_COOKIE } from '@nixzora/i18n';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { api } from '@/lib/api';

/** Remembers the language for a year and on the staff account (emails, the app). */
export async function setLanguage(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 365 * 24 * 3600,
  });
  await api('/me/language', { method: 'PUT', body: { language: locale } }).catch(() => undefined);
  revalidatePath('/', 'layout');
}
