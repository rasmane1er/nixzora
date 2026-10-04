/**
 * Content Security Policy for the storefront (docs/security/threat-model.md). Built per request
 * in proxy.ts, because the API's address comes from the environment at run time.
 *
 * Scripts: our own plus Stripe (payment form), Google and Apple (sign-in buttons). Inline
 * scripts are still allowed because Next.js writes its page data inline; moving to per-request
 * nonces needs every page rendered on demand (open item in the pen-test checklist).
 * Everything else is narrow: no plugins, no framing of our pages, forms post only to us (and
 * Apple's sign-in), and the page talks only to us, the API, S3 uploads and the payment and
 * sign-in providers.
 */
export function contentSecurityPolicy({
  apiOrigin,
  https,
  dev,
}: {
  apiOrigin: string;
  https: boolean;
  dev: boolean;
}): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      'https://js.stripe.com',
      'https://*.js.stripe.com',
      'https://maps.googleapis.com',
      'https://accounts.google.com/gsi/client',
      'https://appleid.cdn-apple.com',
    ],
    'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:', apiOrigin],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      apiOrigin,
      'https://*.amazonaws.com',
      'https://api.stripe.com',
      'https://maps.googleapis.com',
      'https://accounts.google.com/gsi/',
      'https://appleid.apple.com',
      ...(dev ? ['ws:'] : []),
    ],
    'frame-src': [
      'https://js.stripe.com',
      'https://*.js.stripe.com',
      'https://hooks.stripe.com',
      'https://accounts.google.com/gsi/',
      'https://appleid.apple.com',
    ],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'form-action': ["'self'", 'https://appleid.apple.com'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (https) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}
