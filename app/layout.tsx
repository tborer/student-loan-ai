import type { Metadata } from 'next';
import './globals.css';

const inter = { className: "" };

export const metadata: Metadata = {
  title: "Student Loan Repayment Analyzer - Compare refinancing, IDR plans, PSLF options",
  description: "Privacy-first student loan repayment analysis tool. Compare refinancing, income-driven repayment (IDR), consolidation, and PSLF options to lower your payments.",
  authors: [{ name: "Student Loan AI" }],
  keywords: ["student loans", "refinance", "PSLF", "income-driven repayment", "loan consolidation"],
  // Google Search Console ownership proof. A .vercel.app subdomain sits in a
  // zone we do not control, so the DNS TXT method is unavailable; this renders
  // <meta name="google-site-verification" ...> instead, which is the
  // equivalent check for a URL-prefix property.
  verification: {
    google: "JJK6aKpMQ5AtPjltMY2M3KB-UYwHc3N3geJB5ql2uGc",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}