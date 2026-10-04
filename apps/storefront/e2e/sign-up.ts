import { type Page } from '@playwright/test';

export const PASSWORD = 'correct horse battery staple';

/** Fills the sign-up form the way a customer does and submits it. */
export async function signUp(
  page: Page,
  {
    firstName,
    lastName = 'Tester',
    email,
  }: { firstName: string; lastName?: string; email: string },
): Promise<void> {
  await page.getByLabel(/^First name/).fill(firstName);
  await page.getByLabel(/^Last name/).fill(lastName);
  await page.getByLabel(/^Email address/).fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel(/^Confirm password/).fill(PASSWORD);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
}
