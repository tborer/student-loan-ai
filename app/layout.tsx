import type { Metadata } from 'next';
import { Inter } from "next/font/google";
import './globals.css';

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Student Loan Repayment Analyzer - Compare refinancing, IDR plans, PSLF options",
  description: "Privacy-first student loan repayment analysis tool. Compare refinancing, income-driven repayment (IDR), consolidation, and PSLF options to lower your payments.",
  authors: [{ name: "Student Loan AI" }],
  keywords: ["student loans", "refinance", "PSLF", "income-driven repayment", "loan consolidation"],
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