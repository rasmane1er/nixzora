import { expect, test } from '@playwright/test';

/**
 * The Phase 6 exit test: a shopper describes a need in their own words, gets a grounded,
 * compared shortlist from the live catalog, refines it, and adds a pick to the cart.
 */
test('a shopper asks the assistant and adds a pick to the cart', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('searchbox', { name: 'Describe what you need' })
    .fill('A quiet laptop for coding under $1,500');
  await page.getByRole('button', { name: 'Find it' }).click();
  await expect(page).toHaveURL(/\/assistant\?q=/);

  const answer = page.locator('.answer').first();
  await expect(answer).toBeVisible({ timeout: 20_000 });
  await expect(answer.getByLabel('What the assistant understood')).toContainText('Laptops');
  await expect(answer.getByLabel('What the assistant understood')).toContainText('$1,500');
  await expect(answer.locator('.pick').first()).toContainText('Best match');
  await expect(answer.getByRole('table')).toContainText('Price');

  // Every price shown is within the budget.
  const prices = await answer.locator('.pick .price__now').allInnerTexts();
  for (const text of prices) {
    const amount = Number(text.replace(/[^0-9.]/g, ''));
    if (amount) expect(amount).toBeLessThanOrEqual(1500);
  }

  // A follow-up refines the same conversation.
  await page.getByRole('textbox', { name: 'Message the assistant' }).fill('actually under $950');
  await page.getByRole('button', { name: 'Send' }).click();
  const refined = page.locator('.answer').nth(1);
  await expect(refined).toBeVisible({ timeout: 20_000 });
  await expect(refined.getByLabel('What the assistant understood')).toContainText('$950');

  // Adding a pick uses the normal cart.
  await refined
    .getByRole('button', { name: /^Add .* to cart$/ })
    .first()
    .click();
  await expect(refined.getByRole('button', { name: /Added/ }).first()).toBeVisible();
  await expect(page.locator('.cart-count')).not.toHaveText('0');
});
