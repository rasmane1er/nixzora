import { DEAL_MAX_PERCENT, DEAL_MIN_PERCENT } from '@nixzora/validation';
import { getT } from '@/lib/i18n';
import { TimezoneOffset } from './TimezoneOffset';

/** The "New deal" form in the seller portal. */
export async function DealForm({
  products,
  action,
}: {
  products: { id: string; title: string }[];
  action: (form: FormData) => Promise<void>;
}) {
  const t = await getT('deals');
  return (
    <form action={action} className="card form deal-form">
      <h3>{t('newDeal')}</h3>
      <TimezoneOffset />
      <div className="form-row">
        <label>
          {t('product')}
          <select name="productId" required defaultValue="">
            <option value="" disabled>
              {t('chooseProduct')}
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('audience')}
          <select name="audience" defaultValue="EVERYONE">
            <option value="EVERYONE">{t('audience_EVERYONE')}</option>
            <option value="PLUS">{t('audience_PLUS')}</option>
          </select>
        </label>
        <label>
          {t('kind')}
          <select name="kind" defaultValue="DAY">
            <option value="DAY">{t('kind_DAY')}</option>
            <option value="LIGHTNING">{t('kind_LIGHTNING')}</option>
          </select>
        </label>
        <label>
          {t('percent')}
          <input
            name="percentOff"
            type="number"
            min={DEAL_MIN_PERCENT}
            max={DEAL_MAX_PERCENT}
            defaultValue={20}
            required
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          {t('starts')}
          <input name="startsAt" type="datetime-local" required />
        </label>
        <label>
          {t('ends')}
          <input name="endsAt" type="datetime-local" required />
        </label>
        <label>
          {t('quantity')}
          <input name="quantity" type="number" min={1} max={100000} />
          <span className="muted" style={{ fontSize: 13 }}>
            {t('quantityHint')}
          </span>
        </label>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        {t('timesHint')}
      </p>
      <div>
        <button className="btn btn--primary" type="submit">
          {t('schedule')}
        </button>
      </div>
    </form>
  );
}
