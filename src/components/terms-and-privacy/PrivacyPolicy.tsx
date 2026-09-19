import React from 'react';
import './terms-and-privacy.css';

const PrivacyPolicy: React.FC = () => {
  return (
    <article className="legal-document" role="document">
      <header>
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last updated: September 20, 2026</p>
      </header>

      <section aria-labelledby="introduction-heading">
        <h2 id="introduction-heading">Introduction</h2>
        <p>
          Privacy is at the core of our mission. This Privacy Policy explains what data we collect, why, 
          how long we keep it, and your rights. We never store sensitive financial data beyond a short, 
          expiring window needed to bridge free results to your paid report.
        </p>
      </section>

      <section aria-labelledby="data-we-collect-heading">
        <h2 id="data-we-collect-heading">What We Collect</h2>
        
        <h3 className="subheading">Loan Information (Temporary)</h3>
        <ul>
          <li><strong>What:</strong> Loan type, balance, interest rate per loan.</li>
          <li><strong>Why:</strong> To run your repayment strategy analysis.</li>
          <li><strong>Retention:</strong> 24-72 hours maximum (TTL-bound). Data is never stored in a database.</li>
        </ul>

        <h3 className="subheading">Borrower Information (Temporary)</h3>
        <ul>
          <li><strong>What:</strong> Annual income, household size, filing status, employment sector, optional state/years-in-qualifying-repayment.</li>
          <li><strong>Why:</strong> To calculate IDR/RAP payments and estimate forgiveness eligibility.</li>
          <li><strong>Retention:</strong> 24-72 hours maximum (TTL-bound).</li>
        </ul>

        <h3 className="subheading">Email Address (Optional)</h3>
        <ul>
          <li><strong>What:</strong> Email entered for report recovery.</li>
          <li><strong>Why:</strong> Only if opted-in. Used to send a magic link to retrieve your paid report before expiry.</li>
          <li><strong>Retention:</strong> Deleted when report is accessed or after 7 days, whichever comes first.</li>
        </ul>

        <h3 className="subheading">What We Don't Collect</h3>
        <ul>
          <li>No SSN or Social Security Number</li>
          <li>No bank account information</li>
          <li>No credit card details (Stripe processes payments)</li>
          <li>No authentication credentials or account passwords</li>
        </ul>
      </section>

      <section aria-labelledby="data-handling-heading">
        <h2 id="data-handling-heading">How We Handle Your Data</h2>
        
        <h3 className="subheading">Ephemeral Processing</h3>
        <p>
          All sensitive data (loan balances, income) is processed in-memory over TLS and never persisted 
          to a database. We use an ephemeral store with automatic expiry (TTL) for the short window needed 
          between free results and paid report access.
        </p>

        <h3 className="subheading">Payment Security</h3>
        <p>
          Payment data never touches our servers. Stripe handles PCI compliance entirely. We verify 
          payment via Stripe API webhooks before unlocking any content.
        </p>

        <h3 className="subheading">Automatic Deletion</h3>
        <p>
          Data automatically expires after 24-72 hours. You can also manually delete data anytime using 
          the "Delete My Data Now" action available on results pages before expiry.
        </p>

        <h3 className="subheading">Third Parties</h3>
        <ul>
          <li><strong>Stripe:</strong> Payment processing only.</li>
          <li><strong>Ephemeral Store (Redis/DynamoDB):</strong> TTL-keyed storage for session bridging.</li>
        </ul>
      </section>

      <section aria-labelledby="security-heading">
        <h2 id="security-heading">Security</h2>
        <p>
          We use TLS encryption everywhere (https). Our ephemeral store has access controls. 
          Webhook signatures are verified for Stripe events. However, no system is 100% secure — 
          protect yourself by not sharing your analysis results publicly.
        </p>
      </section>

      <section aria-labelledby="user-rights-heading">
        <h2 id="user-rights-heading">Your Rights</h2>
        <ul>
          <li><strong>Deletion:</strong> Click "Delete My Data Now" anytime before expiry.</li>
          <li><strong>Access:</strong> Your paid report is accessible via magic link until window closes.</li>
          <li><strong>Notification:</strong> Email reports (magic link) only with explicit opt-in.</li>
        </ul>
      </section>

      <section aria-labelledby="legal-basis-heading">
        <h2 id="legal-basis-heading">Legal Basis</h2>
        <p>
          This Privacy Policy is part of the legal basis for processing your data. You may withdraw 
          consent (delete data) anytime, which will expire your session immediately.
        </p>
      </section>

      <section aria-labelledby="state-requirements-heading">
        <h2 id="state-requirements-heading">State Requirements</h2>
        <p>
          Some states regulate financial-advice-adjacent tools differently. If you're in such a state, 
          additional disclosures may apply. Consult legal counsel for state-specific requirements.
        </p>
      </section>

      <footer className="legal-footer">
        <p>&copy; {new Date().getFullYear()} Student Loan Repayment Analyzer. All rights reserved.</p>
      </footer>
    </article>
  );
};

export default PrivacyPolicy;