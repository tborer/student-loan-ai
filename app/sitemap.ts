import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/site-url';

// Served at /sitemap.xml. /results is left out on purpose: it only renders an
// analysis stored in the visitor's own browser session, so it has nothing to index.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/loan-form`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
