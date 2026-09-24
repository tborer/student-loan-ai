// Canonical public origin, used for absolute URLs in sitemap.xml and robots.txt.
// Override with SITE_URL if the site moves to a custom domain.
export const SITE_URL = (
  process.env.SITE_URL ?? 'https://student-loan-repayment-analyzer.vercel.app'
).replace(/\/+$/, '');
