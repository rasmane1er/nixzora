import 'server-only';
import { type MeResponse } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { load } from './api';

/** The signed-in staff member, loaded once per request. */
export const currentStaff = cache(async (): Promise<MeResponse> => {
  const me = await load<MeResponse>('/auth/me');
  if (!me.permissions.includes('admin.access')) redirect('/login?denied=1');
  return me;
});

export function can(me: MeResponse, permission: string): boolean {
  return me.permissions.includes(permission);
}
