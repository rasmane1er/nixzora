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
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { cookies } from 'next/headers';
import { SITE_URL } from '@/lib/params';
import { THEME_COOKIE } from '@/lib/session';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'NIXZORA — computers and electronics, explained', template: '%s · NIXZORA' },
  description:
    'Laptops, monitors, phones and accessories with clear specs and honest advice. Tell us what you need; NIXZORA finds it and builds the cart.',
  openGraph: { siteName: 'NIXZORA', type: 'website' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html lang="en" data-theme={theme === 'light' || theme === 'dark' ? theme : undefined}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
