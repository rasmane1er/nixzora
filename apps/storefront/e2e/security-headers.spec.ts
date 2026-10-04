import { expect, type Page, test } from '@playwright/test';
import { signUp } from './sign-up';

/** Collects Content Security Policy violations the page reports while we browse. */
async function watchViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) =>
      console.error(
        `Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`,
      ),
    );
  });
  return violations;
}

test('pages send the security headers', async ({ request }) => {
  const res = await request.get('/');
  const headers = res.headers();
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain('https://js.stripe.com');
  expect(csp).not.toContain("'unsafe-eval'");
  // Scripts need this page view's nonce: no blanket permission for inline scripts.
  const scripts = /script-src ([^;]*)/.exec(csp)?.[1] ?? '';
  expect(scripts).toMatch(/'nonce-[A-Za-z0-9+/=]{16,}'/);
  expect(scripts).toContain("'strict-dynamic'");
  expect(scripts).not.toContain("'unsafe-inline'");
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('every page view gets its own nonce, and the page scripts carry it', async ({ request }) => {
  const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];
  const first = await request.get('/');
  const second = await request.get('/');
  const nonce = nonceOf(first.headers()['content-security-policy'] ?? '');
  expect(nonce).toBeTruthy();
  expect(nonceOf(second.headers()['content-security-policy'] ?? '')).not.toBe(nonce);
  const html = await first.text();
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1] ?? '');
  expect(inline.length).toBeGreaterThan(0);
  for (const attributes of inline) expect(attributes).toContain(`nonce="${nonce}"`);
});

test('the main pages run without breaking the Content Security Policy', async ({ page }) => {
  const violations = await watchViolations(page);
  for (const path of [
    '/',
    '/search?q=monitor',
    '/cart',
    '/account/register',
    '/account/login',
    '/sell',
    '/help',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  // A product page, with its images and the add-to-cart island.
  await page.goto('/search?q=monitor');
  await page.locator('.product-card__link').first().click();
  await expect(page.getByRole('button', { name: /^Add to cart ·/ })).toBeVisible();
  await page.getByRole('button', { name: /^Add to cart ·/ }).click();
  await page.waitForLoadState('networkidle');
  expect(violations).toEqual([]);
});

test('security.txt says how to report a vulnerability', async ({ request }) => {
  const res = await request.get('/.well-known/security.txt');
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toMatch(/^Contact: https:\/\/github\.com\/rasmane1er\/nixzora\/security/m);
  expect(text).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T/m);
});

test('signing up cannot be turned into a redirect to another site', async ({ page }) => {
  // Browsers drop the tab, so a naive check would send the visitor to //evil.example.
  await page.goto(`/account/register?next=${encodeURIComponent('/\t/evil.example')}`);
  await signUp(page, { firstName: 'Mallory', email: `redirect-${Date.now()}@example.com` });
  await page.waitForURL((url) => !url.pathname.includes('register'));
  expect(new URL(page.url()).host).toBe('localhost:3000');
  expect(new URL(page.url()).pathname).toBe('/account');
});
