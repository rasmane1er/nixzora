'use server';

import { api, errorMessage } from '@/lib/api';

/** Development only: confirms a test payment (the API refuses when real payments are on). */
export async function confirmTestPayment(
  clientSecret: string,
  outcome: 'succeeded' | 'failed',
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api('/payments/fake/confirm', {
      method: 'POST',
      auth: false,
      body: { clientSecret, outcome },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
