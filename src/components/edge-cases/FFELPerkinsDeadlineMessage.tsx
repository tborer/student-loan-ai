import React from 'react';

export const FFELPerkinsDeadlineMessage: React.FC = () => {
  return (
    <div className="deadline-message" role="region" aria-label="Important deadline notice">
      <style>{`
        .deadline-message {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: var(--spacing-md);
          margin: var(--spacing-md) 0;
          border-radius: var(--border-radius);
        }

        .deadline-message h3 {
          margin: 0 0 var(--spacing-xs) 0;
          font-size: 1rem;
          color: #92400e;
        }

        .deadline-message p {
          margin: 0;
          font-size: 0.875rem;
          color: #78350f;
        }
      `}</style>

      <h3>Past Consolidation Deadline</h3>
      <p>
        FFEL, Perkins, or Parent PLUS loans held past the June 30, 2026 deadline have permanently lost 
        IDR and PSLF eligibility. Consolidation now only offers rate averaging and payment simplification.
      </p>
    </div>
  );
};

export default FFELPerkinsDeadlineMessage;