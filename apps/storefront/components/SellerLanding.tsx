import { rich } from '@nixzora/i18n';
import Link from 'next/link';
import { getFormat, getT } from '@/lib/i18n';
import { AccountIcon, type AccountIconName } from './AccountIcon';

const WHY = [
  ['assistant', 'whyFoundTitle', 'whyFoundBody'],
  ['payment', 'whyFeesTitle', 'whyFeesBody'],
  ['orders', 'whyOrdersTitle', 'whyOrdersBody'],
  ['reviews', 'whyAnalyticsTitle', 'whyAnalyticsBody'],
  ['security', 'whySecureTitle', 'whySecureBody'],
] as const satisfies readonly (readonly [AccountIconName, string, string])[];

export async function WhySell() {
  const t = await getT('sell');
  return (
    <section className="stack" aria-labelledby="why-sell">
      <h2 id="why-sell">{t('whyTitle')}</h2>
      <ul className="why-grid">
        {WHY.map(([icon, title, body]) => (
          <li key={title} className="card">
            <span className="why-grid__icon">
              <AccountIcon name={icon} size={26} />
            </span>
            <strong>{t(title)}</strong>
            <span className="muted">{t(body)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function FeeSummary() {
  const t = await getT('sell');
  const f = await getFormat();
  return (
    <section className="card fee-summary" aria-labelledby="fees">
      <div className="stack" style={{ gap: 6 }}>
        <h2 id="fees">{t('feesTitle')}</h2>
        <p className="fee-headline">
          <strong>{f.percent(0.12)}</strong>
          <span>{t('feePerSale')}</span>
        </p>
        <Link href="/policies/sellers#fees">{t('viewFeeSchedule')}</Link>
      </div>
      <table className="fee-calc__table">
        <tbody>
          <tr>
            <td>{t('feeCustomerPays')}</td>
            <td className="num">{f.money(10000)}</td>
          </tr>
          <tr>
            <td>{t('feeCommission')}</td>
            <td className="num">−{f.money(1200)}</td>
          </tr>
          <tr className="fee-calc__total">
            <td>{t('feeProceeds')}</td>
            <td className="num">{f.money(8800)}</td>
          </tr>
          <tr>
            <td colSpan={2} className="hint">
              {t('feeHint')}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

const FAQ = [
  ['faqChargeQ', 'faqChargeA'],
  ['faqPaidQ', 'faqPaidA'],
  ['faqProductsQ', 'faqProductsA'],
  ['faqReturnsQ', 'faqReturnsA'],
  ['faqDisputeQ', 'faqDisputeA'],
  ['faqApprovalQ', 'faqApprovalA'],
  ['faqVerifyQ', 'faqVerifyA'],
] as const;

export async function SellerFaq() {
  const t = await getT('sell');
  return (
    <section className="card stack" style={{ gap: 4 }} aria-labelledby="seller-faq">
      <h2 id="seller-faq" style={{ marginBottom: 8 }}>
        {t('faqTitle')}
      </h2>
      {FAQ.map(([q, a]) => (
        <details key={q} className="faq">
          <summary>{t(q)}</summary>
          <p>
            {rich(t(a), {
              link: (chunk) => (
                <Link key="link" href="/policies/sellers#fees">
                  {chunk}
                </Link>
              ),
            })}
          </p>
        </details>
      ))}
    </section>
  );
}
