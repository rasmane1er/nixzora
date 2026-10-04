import { expect, test } from '@playwright/test';
import { signUp } from './sign-up';

/** A customer opens a store through the six-step application, leaving and coming back midway. */
test('a customer applies to sell in six steps and can finish later', async ({ page }) => {
  const run = Date.now().toString(36);
  await page.goto('/account/register?next=/sell');
  await signUp(page, { firstName: 'Ada', email: `seller-${run}@example.com` });
  await page.waitForURL((url) => !url.pathname.includes('register'));

  await page.goto('/sell');
  await page.getByRole('link', { name: 'Start your application' }).click();

  // 1. Business: the server checks the step and keeps what was typed.
  await page.locator('form#form').evaluate((form) => form.setAttribute('novalidate', ''));
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(page.getByText('Check the highlighted fields.')).toBeVisible();
  await page.getByLabel(/Business type/).selectOption('LLC');
  await page.getByLabel(/Legal business name/).fill('Brightline Audio LLC');
  await page.getByLabel(/Store name/).fill(`Brightline ${run}`);
  await page.getByLabel(/Business category/).selectOption('audio');
  await page.getByLabel(/What do you sell/).fill('Desk speakers');
  await page.locator('input[name="address.line1"]').fill('1 Harbor St');
  await page.locator('input[name="address.city"]').fill('Baltimore');
  await page.locator('select[name="address.region"]').selectOption('MD');
  await page.locator('input[name="address.postalCode"]').fill('21202');
  await page.getByRole('button', { name: 'Continue →' }).click();

  // 2. Owner, then leave and come back.
  await page.getByLabel(/Legal first name/).fill('Ada');
  await page.getByLabel(/Legal last name/).fill('Lovelace');
  await page.getByLabel(/Date of birth/).fill('1990-05-02');
  await page.getByLabel(/Phone number/).fill('+1 410 555 0100');
  await page.getByRole('button', { name: 'Save & continue later' }).click();
  await expect(page.getByText('Saved. Continue your application any time.')).toBeVisible();
  await page.getByRole('link', { name: /Continue your application \(33% complete\)/ }).click();
  await expect(page.getByLabel(/Date of birth/)).toHaveValue('1990-05-02');
  await page.getByRole('button', { name: 'Continue →' }).click();

  // 3–5. Store, shipping and returns, fees.
  await page.getByLabel(/About your store/).fill('Desk speakers, tuned in Baltimore.');
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByLabel(/I have read and agree/).check();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByLabel('Item price').fill('100');
  await expect(page.locator('#fee-result')).toContainText('$88.00');
  await page.getByLabel(/I understand the seller fees/).check();
  await page.getByRole('button', { name: 'Continue →' }).click();

  // 6. Submit stays disabled until every agreement is checked.
  const submit = page.getByRole('button', { name: /Submit application/ });
  await expect(submit).toBeDisabled();
  await page.getByLabel(/Seller Agreement/).check();
  await page.getByLabel(/Return & Refund Policy/).check();
  await page.getByLabel(/information I provided is accurate/).check();
  await submit.click();

  await expect(page.getByRole('heading', { name: 'Seller application' })).toBeVisible();
  await expect(page.getByText('Waiting for verification')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Seller dashboard' })).toBeVisible();
});
