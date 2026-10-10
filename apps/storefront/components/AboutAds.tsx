import { getT } from '@/lib/i18n';

/** "About these ads": why a shopper sees sponsored products (no script needed). */
export async function AboutAds() {
  const t = await getT('ads');
  return (
    <details className="about-ads">
      <summary>{t('aboutAds')}</summary>
      <p className="muted">{t('aboutAdsBody')}</p>
    </details>
  );
}
