import type { Metadata } from 'next';
import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/jetbrains-mono/500.css';
import './globals.css';
import { messagesFor } from '@nixzora/i18n';
import { I18nProvider } from '@/components/I18nProvider';
import { getLocale, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return {
    title: { default: t('opsCenter'), template: '%s · NIXZORA Ops' },
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale} messages={messagesFor(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
