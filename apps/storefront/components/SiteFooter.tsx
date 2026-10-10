import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { LanguagePicker } from './LanguagePicker';

export async function SiteFooter() {
  const t = await getT('layout');
  const c = await getT('common');
  const g = await getT('gifts');
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__row">
        <div className="stack" style={{ gap: 6 }}>
          <strong>NIXZORA</strong>
          <span className="muted">{t('tagline')}</span>
          <LanguagePicker id="footer-language" />
        </div>
        <nav aria-label={t('footerNav')}>
          <Link href="/search">{t('allProducts')}</Link>
          <Link href="/account/orders">{t('yourOrders')}</Link>
          <Link href="/gift-cards">{g('navGiftCards')}</Link>
          <Link href="/help">{t('help')}</Link>
          <Link href="/policies/shipping">{t('shipping')}</Link>
          <Link href="/policies/returns">{t('returns')}</Link>
          <Link href="/about">{t('about')}</Link>
          <Link href="/sell">{t('sellOnNixzora')}</Link>
          <Link href="/status">{t('status')}</Link>
          <Link href="/privacy">{t('privacy')}</Link>
          <Link href="/terms">{t('terms')}</Link>
        </nav>
      </div>
      <div className="wrap muted" style={{ marginTop: 16, fontSize: 13 }}>
        {c('demoNotice')}
      </div>
    </footer>
  );
}
