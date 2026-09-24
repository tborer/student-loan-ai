import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/site-url';

// Served at /robots.txt; points crawlers at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/results'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
