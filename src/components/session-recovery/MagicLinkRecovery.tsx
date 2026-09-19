import React, { useState } from 'react';

export interface MagicLinkRecoveryProps {
  email: string;
  reportToken: string;
  expiresAt: Date;
  onRecover: (token: string) => Promise<void>;
}

export const MagicLinkRecovery: React.FC<MagicLinkRecoveryProps> = ({
  email,
  reportToken,
  expiresAt,
  onRecover,
}) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExpired = new Date() > expiresAt;

  const handleRecover = async () => {
    if (!email) return;
    
    try {
      setIsRecovering(true);
      await onRecover(reportToken);
      setError(null);
    } catch (err) {
      setError('Failed to recover report. Please purchase a new analysis.');
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="recovery-notice" role="region" aria-label="Report recovery notice">
      <style>{`
        .recovery-notice {
          text-align: center;
          padding: var(--spacing-md);
          margin: var(--spacing-md) 0;
          border-radius: var(--border-radius);
          background: ${isExpired ? '#fef2f2' : '#ecfdf5'};
          border: 1px solid ${isExpired ? '#fecaca' : '#86efac'};
        }

        .recovery-notice h3 {
          margin: 0 0 var(--spacing-xs) 0;
          font-size: 1rem;
          color: ${isExpired ? '#991b1b' : '#065f46'};
        }

        .recovery-notice p {
          margin: 0 0 var(--spacing-sm) 0;
          font-size: 0.875rem;
          color: ${isExpired ? '#7f1d1d' : '#064e3b'};
        }

        .recovery-notice .disclaimer {
          font-size: 0.75rem;
          opacity: 0.9;
        }

        .recover-btn {
          background: ${isExpired ? '#dc2626' : '#10b981'};
          color: white;
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--border-radius);
          border: none;
          cursor: ${isRecovering ? 'not-allowed' : 'pointer'};
          font-size: 0.875rem;
          margin-top: var(--spacing-xs);
        }

        .recover-btn:disabled {
          opacity: 0.5;
        }
      `}</style>

      <h3>{isExpired ? 'Session Expired' : 'Report Recovery Available'}</h3>

      <p className="disclaimer">
        {isExpired 
          ? 'Your report access window has expired (7 days). Please purchase a new analysis.' 
          : `We've sent a magic link to ${email}. Click below to view your report.`}
      </p>

      {!isExpired && (
        <button
          type="button"
          onClick={handleRecover}
          disabled={isRecovering}
          className="recover-btn"
        >
          {isRecovering ? 'Recovering...' : 'View My Report'}
        </button>
      )}

      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default MagicLinkRecovery;