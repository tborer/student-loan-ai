import React from 'react';

export interface PrivateOnlyMessageProps {
  allPrivateLoans: boolean;
}

export const PrivateOnlyUserFlow: React.FC<PrivateOnlyMessageProps> = ({
  allPrivateLoans,
}) => {
  if (!allPrivateLoans) return null;

  return (
    <div className="private-only-notice" role="region" aria-label="Private loan notification">
      <style>{`
        .private-only-notice {
          background: #dbeafe;
          border-left: 4px solid var(--color-primary);
          padding: var(--spacing-md);
          margin: var(--spacing-md) 0;
          border-radius: var(--border-radius);
        }

        .private-only-notice h3 {
          margin: 0 0 var(--spacing-xs) 0;
          font-size: 1rem;
          color: #1e40af;
        }

        .private-only-notice p {
          margin: 0;
          font-size: 0.875rem;
          color: #1e3a8a;
        }

        .private-only-notice ul {
          margin-top: var(--spacing-sm);
          padding-left: var(--spacing-lg);
        }

        .private-only-notice li {
          margin-bottom: var(--spacing-xs);
          font-size: 0.875rem;
        }
      `}</style>

      <h3>All Private Loans Detected</h3>
      <p>
        Since your loans are all private, federal programs don't apply. We've filtered out 
        income-driven repayment and PSLF options. Here's what we recommend:
      </p>
      <ul>
        <li><strong>Refinance:</strong> Our primary recommendation — compare current rates to potential improvements</li>
        <li><strong>Rate Comparison:</strong> Private lenders typically offer competitive rates based on credit score</li>
        <li><strong>No PSLF/IDR:</strong> These programs only apply to federal Direct loans</li>
      </ul>
    </div>
  );
};

export default PrivateOnlyUserFlow;