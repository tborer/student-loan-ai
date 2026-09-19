import type { Metadata } from 'next';
import { Geist, Geist_Mono } from "next/font/google";
import './globals.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}