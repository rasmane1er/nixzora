/**
 * Web preview only (expo start --web): there is no keychain in a browser, so this uses
 * localStorage. The real web storefront is the Next.js app, which keeps tokens in HttpOnly cookies.
 */
function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const secureStorage = {
  get: async (key: string) => store()?.getItem(key) ?? null,
  set: async (key: string, value: string) => store()?.setItem(key, value),
  remove: async (key: string) => store()?.removeItem(key),
};
