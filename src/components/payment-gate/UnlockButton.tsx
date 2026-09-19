import React from 'react';
import stripe from '@stripe/stripe-js';

export interface UnlockButtonProps {
  onUnlock: (sessionToken: string) => Promise<void>;
  priceId?: string;
  isProcessing?: boolean;
  error?: string | null;
}

export const UnlockButton: React.FC<UnlockButtonProps> = ({
  onUnlock,
  priceId,
  isProcessing,
  error,
}) => {
  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!priceId) {
      // In production, use a configured Stripe product
      return;
    }

    try {
      await onUnlock(
        `session-${Date.now()}-${Math.random().toString(36).substring(2)}`
      );
    } catch (err) {
      console.error('Checkout creation failed:', err);
    }
  };

  return (
    <div className="unlock-payment">
      <style>{`
        .unlock-payment {
          text-align: center;
          padding: var(--spacing-md);
        }
        
        .unlock-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: white;
          padding: var(--spacing-md) var(--spacing-xl);
          font-size: 1rem;
          font-weight: 600;
          border-radius: var(--border-radius);
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .unlock-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        
        .unlock-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        
        .error-message {
          display: block;
          margin-top: var(--spacing-sm);
          color: #ef4444;
          font-size: 0.875rem;
        }
      `}</style>

      <button
        type="button"
        onClick={handleClick}
        disabled={isProcessing}
        className="unlock-btn"
        aria-label="Unlock detailed repayment plan with payment"
      >
        {isProcessing ? (
          <>
            <span className="spinner"></span>
            Processing...
          </>
        ) : (
          <>
            🔒 Unlock Full Report
            <span className="price">$9-$19</span>
          </>
        )}
      </button>

      {error && <span className="error-message" role="alert">{error}</span>}
    </div>
  );
};

export default UnlockButton;