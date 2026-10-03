import { INTL_LOCALE, rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { getLocale, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sell');
  return { title: t('policyMetaTitle'), description: t('policyMetaDescription') };
}

const FEES = [
  ['policyCommission', 'policyCommissionBody'],
  ['policyShipping', 'policyShippingBody'],
  ['policyTax', 'policyTaxBody'],
  ['policyCoupons', 'policyCouponsBody'],
  ['policyRefunds', 'policyRefundsBody'],
  ['policyCancellations', 'policyCancellationsBody'],
  ['policyCard', 'policyCardBody'],
  ['policyListingFees', 'policyListingFeesBody'],
  ['policyPayouts', 'policyPayoutsBody'],
] as const;

/**
 * Plain-language summary of the marketplace rules sellers accept when they apply (p8-13).
 * The numbers match the commission engine and payouts (ADR-0013, ADR-0014).
 */
export default async function SellerPolicyPage() {
  const t = await getT('sell');
  const locale = await getLocale();
  const updated = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date('2026-10-03T12:00:00Z'));
  return (
    <LegalPage title={t('policyTitle')} updated={updated}>
      {locale !== 'en' ? (
        <p>
          <em>{t('translationNote')}</em>
        </p>
      ) : null}
      <p>{t('policyIntro')}</p>

      <h2 id="agreement">{t('policyAgreementTitle')}</h2>
      <ul>
        <li>{t('policyAgreement1')}</li>
        <li>{t('policyAgreement2')}</li>
        <li>{t('policyAgreement3')}</li>
        <li>{t('policyAgreement4')}</li>
      </ul>

      <h2 id="fees">{t('policyFeesTitle')}</h2>
      <table className="fee-rules">
        <tbody>
          {FEES.map(([label, body]) => (
            <tr key={label}>
              <th scope="row">{t(label)}</th>
              <td>{t(body)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{rich(t('policyExample'), { b: (chunk) => <strong key="b">{chunk}</strong> })}</p>

      <h2 id="returns">{t('policyReturnsTitle')}</h2>
      <ul>
        <li>
          {rich(t('policyReturns1'), {
            link: (chunk) => (
              <Link key="link" href="/policies/returns">
                {chunk}
              </Link>
            ),
          })}
        </li>
        <li>{t('policyReturns2')}</li>
        <li>{t('policyReturns3')}</li>
        <li>{t('policyReturns4')}</li>
      </ul>

      <h2>{t('policyQuestions')}</h2>
      <p>
        {rich(t('policyContact'), {
          link: (chunk) => (
            <Link key="link" href="/help/contact?topic=OTHER">
              {chunk}
            </Link>
          ),
        })}
      </p>
    </LegalPage>
  );
}
