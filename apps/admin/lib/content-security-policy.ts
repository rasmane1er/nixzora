/**
 * Content Security Policy for the Ops Center (docs/security/threat-model.md). Built per request
 * in proxy.ts, because the API's address comes from the environment at run time. Staff pages
 * load nothing from third parties: only our own scripts carrying this request's nonce (Next.js
 * adds it to its own; no other inline script runs), images from anywhere over HTTPS (product photos), and calls to us, the API
 * and S3 uploads. Nobody may frame it, and forms post only to itself.
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
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:', apiOrigin],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", apiOrigin, 'https://*.amazonaws.com', ...(dev ? ['ws:'] : [])],
    'frame-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (https) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}
