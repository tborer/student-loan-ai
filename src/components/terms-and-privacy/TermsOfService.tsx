import React from 'react';
import './terms-and-privacy.css';

const TermsOfService: React.FC = () => {
  return (
    <article className="legal-document" role="document">
      <header>
        <h1>Terms of Service</h1>
        <p className="last-updated">Last updated: September 20, 2026</p>
      </header>

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading">Overview</h2>
        <p>
          These Terms of Service ("Terms") govern your use of the Student Loan Repayment Analyzer website 
          and services (the "Service"). By accessing or using our Service, you agree to be bound by these Terms.
        </p>
      </section>

      <section aria-labelledby="eligibility-heading">
        <h2 id="eligibility-heading">Eligibility</h2>
        <p>
          You must be at least 18 years old or the legal age of majority in your jurisdiction to use this Service.
        </p>
      </section>

      <section aria-labelledby="educational-use-heading">
        <h2 id="educational-use-heading">Educational Use Only</h2>
        <p>
          <strong>Important:</strong> This tool is for educational purposes only. The information provided is 
          based on publicly available federal regulations and our analysis engine's calculations, but:
        </p>
        <ul>
          <li>All figures are estimates and may not reflect actual servicer or lender terms.</li>
          <li>We do not provide financial, legal, or tax advice.</li>
          <li>You should consult a qualified advisor (loan counselor, financial advisor, attorney) before making decisions.</li>
        </ul>
      </section>

      <section aria-labelledby="no-association-heading">
        <h2 id="no-association-heading">No Association with Lenders or Government</h2>
        <p>
          We are not a student loan servicer, lender, regulator, or government agency. Our links to federal 
          websites (studentaid.gov) and private lenders are provided for informational purposes only.
        </p>
      </section>

      <section aria-labelledby="affiliate-heading">
        <h2 id="affiliate-heading">Affiliate Disclosures</h2>
        <p>
          Some links on this site may be affiliate or referral links. If you apply through our links and are 
          approved, we may receive a commission at no cost to you. We disclose this because FTC rules require 
          transparency about compensated referrals.
        </p>
      </section>

      <section aria-labelledby="accuracy-heading">
        <h2 id="accuracy-heading">Accuracy Disclaimer</h2>
        <p>
          All numbers, payments, eligibility criteria, and information provided are estimates based on 
          data at the time of your analysis. Actual terms may differ. We make no representations or warranties 
          regarding accuracy, completeness, or timeliness of information.
        </p>
      </section>

      <section aria-labelledby="payment-heading">
        <h2 id="payment-heading">Payment & Billing</h2>
        <p>
          This service may offer a paid analysis report. Pricing is currently $9-$19 for a one-time payment 
          (subject to change). We use Stripe to process payments, and you agree to their terms. 
          Our refund policy will be defined separately before launch.
        </p>
      </section>

      <section aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Privacy</h2>
        <p>
          Please review our Privacy Policy for details on what data we collect, why, how long we retain it, 
          and our security practices.
        </p>
      </section>

      <section aria-labelledby="prohibited-use-heading">
        <h2 id="prohibited-use-heading">Prohibited Uses</h2>
        <ul>
          <li>Using this Service for commercial purposes without permission</li>
          <li>Misrepresenting your identity or financial situation</li>
          <li>Attempting to access other users' data</li>
          <li>Using automated scripts/bots to interact with our Service</li>
        </ul>
      </section>

      <section aria-labelledby="changes-heading">
        <h2 id="changes-heading">Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. The updated version will be posted here with the 
          effective date noted above. Continued use after changes constitutes acceptance.
        </p>
      </section>

      <section aria-labelledby="governing-law-heading">
        <h2 id="governing-law-heading">Governing Law</h2>
        <p>
          These Terms are governed by the laws of your state of residence, without regard to conflict of law 
          principles. Any disputes shall be resolved in courts located in your jurisdiction.
        </p>
      </section>

      <footer className="legal-footer">
        <p>&copy; {new Date().getFullYear()} Student Loan Repayment Analyzer. All rights reserved.</p>
      </footer>
    </article>
  );
};

export default TermsOfService;