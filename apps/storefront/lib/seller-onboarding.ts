import {
  SELLER_ONBOARDING_STEPS,
  SELLER_STEP_SCHEMAS,
  SellerApplicationSchema,
  type SellerApplication,
  type SellerApplicationDraftView,
  type SellerOnboardingStep,
} from '@nixzora/validation';

export type StepKey = SellerOnboardingStep;
/** Raw form values per step, as typed (kept even when invalid, so nothing is lost). */
export type DraftData = Partial<Record<StepKey, Record<string, unknown>>> & {
  /** Field errors of the last attempt, by step and field. */
  errors?: Partial<Record<StepKey, Record<string, string>>>;
};

export const STEP_KEYS = SELLER_ONBOARDING_STEPS.map((s) => s.key) as StepKey[];

export function isStep(value: string | undefined): value is StepKey {
  return (STEP_KEYS as string[]).includes(value ?? '');
}

export const stepIndex = (key: StepKey) => STEP_KEYS.indexOf(key);

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

const optional = (value: string) => (value === '' ? undefined : value);

/** The form fields of one step, shaped like that step's schema. */
export function readStep(step: StepKey, form: FormData): Record<string, unknown> {
  switch (step) {
    case 'business':
      return {
        businessType: optional(text(form, 'businessType')),
        legalName: text(form, 'legalName'),
        displayName: text(form, 'displayName'),
        handle: optional(text(form, 'handle').toLowerCase()),
        category: optional(text(form, 'category')),
        whatYouSell: text(form, 'whatYouSell'),
        website: text(form, 'website'),
        address: {
          line1: text(form, 'address.line1'),
          line2: optional(text(form, 'address.line2')),
          city: text(form, 'address.city'),
          region: optional(text(form, 'address.region')),
          postalCode: text(form, 'address.postalCode'),
          country: 'US',
        },
      };
    case 'owner':
      return {
        firstName: text(form, 'firstName'),
        lastName: text(form, 'lastName'),
        dateOfBirth: text(form, 'dateOfBirth'),
        phone: text(form, 'phone'),
        residenceCountry: 'US',
      };
    case 'store':
      return {
        description: text(form, 'description'),
        logoKey: optional(text(form, 'logoKey')),
        bannerKey: optional(text(form, 'bannerKey')),
        // Shown back to the applicant in the form, then resolved to URLs on the store page.
        logoUrl: optional(text(form, 'logoUrl')),
        bannerUrl: optional(text(form, 'bannerUrl')),
        contactEmail: text(form, 'contactEmail'),
        supportEmail: text(form, 'supportEmail'),
        supportPhone: text(form, 'supportPhone'),
      };
    case 'shipping':
      return {
        handlingDays: Number(text(form, 'handlingDays') || 2),
        carriers: form.getAll('carriers').map(String),
        shipRegions: form.getAll('shipRegions').map(String),
        acceptReturnPolicy: form.get('acceptReturnPolicy') === 'on',
      };
    case 'payments':
      return { acknowledgeFees: form.get('acknowledgeFees') === 'on' };
    case 'review':
      return {
        acceptAgreement: form.get('acceptAgreement') === 'on',
        acceptReturnPolicy: form.get('acceptReturnPolicy') === 'on',
        confirmAccurate: form.get('confirmAccurate') === 'on',
      };
  }
}

/** Field errors keyed by the form field name ("address.city"). */
export function checkStep(step: StepKey, values: Record<string, unknown>) {
  const result = SELLER_STEP_SCHEMAS[step].safeParse(values);
  if (result.success) return { ok: true as const, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'form';
    errors[field] ??= issue.message;
  }
  return { ok: false as const, errors };
}

/** The full application from a draft, or the first step that still needs work. */
export function assemble(
  data: DraftData,
): { ok: true; application: SellerApplication } | { ok: false; step: StepKey } {
  for (const step of STEP_KEYS.slice(0, -1)) {
    if (!checkStep(step, data[step] ?? {}).ok) return { ok: false, step };
  }
  const store = { ...(data.store ?? {}) };
  delete store.logoUrl;
  delete store.bannerUrl;
  const parsed = SellerApplicationSchema.safeParse({
    ...data.business,
    owner: data.owner,
    ...store,
    ...data.shipping,
    ...data.payments,
    ...data.review,
  });
  return parsed.success ? { ok: true, application: parsed.data } : { ok: false, step: 'review' };
}

export function percentDone(draft: SellerApplicationDraftView | null): number {
  const done = new Set(draft?.completed ?? []);
  return Math.round((STEP_KEYS.filter((k) => done.has(k)).length / STEP_KEYS.length) * 100);
}
