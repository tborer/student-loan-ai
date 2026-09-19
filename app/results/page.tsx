'use client';

import React, { useState, useEffect } from 'react';

interface Strategy {
  id: string;
  title: string;
  estimatedNewPayment?: number;
  monthlySavings?: number;
  tradeoffs?: string[];
}

export default function ResultsPage() {
  const [sessionToken, setSessionToken] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  // Load analysis data from URL or localStorage
  useEffect(() => {
    const urlSession = new URLSearchParams(window.location.search).get('session_id');
    if (urlSession) {
      setSessionToken(urlSession);
    } else {
      const stored = localStorage.getItem('slr_session_token');
      if (stored) setSessionToken(stored);
    }
  }, []);

  // Fetch analysis result when session token is available
  useEffect(() => {
    if (!sessionToken) return;

    // Mock: In production, fetch encrypted blob from ephemeral store
    const mockStrategies: Strategy[] = [
      {
        id: 'refinance',
        title: 'Refinancing could lower your rate',
        estimatedNewPayment: 250,
        monthlySavings: 45,
        tradeoffs: ['Converts federal loans to private', 'Loses PSLF eligibility'],
      },
    ];

    setStrategies(mockStrategies);
  }, [sessionToken]);

  const handleUnlock = async () => {
    if (!sessionToken) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Call Stripe Checkout session creation function
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
          loanAnalysisData: { /* analysis data */ },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      const result = await response.json();
      window.location.href = result.url;

    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="results-main">
      {/* Error State */}
      {error && (
        <div className="error-banner" role="alert">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      )}

      <div className="container">
        <header>
          <h1>Free Teaser Results</h1>
          <p>We found <strong>{strategies.length}</strong> ways to potentially lower your payments!</p>
        </header>

        {/* Strategy List (Locked for paying users) */}
        {strategies.map((strategy, index) => (
          <article key={strategy.id} className="strategy-card">
            <div className="strategy-header">
              <span className="badge">{index + 1}</span>
              <h3>{strategy.title}</h3>
            </div>

            {/* Locked Content */}
            <div className="locked-content" aria-label={`Locked: ${strategy.title}`}>
              {strategy.estimatedNewPayment && (
                <p className="blurred-text">
                  Estimated new payment would be approximately 
                  <span className="blur">$<strong>{strategy.estimatedNewPayment}</strong></span>/month
                </p>
              )}

              {strategy.tradeoffs && (
                <ul className="hidden-details">
                  {strategy.tradeoffs.map((tradeoff, i) => (
                    <li key={i}>{tradeoff}</li>
                  ))}
                </ul>
              )}

              <p className="disclaimer">(Click "Unlock Full Report" to see exact numbers)</p>
            </div>
          </article>
        ))}

        {/* Combined Savings Estimate (Fuzzy, as per spec) */}
        <div className="savings-estimate">
          <span>Combined savings range:</span>
          <span className="blur">$1,200-$4,800/year potential</span>
          <span className="disclaimer">(rough estimate)</span>
        </div>

        {/* Unlock CTA */}
        <section className="unlock-cta" aria-labelledby="unlock-heading">
          <h2 id="unlock-heading">View Your Detailed Plan</h2>
          <p>Exact numbers, action steps, and provider links are locked above.</p>

          {!sessionToken ? (
            <button disabled onClick={() => window.location.href = '/loan-form'} className="btn-continue">
              Complete Analysis First →
            </button>
          ) : (
            <button 
              onClick={handleUnlock} 
              disabled={isProcessing || !process.env.NEXT_PUBLIC_STRIPE_PRICE_ID}
              className="btn-primary"
            >
              {isProcessing ? 'Processing...' : 'Unlock Full Report ($9-$19)'}
            </button>
          )}

          {/* Magic Link Recovery */}
          <p className="recovery-info">
            Already paid? Your report is accessible via email for 7 days.
          </p>
        </section>
      </div>
    </main>
  );
}