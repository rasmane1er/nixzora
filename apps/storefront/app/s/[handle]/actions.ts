'use server';

import { type FollowStatus } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { api, errorMessage } from '@/lib/api';

export type FollowResult = { ok: true; status: FollowStatus } | { ok: false; error: string };

const HANDLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Follow or unfollow a store (p10-24). */
export async function setFollowing(handle: string, follow: boolean): Promise<FollowResult> {
  if (!HANDLE.test(handle)) return { ok: false, error: 'Unknown store.' };
  try {
    const status = await api<FollowStatus>(`/me/follows/${handle}`, {
      method: follow ? 'PUT' : 'DELETE',
    });
    revalidatePath('/following');
    return { ok: true, status };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Deal notifications on or off for a followed store. */
export async function setDealAlerts(handle: string, notify: boolean): Promise<FollowResult> {
  if (!HANDLE.test(handle)) return { ok: false, error: 'Unknown store.' };
  try {
    const status = await api<FollowStatus>(`/me/follows/${handle}`, {
      method: 'PATCH',
      body: { notify },
    });
    revalidatePath('/following');
    return { ok: true, status };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
