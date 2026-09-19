'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AnalysisResult } from '@/utils/analysis';
import { loadAnalysis } from '../lib/analysis-session';

export default function ResultsPage() {
  const router = useRouter();

  const [sessionToken, setSessionToken] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('checkout') === 'cancelled') {
      setNotice('Checkout was cancelled. Your results are still here whenever you are ready.');
    } else if (params.get('session_id')) {
      // The redirect alone never unlocks anything; the webhook is the source
      // of truth. Until the ephemeral store lands, say so plainly rather than
      // implying the report is ready.
      setNotice(
        'Payment received. Report delivery is not enabled yet -- please contact support with your receipt.'
      );
    }

    const stored = loadAnalysis();
    if (stored) {
      setSessionToken(stored.token);
      setResult(stored.result);
    }
    setIsLoaded(true);
  }, []);

  const handleUnlock = async () => {
    if (!sessionToken) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The price lives in server env, not here: a client-supplied price
        // could be swapped for any other price in the Stripe account.
        body: JSON.stringify({ sessionToken }),
      });

      // An error response is not guaranteed to be JSON (a 500 can be HTML).
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to start checkout.');
      }

      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  const strategies = result?.eligibleStrategies ?? [];

  // Nothing stored: the visitor came here directly or their session expired.
  if (isLoaded && !result) {
    return (
      <main className="results-main">
        <div className="container">
          <h1>No analysis found</h1>
          <p>
            Your results may have expired, or you haven&apos;t run an analysis yet. It only takes
            a few minutes.
          </p>
          <button onClick={() => router.push('/loan-form')} className="btn-primary">
            Start Your Analysis
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="results-main">
      {notice && (
        <div className="notice-banner" role="status">
          <p>{notice}</p>
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="container">
        <header>
          <h1>Free Teaser Results</h1>
          {isLoaded && (
            <p>
              We found <strong>{strategies.length}</strong>{' '}
              {strategies.length === 1 ? 'way' : 'ways'} to potentially lower your payments.
            </p>
          )}
        </header>

        {/*
          Free tier shows headlines only. Exact figures are deliberately not
          rendered here -- keeping them out of the DOM entirely, rather than
          hiding them with CSS, is what actually protects the paywall.
        */}
        {strategies.map((strategy, index) => (
          <article key={strategy.id} className="strategy-card">
            <div className="strategy-header">
              <span className="badge">{index + 1}</span>
              <h3>{strategy.title}</h3>
            </div>
            <p className="disclaimer">
              Exact numbers, trade-offs and next steps are in the full report.
            </p>
          </article>
        ))}

        {strategies.length === 0 && isLoaded && (
          <p>
            Based on what you entered, we didn&apos;t find a strategy that clearly improves on
            your current terms. That can change as the federal rules do.
          </p>
        )}

        {result && result.recommendations.length > 0 && (
          <section className="recommendations" aria-label="Recommendations">
            <h2>Worth knowing</h2>
            <ul>
              {result.recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </section>
        )}

        {strategies.length > 0 && (
          <section className="unlock-cta" aria-labelledby="unlock-heading">
            <h2 id="unlock-heading">View Your Detailed Plan</h2>
            <p>
              The full report has your estimated new payment, the savings, the trade-offs, and a
              checklist with links to start each option.
            </p>

            <button onClick={handleUnlock} disabled={isProcessing} className="btn-primary">
              {isProcessing ? 'Processing...' : 'Unlock Full Report'}
            </button>
          </section>
        )}

        <p className="disclaimer">
          Educational estimates only. Not financial, legal, or tax advice. Figures are estimates
          and actual servicer or lender terms may differ.
        </p>
      </div>
    </main>
  );
}
