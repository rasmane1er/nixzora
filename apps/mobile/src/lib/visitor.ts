import * as Crypto from 'expo-crypto';
import { secureStorage } from './secure-storage';

const KEY = 'nx.visitor';
let cached: Promise<string> | null = null;

/**
 * A random id this phone keeps for recommendations before (and after) sign-in. It identifies no
 * one: it is not the device id, advertising id or anything else that could be matched elsewhere.
 */
export function visitorId(): Promise<string> {
  cached ??= (async () => {
    const stored = await secureStorage.get(KEY).catch(() => null);
    if (stored) return stored;
    const id = Crypto.randomUUID().replace(/-/g, '');
    await secureStorage.set(KEY, id).catch(() => undefined);
    return id;
  })();
  return cached;
}
