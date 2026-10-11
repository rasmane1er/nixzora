'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

const PAGE = '/sell/settings';

async function perform(call: () => Promise<unknown>, notice: 'saved' | 'endedNotice') {
  const t = await getT('vacation');
  try {
    await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/account/login?next=${encodeURIComponent(PAGE)}`);
    }
    redirect(`${PAGE}?error=${encodeURIComponent(errorMessage(error))}#vacation`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?notice=${encodeURIComponent(t(notice))}#vacation`);
}

/** Vacation mode (p10-32): away from a day, until the day the store is back. */
export async function saveVacation(form: FormData): Promise<void> {
  const value = (name: string) => String(form.get(name) ?? '').trim();
  await perform(
    () =>
      api('/seller/vacation', {
        method: 'PUT',
        body: {
          from: value('from'),
          until: value('until') || null,
          message: value('message') || null,
        },
      }),
    'saved',
  );
}

export async function endVacation(): Promise<void> {
  await perform(() => api('/seller/vacation', { method: 'DELETE' }), 'endedNotice');
}
