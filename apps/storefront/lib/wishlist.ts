import 'server-only';
import { cache } from 'react';
import { api } from './api';
import { accessToken } from './session';

/** The signed-in customer's saved product ids (once per request); empty for guests. */
export const wishedIds = cache(async (): Promise<Set<string>> => {
  if (!(await accessToken())) return new Set();
  try {
    return new Set(await api<string[]>('/me/wishlist/ids'));
  } catch {
    return new Set();
  }
});
