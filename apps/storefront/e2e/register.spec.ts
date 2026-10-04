import { expect, test } from '@playwright/test';
import { PASSWORD, signUp } from './sign-up';

test('the sign-up form checks every field and keeps what was typed', async ({ page }) => {
  const run = Date.now().toString(36);
  await page.goto('/account/register');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Create your NIXZORA account' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why create an account?' })).toBeVisible();

  // The checklist follows the password as it is typed.
  await page.getByLabel(/^First name/).fill('Ada');
  await page.getByLabel(/^Password/).fill('ada is my name');
  const checks = page.getByRole('list', { name: 'Your password' });
  await expect(checks.getByText(/At least 12 characters/)).toHaveClass('is-met');
  await expect(checks.getByText('Not your name or email')).not.toHaveClass('is-met');
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await expect(checks.getByText('Not your name or email')).toHaveClass('is-met');
  await page.getByLabel(/^Confirm password/).fill(PASSWORD);
  await expect(checks.getByText('Both passwords match')).toHaveClass('is-met');
  await page.getByRole('button', { name: 'Show the password' }).first().click();
  await expect(page.getByLabel(/^Password/)).toHaveAttribute('type', 'text');

  // Missing last name, a bad number and no consent: nothing is sent, and nothing is lost.
  await page.getByLabel(/^Email address/).fill(`signup-${run}@example.com`);
  await page.getByLabel('Country code').selectOption('BF');
  await page.getByRole('textbox', { name: 'Mobile phone' }).fill('12');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert').first()).toHaveText('Check the highlighted fields.');
  await expect(page.getByText('Enter your last name.')).toBeVisible();
  await expect(page.getByText('Enter a valid mobile number, or leave it empty.')).toBeVisible();
  await expect(
    page.getByText('Agree to the Terms of Service and Privacy Policy to continue.'),
  ).toBeVisible();
  await expect(page.getByLabel(/^Email address/)).toHaveValue(`signup-${run}@example.com`);
  await expect(page.getByLabel(/^Password/)).toHaveValue(PASSWORD);

  // Fixed: the account is created with the number in international form.
  await page.getByRole('textbox', { name: 'Mobile phone' }).fill('70 12 34 56');
  await page.getByLabel(/Send me deals/).check();
  await signUp(page, {
    firstName: 'Ada',
    lastName: 'Ouédraogo',
    email: `signup-${run}@example.com`,
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Ada' })).toBeVisible();
  await page.goto('/account/profile');
  await expect(page.locator('input[name="phone"]')).toHaveValue('+22670123456');
});

test('the sign-up page speaks French', async ({ page }) => {
  await page.context().addCookies([{ name: 'nx_lang', value: 'fr', url: 'http://localhost:3000' }]);
  await page.goto('/account/register');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Créez votre compte NIXZORA' }),
  ).toBeVisible();
  await expect(page.getByLabel('Indicatif du pays')).toBeVisible();
});
