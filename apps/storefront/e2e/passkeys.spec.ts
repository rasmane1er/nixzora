import { expect, test } from '@playwright/test';
import { signUp } from './sign-up';

/**
 * A shopper adds a passkey and signs in with it. Chromium's virtual authenticator stands in for
 * Touch ID / Windows Hello: it holds the key and "passes" the fingerprint check.
 */
test('a shopper adds a passkey and signs in with it instead of a password', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'The virtual authenticator is a Chromium feature.');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  const run = Date.now().toString(36);
  const email = `passkey-${run}@example.com`;
  await page.goto('/account/register?next=/account/security');
  await signUp(page, { firstName: 'Grace', email });
  await page.waitForURL(/\/account\/security/);

  await expect(page.getByText('No passkeys yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByText(/Passkey added/)).toBeVisible();
  const list = page.locator('#passkeys .devices');
  await expect(list.getByText(/not used yet/)).toBeVisible();

  // Signed out, the passkey signs in without the email or password.
  await page.context().clearCookies();
  await page.goto('/account/login?next=/account/security');
  await page.getByRole('button', { name: /Sign in with a passkey/ }).click();
  await page.waitForURL(/\/account\/security/);
  await expect(page.locator('#passkeys .devices').getByText(/last used/)).toBeVisible();
  // The session counts as two-step verified.
  await expect(page.locator('#devices')).toContainText('This device');

  // Removed, it is gone from the list.
  await page.getByRole('button', { name: /Remove passkey/ }).click();
  await expect(page.getByText('Passkey removed.')).toBeVisible();
  await expect(page.getByText('No passkeys yet.')).toBeVisible();
});
