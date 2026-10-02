/**
 * Maps incoming links (universal links, nixzora:// URLs, notification taps) to app routes.
 * Storefront paths that exist in the app pass through unchanged; account pages from emails
 * (password reset, email verification) only exist on the web, so they open the Account tab.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'nixzora://app');
    if (url.pathname.startsWith('/account/')) return '/account';
    if (url.pathname.startsWith('/checkout')) return '/cart';
    return path;
  } catch {
    return '/';
  }
}
