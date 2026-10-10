import type { Metadata } from 'next';
// Fonts are self-hosted from npm: no request to a third-party font CDN at runtime.
import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@nixzora/ui/tokens.css';
import './globals.css';
import { messagesFor } from '@nixzora/i18n';
import { I18nProvider } from '@/components/I18nProvider';
import { CompareTray } from '@/components/CompareButton';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { cookies } from 'next/headers';
import { SITE_URL } from '@/lib/params';
import { getLocale, getT } from '@/lib/i18n';
import { THEME_COOKIE } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('layout');
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('siteTitle'), template: '%s · NIXZORA' },
    description: t('siteDescription'),
    openGraph: { siteName: 'NIXZORA', type: 'website' },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const locale = await getLocale();
  const t = await getT('common');
  return (
    <html lang={locale} data-theme={theme === 'light' || theme === 'dark' ? theme : undefined}>
      <body>
        <I18nProvider locale={locale} messages={messagesFor(locale)}>
          <a className="skip" href="#main">
            {t('skipToContent')}
          </a>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
          <CompareTray />
        </I18nProvider>
      </body>
    </html>
  );
}
