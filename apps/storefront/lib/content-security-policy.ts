/**
 * Content Security Policy for the storefront (docs/security/threat-model.md). Built per request
 * in proxy.ts, because the API's address comes from the environment at run time.
 *
 * Scripts: only those carrying this request's nonce (Next.js adds it to its own) and the ones
 * they load ('strict-dynamic': Stripe's payment form, Google and Apple sign-in). No inline
 * script without the nonce runs, so injected markup cannot execute. The host list is a fallback
 * for browsers without 'strict-dynamic'. Every page renders on demand, which nonces need.
 * Everything else is narrow: no plugins, no framing of our pages, forms post only to us (and
 * Apple's sign-in), and the page talks only to us, the API, S3 uploads and the payment and
 * sign-in providers.
 */
export function contentSecurityPolicy({
  apiOrigin,
  https,
  dev,
  nonce,
}: {
  apiOrigin: string;
  https: boolean;
  dev: boolean;
  nonce: string;
}): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
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
