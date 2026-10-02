import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/params';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/account', '/cart', '/checkout', '/orders'] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
