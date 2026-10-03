import { rich } from '@nixzora/i18n';
import {
  BUSINESS_TYPES,
  HANDLING_DAYS,
  type MeResponse,
  SELLER_CARRIER_LABEL,
  SELLER_CARRIERS,
  SELLER_CATEGORIES,
  SELLER_ONBOARDING_STEPS,
  type SellerApplicationDraftView,
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
import { getFormat, getT } from '@/lib/i18n';
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellApply');
  return { title: t('metaTitle'), robots: { index: false } };
}

const COMMISSION_BPS = 1200;

type Values = Record<string, unknown>;
const str = (values: Values | undefined, key: string): string => {
  const value = key.split('.').reduce<unknown>((v, k) => (v as Values | undefined)?.[k], values);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};
const list = (values: Values | undefined, key: string): string[] =>
  Array.isArray(values?.[key]) ? (values[key] as string[]) : [];

/** "Public on your store" / "Private" beside a field name. */
async function Visibility({ pub }: { pub?: boolean }) {
  const t = await getT('sellApply');
  return (
    <span className={`visibility ${pub ? 'visibility--public' : ''}`}>
      {pub ? t('visibilityPublic') : t('visibilityPrivate')}
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

async function Progress({
  current,
  draft,
}: {
  current: StepKey;
  draft: SellerApplicationDraftView | null;
}) {
  const t = await getT('sellApply');
  const done = new Set(draft?.completed ?? []);
  const percent = percentDone(draft);
  return (
    <nav className="onboarding-progress" aria-label={t('stepsLabel')}>
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
                  <span className="onboarding-progress__label">{t(`step_${step.key}`)}</span>
                </Link>
              ) : (
                <span aria-current={step.key === current ? 'step' : undefined}>
                  <span className="onboarding-progress__n">
                    {state === 'done' ? '✓' : index + 1}
                  </span>
                  <span className="onboarding-progress__label">{t(`step_${step.key}`)}</span>
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
        aria-label={t('progressLabel')}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="onboarding-progress__percent">{t('percentComplete', { percent })}</p>
    </nav>
  );
}

async function StepButtons({ step }: { step: StepKey }) {
  const t = await getT('sellApply');
  const first = stepIndex(step) === 0;
  return (
    <div className="onboarding-actions">
      {first ? null : (
        <button className="btn btn--ghost" type="submit" name="intent" value="back" formNoValidate>
          {t('back')}
        </button>
      )}
      <button
        className="btn btn--secondary"
        type="submit"
        name="intent"
        value="later"
        formNoValidate
      >
        {t('saveLater')}
      </button>
      <button className="btn btn--primary" type="submit" name="intent" value="continue">
        {t('continue')}
      </button>
    </div>
  );
}

async function BusinessStep({ v, errors }: { v?: Values; errors: Record<string, string> }) {
  const t = await getT('sellApply');
  const tc = await getT('common');
  const td = await getT('departments');
  return (
    <>
      <h2>{t('businessTitle')}</h2>
      <div className="form-row">
        <label>
          <span>
            {t('businessType')} <Visibility />
          </span>
          <select
            name="businessType"
            defaultValue={str(v, 'businessType')}
            required
            aria-invalid={Boolean(errors.businessType)}
          >
            <option value="" disabled>
              {t('choose')}
            </option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`businessType_${type}`)}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="businessType" />
        </label>
        <label>
          <span>
            {t('legalBusinessName')} <Visibility />
          </span>
          <input
            name="legalName"
            defaultValue={str(v, 'legalName')}
            required
            maxLength={120}
            placeholder="Brightline Audio LLC"
            aria-invalid={Boolean(errors.legalName)}
          />
          <span className="hint">{t('legalNameHint')}</span>
          <FieldError errors={errors} name="legalName" />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>
            {t('storeNameDba')} <Visibility pub />
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
            {t('storeAddress')} <Visibility pub />
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
          <span className="hint">{t('handleHint')}</span>
          <FieldError errors={errors} name="handle" />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>
            {t('businessCategory')} <Visibility pub />
          </span>
          <select
            name="category"
            defaultValue={str(v, 'category')}
            required
            aria-invalid={Boolean(errors.category)}
          >
            <option value="" disabled>
              {t('choose')}
            </option>
            {SELLER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {td(c)}
              </option>
            ))}
          </select>
          <FieldError errors={errors} name="category" />
        </label>
        <label>
          <span>
            {t('businessWebsite')} <Visibility pub />
          </span>
          <input
            name="website"
            type="url"
            defaultValue={str(v, 'website')}
            placeholder="https://"
            aria-invalid={Boolean(errors.website)}
          />
          <span className="hint">{tc('optional')}</span>
          <FieldError errors={errors} name="website" />
        </label>
      </div>
      <label>
        <span>
          {t('whatYouSell')} <Visibility />
        </span>
        <input
          name="whatYouSell"
          defaultValue={str(v, 'whatYouSell')}
          required
          maxLength={300}
          placeholder={t('whatYouSellPlaceholder')}
          aria-invalid={Boolean(errors.whatYouSell)}
        />
        <FieldError errors={errors} name="whatYouSell" />
      </label>

      <fieldset className="stack" style={{ gap: 12 }}>
        <legend>
          {t('businessAddress')} <Visibility />
        </legend>
        <label>
          {t('country')}
          <select name="address.country" defaultValue="US" disabled>
            <option value="US">{t('unitedStates')}</option>
          </select>
          <span className="hint">{t('usBusinessesOnly')}</span>
        </label>
        <label>
          {t('streetAddress')}
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
          {t('suiteUnit')} <span className="hint">{tc('optional')}</span>
          <input
            name="address.line2"
            defaultValue={str(v, 'address.line2')}
            autoComplete="address-line2"
          />
        </label>
        <div className="form-row form-row--3">
          <label>
            {t('city')}
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
            {t('state')}
            <select
              name="address.region"
              defaultValue={str(v, 'address.region')}
              required
              aria-invalid={Boolean(errors['address.region'])}
            >
              <option value="" disabled>
                {t('choose')}
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
            {t('zip')}
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

async function OwnerStep({ v, errors }: { v?: Values; errors: Record<string, string> }) {
  const t = await getT('sellApply');
  return (
    <>
      <h2>{t('ownerTitle')}</h2>
      <p className="banner banner--info">{t('ownerBanner')}</p>
      <div className="form-row">
        <label>
          <span>
            {t('firstName')} <Visibility />
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
            {t('lastName')} <Visibility />
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
            {t('dateOfBirth')} <Visibility />
          </span>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={str(v, 'dateOfBirth')}
            required
            autoComplete="bday"
            aria-invalid={Boolean(errors.dateOfBirth)}
          />
          <span className="hint">{t('dobHint')}</span>
          <FieldError errors={errors} name="dateOfBirth" />
        </label>
        <label>
          <span>
            {t('phone')} <Visibility />
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
        {t('residence')}
        <select name="residenceCountry" defaultValue="US" disabled>
          <option value="US">{t('unitedStates')}</option>
        </select>
      </label>
    </>
  );
}

async function StoreStep({
  v,
  errors,
  email,
}: {
  v?: Values;
  errors: Record<string, string>;
  email: string;
}) {
  const t = await getT('sellApply');
  const tc = await getT('common');
  return (
    <>
      <h2>{t('storeTitle')}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {t('storeLead')}
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
          {t('aboutStore')} <Visibility pub />
        </span>
        <textarea
          name="description"
          rows={4}
          defaultValue={str(v, 'description')}
          required
          minLength={20}
          maxLength={1000}
          placeholder={t('aboutPlaceholder')}
          aria-invalid={Boolean(errors.description)}
        />
        <FieldError errors={errors} name="description" />
      </label>
      <div className="form-row">
        <label>
          <span>
            {t('supportEmail')} <Visibility pub />
          </span>
          <input
            name="supportEmail"
            type="email"
            defaultValue={str(v, 'supportEmail')}
            aria-invalid={Boolean(errors.supportEmail)}
          />
          <span className="hint">{t('supportEmailHint')}</span>
          <FieldError errors={errors} name="supportEmail" />
        </label>
        <label>
          <span>
            {t('supportPhone')} <Visibility pub />
          </span>
          <input
            name="supportPhone"
            type="tel"
            defaultValue={str(v, 'supportPhone')}
            aria-invalid={Boolean(errors.supportPhone)}
          />
          <span className="hint">{tc('optional')}</span>
          <FieldError errors={errors} name="supportPhone" />
        </label>
      </div>
      <label>
        <span>
          {t('contactEmail')} <Visibility />
        </span>
        <input
          name="contactEmail"
          type="email"
          defaultValue={str(v, 'contactEmail')}
          placeholder={email}
          aria-invalid={Boolean(errors.contactEmail)}
        />
        <span className="hint">{t('contactEmailHint', { email })}</span>
        <FieldError errors={errors} name="contactEmail" />
      </label>
    </>
  );
}

async function ShippingStep({ v, errors }: { v?: Values; errors: Record<string, string> }) {
  const t = await getT('sellApply');
  const carriers = v ? list(v, 'carriers') : ['USPS', 'UPS'];
  const regions = v ? list(v, 'shipRegions') : ['US_CONTIGUOUS'];
  return (
    <>
      <h2>{t('shippingTitle')}</h2>
      <div className="form-row">
        <label>
          {t('shippingFrom')}
          <input value={t('shippingFromValue')} readOnly disabled />
          <span className="hint">{t('shippingFromHint')}</span>
        </label>
        <label>
          {t('shippedWithin')}
          <select name="handlingDays" defaultValue={str(v, 'handlingDays') || '2'}>
            {HANDLING_DAYS.map((d) => (
              <option key={d} value={d}>
                {t('businessDays', { count: d })}
              </option>
            ))}
          </select>
          <span className="hint">{t('handlingHint')}</span>
        </label>
      </div>
      <fieldset aria-invalid={Boolean(errors.carriers)}>
        <legend>
          {t('carriersYouUse')} <Visibility />
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
              <span>{c === 'OTHER' ? t('carrier_OTHER') : SELLER_CARRIER_LABEL[c]}</span>
            </label>
          ))}
        </div>
        <FieldError errors={errors} name="carriers" />
      </fieldset>
      <fieldset aria-invalid={Boolean(errors.shipRegions)}>
        <legend>{t('shippingRegions')}</legend>
        <div className="check-grid">
          {SHIP_REGIONS.map((r) => (
            <label key={r} className="check">
              <input
                type="checkbox"
                name="shipRegions"
                value={r}
                defaultChecked={regions.includes(r)}
              />
              <span>{t(`region_${r}`)}</span>
            </label>
          ))}
          <label className="check" aria-disabled="true">
            <input type="checkbox" disabled />
            <span className="muted">{t('international')}</span>
          </label>
        </div>
        <FieldError errors={errors} name="shipRegions" />
      </fieldset>

      <h2 id="returns">{t('returnsTitle')}</h2>
      <div className="returns-box">
        <p style={{ margin: 0 }}>
          {rich(t('returnsIntro'), { b: (chunk) => <strong key="b">{chunk}</strong> })}
        </p>
        <ul className="ticks">
          <li>{t('returnsTick1')}</li>
          <li>{t('returnsTick2')}</li>
          <li>{t('returnsTick3')}</li>
          <li>{t('returnsTick4')}</li>
        </ul>
        <Link href="/policies/sellers#returns" target="_blank">
          {t('viewReturnPolicy')}
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
          {t('acceptReturns')}
          <FieldError errors={errors} name="acceptReturnPolicy" />
        </span>
      </label>
    </>
  );
}

async function PaymentsStep({ v, errors }: { v?: Values; errors: Record<string, string> }) {
  const t = await getT('sellApply');
  const f = await getFormat();
  const rate = f.percent(COMMISSION_BPS / 10_000);
  return (
    <>
      <h2>{t('feesTitle')}</h2>
      <div className="fee-headline">
        <strong>{rate}</strong>
        <span>{t('perSale')}</span>
      </div>
      <FeeCalculator commissionBps={COMMISSION_BPS} />
      <table className="fee-rules">
        <tbody>
          <tr>
            <th scope="row">{t('itemPrice')}</th>
            <td>{t('itemPriceRule', { rate })}</td>
          </tr>
          <tr>
            <th scope="row">{t('shipping')}</th>
            <td>{t('shippingRule')}</td>
          </tr>
          <tr>
            <th scope="row">{t('salesTax')}</th>
            <td>{t('salesTaxRule')}</td>
          </tr>
          <tr>
            <th scope="row">{t('coupons')}</th>
            <td>{t('couponsRule')}</td>
          </tr>
          <tr>
            <th scope="row">{t('refunds')}</th>
            <td>{t('refundsRule')}</td>
          </tr>
          <tr>
            <th scope="row">{t('cancelledOrders')}</th>
            <td>{t('cancelledRule')}</td>
          </tr>
          <tr>
            <th scope="row">{t('cardProcessing')}</th>
            <td>{t('cardRule')}</td>
          </tr>
        </tbody>
      </table>
      <Link href="/policies/sellers#fees" target="_blank">
        {t('viewFeeSchedule')}
      </Link>

      <h2>{t('paymentsTitle')}</h2>
      <div className="stripe-box">
        <p style={{ margin: 0 }}>
          {rich(t('stripeIntro'), { b: (chunk) => <strong key="b">{chunk}</strong> })}
        </p>
        <ul className="ticks">
          <li>{t('stripeTick1')}</li>
          <li>{t('stripeTick2')}</li>
          <li>{t('stripeTick3')}</li>
          <li>{t('stripeTick4')}</li>
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
          {t('acknowledgeFees')}
          <FieldError errors={errors} name="acknowledgeFees" />
        </span>
      </label>
    </>
  );
}

async function Summary({ data }: { data: DraftData }) {
  const t = await getT('sellApply');
  const tc = await getT('common');
  const td = await getT('departments');
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
        <Link href={`/sell/apply?step=${step}`}>{tc('edit')}</Link>
      </header>
      <dl>{rows}</dl>
    </section>
  );
  const businessType = str(b, 'businessType');
  const category = str(b, 'category');
  const handlingDays = str(sh, 'handlingDays');
  return (
    <div className="stack" style={{ gap: 12 }}>
      {section(
        'business',
        t('step_business'),
        <>
          {row(
            t('businessType'),
            (BUSINESS_TYPES as readonly string[]).includes(businessType)
              ? t(`businessType_${businessType as (typeof BUSINESS_TYPES)[number]}`)
              : '',
          )}
          {row(t('summaryLegalName'), str(b, 'legalName'))}
          {row(t('summaryStoreName'), str(b, 'displayName'))}
          {row(
            t('summaryCategory'),
            (SELLER_CATEGORIES as readonly string[]).includes(category)
              ? td(category as (typeof SELLER_CATEGORIES)[number])
              : '',
          )}
          {row(t('summaryWebsite'), str(b, 'website'))}
          {row(
            t('summaryAddress'),
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
        t('summarySeller'),
        <>
          {row(t('summaryName'), `${str(o, 'firstName')} ${str(o, 'lastName')}`.trim())}
          {row(t('dateOfBirth'), str(o, 'dateOfBirth') ? t('dobProvided') : '')}
          {row(t('summaryPhone'), str(o, 'phone'))}
        </>,
      )}
      {section(
        'store',
        t('step_store'),
        <>
          {row(t('summaryLogo'), str(s, 'logoUrl') ? t('uploaded') : t('noneYet'))}
          {row(t('summaryBanner'), str(s, 'bannerUrl') ? t('uploaded') : t('noneYet'))}
          {row(t('summaryAbout'), str(s, 'description'))}
          {row(t('summarySupportEmail'), str(s, 'supportEmail'))}
        </>,
      )}
      {section(
        'shipping',
        t('step_shipping'),
        <>
          {row(
            t('shipsWithin'),
            handlingDays ? t('businessDays', { count: Number(handlingDays) }) : '',
          )}
          {row(t('summaryCarriers'), list(sh, 'carriers').join(', '))}
          {row(t('returnPolicy'), sh?.acceptReturnPolicy ? t('accepted') : t('notAcceptedYet'))}
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
  const t = await getT('sellApply');

  return (
    <div className="wrap section onboarding">
      <div className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t('stepOf', { n: index + 1, total: STEP_KEYS.length })}
        </p>
      </div>
      <Progress current={step} draft={draft} />

      {param(params, 'error') === 'incomplete' ? (
        <p className="banner banner--error" role="alert">
          {t('incomplete')}
        </p>
      ) : Object.keys(errors).length ? (
        <p className="banner banner--error" role="alert">
          {t('checkFields')}
        </p>
      ) : null}
      {message ? (
        <p className="banner banner--error" role="alert">
          {message}
        </p>
      ) : null}

      {step === 'review' ? (
        <form id="form" action={submitApplication} className="card form stack">
          <h2>{t('reviewTitle')}</h2>
          <Summary data={data} />
          <h2>{t('agreementTitle')}</h2>
          <AgreementSubmit errors={errors} />
          <p className="hint" style={{ margin: 0 }}>
            {t('submitHint')}
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
            {t('discard')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
