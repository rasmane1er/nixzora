import { type MyPlus } from '@nixzora/validation';
import { cache } from 'react';
import { api } from './api';
import { isSignedIn } from './session';

/** Whether the signed-in shopper has NIXZORA Plus benefits now (once per page render). */
export const isPlusMember = cache(async (): Promise<boolean> => {
  if (!(await isSignedIn())) return false;
  return api<MyPlus>('/me/plus')
    .then((mine) => Boolean(mine.membership?.active))
    .catch(() => false);
});
