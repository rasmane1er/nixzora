import { expect, test } from '@playwright/test';

/** A registered customer saves a product, uses the demo coupon, buys, and reviews it. */
test('a customer uses a coupon, buys, and writes a review', async ({ page }) => {
  const email = `customer-${Date.now()}@example.com`;
  await page.goto('/account/register');
  await page.getByLabel('First name').fill('Grace');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Grace' })).toBeVisible();

  // A product over $50 so WELCOME10 applies.
  await page.goto('/search?q=monitor&inStock=true&sort=price_desc');
  await page.locator('.product-card__link').first().click();
  await expect(page.getByRole('button', { name: /^Add to cart ·/ })).toBeVisible();
  const productPath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: '♡ Save' }).click();
  await expect(page.getByRole('button', { name: '♥ Saved' })).toBeVisible();
  await page.getByRole('button', { name: /^Add to cart ·/ }).click();
  await expect(page.getByRole('status')).toContainText('Added to your cart');

  await page.goto('/cart');
  await page.getByLabel('Discount code').fill('welcome10');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('.summary')).toContainText('Discount (WELCOME10)');

  await page.getByRole('link', { name: 'Check out' }).click();
  await page.getByLabel('Full name').fill('Grace Hopper');
  await page.getByLabel('Address', { exact: true }).fill('1 Navy Way');
  await page.getByLabel('City').fill('Arlington');
  await page.getByLabel('State').selectOption('VA');
  await page.getByLabel('ZIP code').fill('22201');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.locator('.summary')).toContainText('WELCOME10');
  await page.getByRole('button', { name: /^Pay .* \(test\)$/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Thank you! Your order is confirmed.',
    {
      timeout: 15_000,
    },
  );

  // The order is in the account, and the product is in the wishlist.
  await page.goto('/account');
  await expect(page.locator('.order-card')).toHaveCount(1);
  await page.goto('/account/wishlist');
  await expect(page.locator('.product-card')).toHaveCount(1);

  // Review: pending moderation, so not public yet.
  await page.goto(productPath);
  await page.getByLabel('Headline').fill('Sharp and bright');
  await page
    .getByLabel(/Your review/)
    .fill('Text is crisp and colors are accurate out of the box.');
  await page.getByRole('button', { name: 'Submit review' }).click();
  await expect(
    page.getByText('Your review will appear once our team has checked it'),
  ).toBeVisible();
});
