import { type SavedAddress, US_STATES } from '@nixzora/validation';

/** The fields of one address (used to add and to edit). */
export function AddressFields({ address }: { address?: SavedAddress }) {
  const id = address?.id ?? 'new';
  return (
    <>
      <label>
        Label <span className="hint">Optional: Home, Work, Other or your own.</span>
        <input
          name="label"
          list={`address-labels-${id}`}
          defaultValue={address?.label ?? ''}
          maxLength={40}
        />
        <datalist id={`address-labels-${id}`}>
          <option value="Home" />
          <option value="Work" />
          <option value="Other" />
        </datalist>
      </label>
      <label>
        Full name
        <input
          name="fullName"
          defaultValue={address?.fullName}
          required
          maxLength={120}
          autoComplete="name"
        />
      </label>
      <label>
        Street address
        <input
          name="line1"
          defaultValue={address?.line1}
          required
          maxLength={200}
          autoComplete="address-line1"
        />
      </label>
      <label>
        Apartment, suite, unit <span className="hint">Optional.</span>
        <input
          name="line2"
          defaultValue={address?.line2 ?? ''}
          maxLength={200}
          autoComplete="address-line2"
        />
      </label>
      <div className="form-row">
        <label>
          City
          <input
            name="city"
            defaultValue={address?.city}
            required
            maxLength={100}
            autoComplete="address-level2"
          />
        </label>
        <label>
          State
          <select
            name="region"
            defaultValue={address?.region ?? ''}
            required
            autoComplete="address-level1"
          >
            <option value="" disabled>
              Choose
            </option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          ZIP code
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
        Phone <span className="hint">Optional, for the courier.</span>
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
        Use as my default delivery address
      </label>
    </>
  );
}
