import type { MetadataRoute } from 'next';

/** Web app manifest: name and icons used when the storefront is added to a home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NIXZORA',
    short_name: 'NIXZORA',
    description: 'Computers and electronics, found by describing what you need.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F5F1',
    theme_color: '#0E1726',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
