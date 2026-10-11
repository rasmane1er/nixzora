import { expect, test } from '@playwright/test';

/**
 * The Phase 3 exit test: a guest finds a product, adds it to the cart, checks out and pays
 * (test payment mode), then sees the confirmed order.
 */
test('a guest buys a product', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tell us what you need');

  // Find something in stock through search.
  await page.getByRole('combobox', { name: 'Search products' }).fill('laptop');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=laptop/);
  await page.getByLabel('In stock only').check();
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.locator('.product-card__link').first().click();

  // Product page → cart.
  await expect(page).toHaveURL(/\/p\//);
  const title = await page.getByRole('heading', { level: 1 }).innerText();
  await page.getByRole('button', { name: /^Add to cart ·/ }).click();
  await expect(page.getByRole('status')).toContainText('Added to your cart');
  await page.getByRole('link', { name: 'View cart →' }).click();
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  // Checkout as a guest.
  await page.getByRole('link', { name: 'Check out' }).click();
  await page.getByLabel('Email for your receipt').fill(`guest-${Date.now()}@example.com`);
  await page.getByLabel('Full name').fill('Ada Lovelace');
  await page.getByLabel('Address', { exact: true }).fill('100 Main St');
  await page.getByLabel('City').fill('Brandywine');
  await page.getByLabel('State').selectOption('MD');
  await page.getByLabel('ZIP code').fill('20613');
  await page.getByRole('button', { name: 'Continue to payment' }).click();

  // Pay (test mode): a decline first, then success.
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
  await expect(page.getByText('Tax')).toBeVisible();
  await page.getByRole('button', { name: 'Simulate a declined card' }).click();
  await expect(page.locator('.banner--error')).toContainText('declined');
  await page.getByRole('button', { name: /^Pay .* \(test\)$/ }).click();

  // Confirmation (the page re-checks while the payment event arrives).
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Thank you! Your order is confirmed.',
    {
      timeout: 15_000,
    },
  );
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.locator('.cart-count')).toHaveText('0');
});

test('order pages need the signed link', async ({ page }) => {
  const res = await page.goto('/orders/NX-AAAAAA?token=' + 'x'.repeat(43));
  expect(res?.status()).toBe(404);
});
