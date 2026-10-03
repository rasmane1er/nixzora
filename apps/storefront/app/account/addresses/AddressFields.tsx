import { type SavedAddress, US_STATES } from '@nixzora/validation';
import { getT } from '@/lib/i18n';

/** The fields of one address (used to add and to edit). */
export async function AddressFields({ address }: { address?: SavedAddress }) {
  const id = address?.id ?? 'new';
  const [t, tc] = await Promise.all([getT('account'), getT('common')]);
  return (
    <>
      <label>
        {t('label')} <span className="hint">{t('labelHint')}</span>
        <input
          name="label"
          list={`address-labels-${id}`}
          defaultValue={address?.label ?? ''}
          maxLength={40}
        />
        <datalist id={`address-labels-${id}`}>
          <option value={t('labelHome')} />
          <option value={t('labelWork')} />
          <option value={t('labelOther')} />
        </datalist>
      </label>
      <label>
        {t('fullName')}
        <input
          name="fullName"
          defaultValue={address?.fullName}
          required
          maxLength={120}
          autoComplete="name"
        />
      </label>
      <label>
        {t('streetAddress')}
        <input
          name="line1"
          defaultValue={address?.line1}
          required
          maxLength={200}
          autoComplete="address-line1"
        />
      </label>
      <label>
        {t('aptSuite')} <span className="hint">{tc('optional')}</span>
        <input
          name="line2"
          defaultValue={address?.line2 ?? ''}
          maxLength={200}
          autoComplete="address-line2"
        />
      </label>
      <div className="form-row">
        <label>
          {t('city')}
          <input
            name="city"
            defaultValue={address?.city}
            required
            maxLength={100}
            autoComplete="address-level2"
          />
        </label>
        <label>
          {t('state')}
          <select
            name="region"
            defaultValue={address?.region ?? ''}
            required
            autoComplete="address-level1"
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
        </label>
        <label>
          {t('zipCode')}
          <input
            name="postalCode"
            defaultValue={address?.postalCode}
            required
            inputMode="numeric"
            pattern="\d{5}(-\d{4})?"
            autoComplete="postal-code"
          />
        </label>
      </div>
      <label>
        {t('phone')} <span className="hint">{t('phoneHint')}</span>
        <input
          name="phone"
          type="tel"
          defaultValue={address?.phone ?? ''}
          maxLength={25}
          autoComplete="tel"
        />
      </label>
      <label className="check" htmlFor={`default-${id}`}>
        <input
          id={`default-${id}`}
          type="checkbox"
          name="isDefaultShipping"
          defaultChecked={address?.isDefaultShipping ?? false}
        />{' '}
        {t('useAsDefault')}
      </label>
    </>
  );
}
