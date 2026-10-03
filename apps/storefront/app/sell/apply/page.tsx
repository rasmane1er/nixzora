import {
  BUSINESS_TYPE_LABEL,
  BUSINESS_TYPES,
  HANDLING_DAYS,
  type MeResponse,
  SELLER_CARRIER_LABEL,
  SELLER_CARRIERS,
  SELLER_CATEGORIES,
  SELLER_CATEGORY_LABEL,
  SELLER_ONBOARDING_STEPS,
  type SellerApplicationDraftView,
  SHIP_REGION_LABEL,
  SHIP_REGIONS,
  US_STATES,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AgreementSubmit } from '@/components/AgreementSubmit';
import { BrandingUpload } from '@/components/BrandingUpload';
import { FeeCalculator } from '@/components/FeeCalculator';
import { api } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { sellerMe } from '@/lib/sell';
import {
  type DraftData,
  isStep,
  percentDone,
  STEP_KEYS,
  stepIndex,
  type StepKey,
} from '@/lib/seller-onboarding';
import { discardApplication, saveStep, submitApplication } from './actions';

export const metadata: Metadata = { title: 'Open your store', robots: { index: false } };

const COMMISSION_BPS = 1200;

type Values = Record<string, unknown>;
const str = (values: Values | undefined, key: string): string => {
  const value = key.split('.').reduce<unknown>((v, k) => (v as Values | undefined)?.[k], values);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};
const list = (values: Values | undefined, key: string): string[] =>
  Array.isArray(values?.[key]) ? (values[key] as string[]) : [];

/** "Public on your store" / "Private" beside a field name. */
function Visibility({ pub }: { pub?: boolean }) {
  return (
    <span className={`visibility ${pub ? 'visibility--public' : ''}`}>
      {pub ? 'Public on your store' : 'Private'}
    </span>
  );
}

function FieldError({ errors, name }: { errors: Record<string, string>; name: string }) {
  return errors[name] ? (
    <span className="field-error" id={`${name}-error`}>
      {errors[name]}
    </span>
  ) : null;
}

function Progress({
  current,
  draft,
}: {
  current: StepKey;
  draft: SellerApplicationDraftView | null;
}) {
  const done = new Set(draft?.completed ?? []);
  const percent = percentDone(draft);
  return (
    <nav className="onboarding-progress" aria-label="Application steps">
      <ol>
        {SELLER_ONBOARDING_STEPS.map((step, index) => {
          const state = step.key === current ? 'current' : done.has(step.key) ? 'done' : 'todo';
          const reachable = done.has(step.key) || index <= stepIndex(current);
          return (
            <li key={step.key} data-state={state}>
              {reachable && step.key !== current ? (
                <Link href={`/sell/apply?step=${step.key}`}>
                  <span className="onboarding-progress__n">
                    {state === 'done' ? '✓' : index + 1}
                  </span>
                  <span className="onboarding-progress__label">{step.title}</span>
                </Link>
              ) : (
                <span aria-current={step.key === current ? 'step' : undefined}>
                  <span className="onboarding-progress__n">
                    {state === 'done' ? '✓' : index + 1}
                  </span>
                  <span className="onboarding-progress__label">{step.title}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div
        className="onboarding-progress__bar"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Application complete"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="onboarding-progress__percent">{percent}% complete</p>
    </nav>
  );
}

function StepButtons({ step }: { step: StepKey }) {
  const first = stepIndex(step) === 0;
  return (
    <div className="onboarding-actions">
      {first ? null : (
        <button className="btn btn--ghost" type="submit" name="intent" value="back" formNoValidate>
          ← Back
        </button>
      )}
      <button
        className="btn btn--secondary"
        type="submit"
        name="intent"
        value="later"
        formNoValidate
      >
        Save &amp; continue later
      </button>
      <button className="btn btn--primary" type="submit" name="intent" value="continue">
        Continue →
      </button>
    </div>
  );
}

function BusinessStep({ v, errors }: { v?: Values; errors: Record<string, string> }) {
  return (
    <>
      <h2>Business information</h2>
      <div className="form-row">
        <label>
          <span>
            Business type <Visibility />
          </span>
          <select
            name="businessType"
            defaultValue={str(v, 'businessType')}
            required
            aria-invalid={Boolean(errors.businessType)}
          >
            <option value="" disabled>
              Choose…
            </option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {BUSINESS_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="businessType" />
        </label>
        <label>
          <span>
            Legal business name <Visibility />
          </span>
          <input
            name="legalName"
            defaultValue={str(v, 'legalName')}
            required
            maxLength={120}
            placeholder="Brightline Audio LLC"
            aria-invalid={Boolean(errors.legalName)}
          />
          <span className="hint">As registered. For a sole proprietor, your legal name.</span>
          <FieldError errors={errors} name="legalName" />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>
            Store name (DBA) <Visibility pub />
          </span>
          <input
            name="displayName"
            defaultValue={str(v, 'displayName')}
            required
            minLength={2}
            maxLength={60}
            placeholder="Brightline Audio"
            aria-invalid={Boolean(errors.displayName)}
          />
          <FieldError errors={errors} name="displayName" />
        </label>
        <label>
          <span>
            Store address <Visibility pub />
          </span>
          <input
            name="handle"
            defaultValue={str(v, 'handle')}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            minLength={3}
            maxLength={40}
            placeholder="brightline-audio"
            aria-invalid={Boolean(errors.handle)}
          />
          <span className="hint">
            Optional: nixzora.com/s/your-address. Made from the store name if empty.
          </span>
          <FieldError errors={errors} name="handle" />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>
            Business category <Visibility pub />
          </span>
          <select
            name="category"
            defaultValue={str(v, 'category')}
            required
            aria-invalid={Boolean(errors.category)}
          >
            <option value="" disabled>
              Choose…
            </option>
            {SELLER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {SELLER_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="category" />
        </label>
        <label>
          <span>
            Business website <Visibility pub />
          </span>
          <input
            name="website"
            type="url"
            defaultValue={str(v, 'website')}
            placeholder="https://"
            aria-invalid={Boolean(errors.website)}
          />
          <span className="hint">Optional.</span>
          <FieldError errors={errors} name="website" />
        </label>
      </div>
      <label>
        <span>
          What do you sell? <Visibility />
        </span>
        <input
          name="whatYouSell"
          defaultValue={str(v, 'whatYouSell')}
          required
          maxLength={300}
          placeholder="Laptops, accessories, headphones…"
          aria-invalid={Boolean(errors.whatYouSell)}
        />
        <FieldError errors={errors} name="whatYouSell" />
      </label>

      <fieldset className="stack" style={{ gap: 12 }}>
        <legend>
          Business address <Visibility />
        </legend>
        <label>
          Country
          <select name="address.country" defaultValue="US" disabled>
            <option value="US">United States</option>
          </select>
          <span className="hint">NIXZORA supports US businesses for now.</span>
        </label>
        <label>
          Street address
          <input
            name="address.line1"
            defaultValue={str(v, 'address.line1')}
            required
            autoComplete="address-line1"
            aria-invalid={Boolean(errors['address.line1'])}
          />
          <FieldError errors={errors} name="address.line1" />
        </label>
        <label>
          Suite, unit <span className="hint">Optional.</span>
          <input
            name="address.line2"
            defaultValue={str(v, 'address.line2')}
            autoComplete="address-line2"
          />
        </label>
        <div className="form-row form-row--3">
          <label>
            City
            <input
              name="address.city"
              defaultValue={str(v, 'address.city')}
              required
              autoComplete="address-level2"
              aria-invalid={Boolean(errors['address.city'])}
            />
            <FieldError errors={errors} name="address.city" />
          </label>
          <label>
            State
            <select
              name="address.region"
              defaultValue={str(v, 'address.region')}
              required
              aria-invalid={Boolean(errors['address.region'])}
            >
              <option value="" disabled>
                Choose…
              </option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <FieldError errors={errors} name="address.region" />
          </label>
          <label>
            ZIP code
            <input
              name="address.postalCode"
              defaultValue={str(v, 'address.postalCode')}
              required
              inputMode="numeric"
              autoComplete="postal-code"
              aria-invalid={Boolean(errors['address.postalCode'])}
            />
            <FieldError errors={errors} name="address.postalCode" />
          </label>
        </div>
      </fieldset>
    </>
  );
}

function OwnerStep({ v, errors }: { v?: Values; errors: Record<string, string> }) {
  return (
    <>
      <h2>Seller information</h2>
      <p className="banner banner--info">
        Your information is used to verify your seller account and is never shown on your store.
      </p>
      <div className="form-row">
        <label>
          <span>
            Legal first name <Visibility />
          </span>
          <input
            name="firstName"
            defaultValue={str(v, 'firstName')}
            required
            autoComplete="given-name"
            aria-invalid={Boolean(errors.firstName)}
          />
          <FieldError errors={errors} name="firstName" />
        </label>
        <label>
          <span>
            Legal last name <Visibility />
          </span>
          <input
            name="lastName"
            defaultValue={str(v, 'lastName')}
            required
            autoComplete="family-name"
            aria-invalid={Boolean(errors.lastName)}
          />
          <FieldError errors={errors} name="lastName" />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>
            Date of birth <Visibility />
          </span>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={str(v, 'dateOfBirth')}
            required
            autoComplete="bday"
            aria-invalid={Boolean(errors.dateOfBirth)}
          />
          <span className="hint">Sellers must be 18 or older. Stored encrypted.</span>
          <FieldError errors={errors} name="dateOfBirth" />
        </label>
        <label>
          <span>
            Phone number <Visibility />
          </span>
          <input
            name="phone"
            type="tel"
            defaultValue={str(v, 'phone')}
            required
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
          />
          <FieldError errors={errors} name="phone" />
        </label>
      </div>
      <label>
        Country of residence
        <select name="residenceCountry" defaultValue="US" disabled>
          <option value="US">United States</option>
        </select>
      </label>
    </>
  );
}

function StoreStep({
  v,
  errors,
  email,
}: {
  v?: Values;
  errors: Record<string, string>;
  email: string;
}) {
  return (
    <>
      <h2>Store setup</h2>
      <p className="muted" style={{ margin: 0 }}>
        This is what shoppers see on your store page. You can change it later in Store settings.
      </p>
      <div className="stack" style={{ gap: 14 }}>
        <BrandingUpload kind="logo" keyValue={str(v, 'logoKey')} urlValue={str(v, 'logoUrl')} />
        <BrandingUpload
          kind="banner"
          keyValue={str(v, 'bannerKey')}
          urlValue={str(v, 'bannerUrl')}
        />
      </div>
      <label>
        <span>
          About your store <Visibility pub />
        </span>
        <textarea
          name="description"
          rows={4}
          defaultValue={str(v, 'description')}
          required
          minLength={20}
          maxLength={1000}
          placeholder="Premium desk speakers and amplifiers, tested and tuned in Baltimore."
          aria-invalid={Boolean(errors.description)}
        />
        <FieldError errors={errors} name="description" />
      </label>
      <div className="form-row">
        <label>
          <span>
            Customer support email <Visibility pub />
          </span>
          <input
            name="supportEmail"
            type="email"
            defaultValue={str(v, 'supportEmail')}
            aria-invalid={Boolean(errors.supportEmail)}
          />
          <span className="hint">Optional. Shown on your store.</span>
          <FieldError errors={errors} name="supportEmail" />
        </label>
        <label>
          <span>
            Customer support phone <Visibility pub />
          </span>
          <input
            name="supportPhone"
            type="tel"
            defaultValue={str(v, 'supportPhone')}
            aria-invalid={Boolean(errors.supportPhone)}
          />
          <span className="hint">Optional.</span>
          <FieldError errors={errors} name="supportPhone" />
        </label>
      </div>
      <label>
        <span>
          Email for NIXZORA <Visibility />
        </span>
        <input
          name="contactEmail"
          type="email"
          defaultValue={str(v, 'contactEmail')}
          placeholder={email}
          aria-invalid={Boolean(errors.contactEmail)}
        />
        <span className="hint">
          Where we send orders, payouts and policy updates. Defaults to {email}.
        </span>
        <FieldError errors={errors} name="contactEmail" />
      </label>
    </>
  );
}

function ShippingStep({ v, errors }: { v?: Values; errors: Record<string, string> }) {
  const carriers = v ? list(v, 'carriers') : ['USPS', 'UPS'];
  const regions = v ? list(v, 'shipRegions') : ['US_CONTIGUOUS'];
  return (
    <>
      <h2>Shipping</h2>
      <div className="form-row">
        <label>
          Shipping from
          <input value="Your business address, United States" readOnly disabled />
          <span className="hint">From the Business step.</span>
        </label>
        <label>
          Orders shipped within
          <select name="handlingDays" defaultValue={str(v, 'handlingDays') || '2'}>
            {HANDLING_DAYS.map((d) => (
              <option key={d} value={d}>
                {d} business {d === 1 ? 'day' : 'days'}
              </option>
            ))}
          </select>
          <span className="hint">NIXZORA&apos;s standard is 2 business days or faster.</span>
        </label>
      </div>
      <fieldset aria-invalid={Boolean(errors.carriers)}>
        <legend>
          Carriers you use <Visibility />
        </legend>
        <div className="check-grid">
          {SELLER_CARRIERS.map((c) => (
            <label key={c} className="check">
              <input
                type="checkbox"
                name="carriers"
                value={c}
                defaultChecked={carriers.includes(c)}
              />
              <span>{SELLER_CARRIER_LABEL[c]}</span>
            </label>
          ))}
        </div>
        <FieldError errors={errors} name="carriers" />
      </fieldset>
      <fieldset aria-invalid={Boolean(errors.shipRegions)}>
        <legend>Shipping regions</legend>
        <div className="check-grid">
          {SHIP_REGIONS.map((r) => (
            <label key={r} className="check">
              <input
                type="checkbox"
                name="shipRegions"
                value={r}
                defaultChecked={regions.includes(r)}
              />
              <span>{SHIP_REGION_LABEL[r]}</span>
            </label>
          ))}
          <label className="check" aria-disabled="true">
            <input type="checkbox" disabled />
            <span className="muted">International (not available yet)</span>
          </label>
        </div>
        <FieldError errors={errors} name="shipRegions" />
      </fieldset>

      <h2 id="returns">Returns &amp; refunds</h2>
      <div className="returns-box">
        <p style={{ margin: 0 }}>
          NIXZORA sellers follow the Marketplace Return Policy. Shoppers can return items within{' '}
          <strong>30 days</strong> of delivery.
        </p>
        <ul className="ticks">
          <li>Accept the returns NIXZORA approves under the policy</li>
          <li>Follow return requests for your items in your seller dashboard</li>
          <li>Refunds are issued by NIXZORA to the customer&apos;s card</li>
          <li>Follow NIXZORA&apos;s decision when a customer disputes an order</li>
        </ul>
        <Link href="/policies/sellers#returns" target="_blank">
          View the Seller Return Policy →
        </Link>
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="acceptReturnPolicy"
          defaultChecked={v?.acceptReturnPolicy === true}
          aria-invalid={Boolean(errors.acceptReturnPolicy)}
        />
        <span>
          I have read and agree to the NIXZORA Seller Return Policy.
          <FieldError errors={errors} name="acceptReturnPolicy" />
        </span>
      </label>
    </>
  );
}

function PaymentsStep({ v, errors }: { v?: Values; errors: Record<string, string> }) {
  return (
    <>
      <h2>Seller fees</h2>
      <div className="fee-headline">
        <strong>{COMMISSION_BPS / 100}%</strong>
        <span>per completed sale, on the item price</span>
      </div>
      <FeeCalculator commissionBps={COMMISSION_BPS} />
      <table className="fee-rules">
        <tbody>
          <tr>
            <th scope="row">Item price</th>
            <td>
              The {COMMISSION_BPS / 100}% commission applies here, at the price the item sold for.
            </td>
          </tr>
          <tr>
            <th scope="row">Shipping</th>
            <td>No commission. What the customer pays for shipping goes to you.</td>
          </tr>
          <tr>
            <th scope="row">Sales tax</th>
            <td>No commission. NIXZORA collects and remits it; it never reaches you.</td>
          </tr>
          <tr>
            <th scope="row">Coupons</th>
            <td>Paid by NIXZORA. You are paid on the price before the discount.</td>
          </tr>
          <tr>
            <th scope="row">Refunds</th>
            <td>The commission on the refunded amount is returned to you.</td>
          </tr>
          <tr>
            <th scope="row">Cancelled orders</th>
            <td>No fee: orders cancelled before shipping earn and cost nothing.</td>
          </tr>
          <tr>
            <th scope="row">Card processing</th>
            <td>No separate fee: NIXZORA pays the card processing cost.</td>
          </tr>
        </tbody>
      </table>
      <Link href="/policies/sellers#fees" target="_blank">
        View the complete fee schedule →
      </Link>

      <h2>Payments &amp; payouts</h2>
      <div className="stripe-box">
        <p style={{ margin: 0 }}>
          NIXZORA uses <strong>Stripe Connect</strong> to verify sellers and pay them. Right after
          you submit, you&apos;ll connect your Stripe account from your seller dashboard.
        </p>
        <ul className="ticks">
          <li>Secure payment processing</li>
          <li>Bank details and tax forms (W-9) handled by Stripe; NIXZORA never sees them</li>
          <li>Payouts to your bank once earnings clear the 14-day hold after shipping</li>
          <li>Identity verification</li>
        </ul>
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="acknowledgeFees"
          defaultChecked={v?.acknowledgeFees === true}
          aria-invalid={Boolean(errors.acknowledgeFees)}
        />
        <span>
          I understand the seller fees and that payouts go through Stripe Connect.
          <FieldError errors={errors} name="acknowledgeFees" />
        </span>
      </label>
    </>
  );
}

function Summary({ data }: { data: DraftData }) {
  const b = data.business;
  const o = data.owner;
  const s = data.store;
  const sh = data.shipping;
  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ) : null;
  const section = (step: StepKey, title: string, rows: React.ReactNode) => (
    <section className="review-section">
      <header>
        <h3>{title}</h3>
        <Link href={`/sell/apply?step=${step}`}>Edit</Link>
      </header>
      <dl>{rows}</dl>
    </section>
  );
  const businessType = str(b, 'businessType') as keyof typeof BUSINESS_TYPE_LABEL;
  const category = str(b, 'category') as keyof typeof SELLER_CATEGORY_LABEL;
  return (
    <div className="stack" style={{ gap: 12 }}>
      {section(
        'business',
        'Business',
        <>
          {row('Business type', BUSINESS_TYPE_LABEL[businessType])}
          {row('Legal name', str(b, 'legalName'))}
          {row('Store name', str(b, 'displayName'))}
          {row('Category', SELLER_CATEGORY_LABEL[category])}
          {row('Website', str(b, 'website'))}
          {row(
            'Address',
            [
              str(b, 'address.line1'),
              str(b, 'address.line2'),
              `${str(b, 'address.city')}, ${str(b, 'address.region')} ${str(b, 'address.postalCode')}`,
            ]
              .filter(Boolean)
              .join(', '),
          )}
        </>,
      )}
      {section(
        'owner',
        'Seller',
        <>
          {row('Name', `${str(o, 'firstName')} ${str(o, 'lastName')}`.trim())}
          {row('Date of birth', str(o, 'dateOfBirth') ? '••••-••-•• (provided)' : '')}
          {row('Phone', str(o, 'phone'))}
        </>,
      )}
      {section(
        'store',
        'Store',
        <>
          {row('Logo', str(s, 'logoUrl') ? 'Uploaded' : 'None yet')}
          {row('Banner', str(s, 'bannerUrl') ? 'Uploaded' : 'None yet')}
          {row('About', str(s, 'description'))}
          {row('Support email', str(s, 'supportEmail'))}
        </>,
      )}
      {section(
        'shipping',
        'Shipping & returns',
        <>
          {row(
            'Ships within',
            str(sh, 'handlingDays') ? `${str(sh, 'handlingDays')} business days` : '',
          )}
          {row('Carriers', list(sh, 'carriers').join(', '))}
          {row('Return policy', sh?.acceptReturnPolicy ? 'Accepted' : 'Not accepted yet')}
        </>,
      )}
    </div>
  );
}

export default async function ApplyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { seller } = await sellerMe('/sell/apply');
  if (seller) redirect('/sell');
  const [me, draft] = await Promise.all([
    api<MeResponse>('/auth/me'),
    api<{ draft: SellerApplicationDraftView | null }>('/seller/application').then((r) => r.draft),
  ]);
  const asked = param(params, 'step');
  const step: StepKey = isStep(asked)
    ? asked
    : (STEP_KEYS[Math.max(0, (draft?.step ?? 1) - 1)] ?? 'business');
  const data = (draft?.data ?? {}) as DraftData;
  const values = data[step];
  const errors = data.errors?.[step] ?? {};
  const message = param(params, 'message');
  const index = stepIndex(step);

  return (
    <div className="wrap section onboarding">
      <div className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">Sell on NIXZORA</p>
        <h1>Open your NIXZORA store</h1>
        <p className="muted" style={{ margin: 0 }}>
          Step {index + 1} of {STEP_KEYS.length}. Your answers are saved as you go.
        </p>
      </div>
      <Progress current={step} draft={draft} />

      {param(params, 'error') === 'incomplete' ? (
        <p className="banner banner--error" role="alert">
          This step still needs a few answers before you can submit.
        </p>
      ) : Object.keys(errors).length ? (
        <p className="banner banner--error" role="alert">
          Check the highlighted fields.
        </p>
      ) : null}
      {message ? (
        <p className="banner banner--error" role="alert">
          {message}
        </p>
      ) : null}

      {step === 'review' ? (
        <form id="form" action={submitApplication} className="card form stack">
          <h2>Review &amp; submit</h2>
          <Summary data={data} />
          <h2>Seller agreement</h2>
          <AgreementSubmit errors={errors} />
          <p className="hint" style={{ margin: 0 }}>
            By submitting, you agree to NIXZORA&apos;s Seller Terms and Policies. Our team reviews
            applications, usually within one business day.
          </p>
        </form>
      ) : (
        <form id="form" action={saveStep} className="card form stack" noValidate={false}>
          <input type="hidden" name="step" value={step} />
          {step === 'business' ? <BusinessStep v={values} errors={errors} /> : null}
          {step === 'owner' ? <OwnerStep v={values} errors={errors} /> : null}
          {step === 'store' ? <StoreStep v={values} errors={errors} email={me.email} /> : null}
          {step === 'shipping' ? <ShippingStep v={values} errors={errors} /> : null}
          {step === 'payments' ? <PaymentsStep v={values} errors={errors} /> : null}
          <StepButtons step={step} />
        </form>
      )}

      {draft ? (
        <form action={discardApplication} className="onboarding-discard">
          <button className="link-button" type="submit">
            Discard this application
          </button>
        </form>
      ) : null}
    </div>
  );
}
