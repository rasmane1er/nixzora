'use server';

import {
  type SellerApplicationDraftView,
  type SellerBrandingUpload,
  type SellerView,
  type UploadTicket,
} from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import {
  assemble,
  checkStep,
  type DraftData,
  isStep,
  readStep,
  STEP_KEYS,
  stepIndex,
  type StepKey,
} from '@/lib/seller-onboarding';

const login = (path: string) => redirect(`/account/login?next=${encodeURIComponent(path)}`);

async function loadDraft(): Promise<SellerApplicationDraftView | null> {
  try {
    return await api<{ draft: SellerApplicationDraftView | null }>('/seller/application').then(
      (r) => r.draft,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) login('/sell/apply');
    throw error;
  }
}

async function saveDraft(step: StepKey, completed: StepKey[], data: DraftData) {
  await api('/seller/application', {
    method: 'PUT',
    body: { step: stepIndex(step) + 1, completed: [...new Set(completed)], data },
  });
}

/**
 * One step of the application. "continue" checks the step and moves on; "back" and "later" keep
 * whatever was typed (valid or not) and leave. Nothing typed is ever lost.
 */
export async function saveStep(form: FormData): Promise<void> {
  const step = String(form.get('step') ?? '');
  const intent = String(form.get('intent') ?? 'continue');
  if (!isStep(step)) redirect('/sell/apply');

  const draft = await loadDraft();
  const data = { ...((draft?.data ?? {}) as DraftData) };
  const values = readStep(step, form);
  data[step] = values;
  const check = checkStep(step, values, await getT('sellApply'));
  const errors = { ...(data.errors ?? {}) };
  delete errors[step];
  let completed = (draft?.completed ?? []).filter((k) => k !== step) as StepKey[];
  if (check.ok) completed = [...completed, step];

  if (intent === 'continue' && !check.ok) {
    data.errors = { ...errors, [step]: check.errors };
    await saveDraft(step, completed, data);
    redirect(`/sell/apply?step=${step}&error=1#form`);
  }
  data.errors = errors;

  const next =
    intent === 'back'
      ? STEP_KEYS[Math.max(0, stepIndex(step) - 1)]!
      : intent === 'continue'
        ? STEP_KEYS[Math.min(STEP_KEYS.length - 1, stepIndex(step) + 1)]!
        : step;
  await saveDraft(next, completed, data);
  if (intent === 'later') redirect('/sell?saved=1');
  redirect(`/sell/apply?step=${next}`);
}

/** The last step: agreements, then the store is created and the draft removed. */
export async function submitApplication(form: FormData): Promise<void> {
  const draft = await loadDraft();
  const data = { ...((draft?.data ?? {}) as DraftData) };
  data.review = readStep('review', form);
  const check = checkStep('review', data.review, await getT('sellApply'));
  if (!check.ok) {
    data.errors = { ...(data.errors ?? {}), review: check.errors };
    await saveDraft('review', (draft?.completed ?? []) as StepKey[], data);
    redirect('/sell/apply?step=review&error=1#form');
  }
  const result = assemble(data);
  if (!result.ok) {
    await saveDraft(result.step, (draft?.completed ?? []) as StepKey[], data);
    redirect(`/sell/apply?step=${result.step}&error=incomplete#form`);
  }
  try {
    await api<SellerView>('/seller/apply', { method: 'POST', body: result.application });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) login('/sell/apply?step=review');
    const message = errorMessage(error);
    // A taken store address belongs to the business step.
    if (/store address/i.test(message)) {
      data.errors = { ...(data.errors ?? {}), business: { handle: message } };
      await saveDraft('business', (draft?.completed ?? []) as StepKey[], data);
      redirect('/sell/apply?step=business&error=1#form');
    }
    redirect(`/sell/apply?step=review&message=${encodeURIComponent(message)}`);
  }
  revalidatePath('/sell');
  redirect('/sell?applied=1');
}

export async function discardApplication(): Promise<void> {
  await api('/seller/application', { method: 'DELETE' });
  redirect('/sell');
}

/** An upload slot for the logo or banner; the browser sends the file straight to storage. */
export async function requestBrandingUpload(
  input: SellerBrandingUpload,
): Promise<{ ok: true; data: UploadTicket } | { ok: false; error: string }> {
  try {
    const data = await api<UploadTicket>('/seller/branding/upload', {
      method: 'POST',
      body: input,
    });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
