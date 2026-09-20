'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AnalysisResult } from '@/utils/analysis';
import { loadAnalysis, markAnalysisPaid } from '../lib/analysis-session';

const formatCurrency = (amount: number): string =>
  `$${Math.round(amount).toLocaleString('en-US')}`;

export default function ResultsPage() {
  const router = useRouter();

  const [sessionToken, setSessionToken] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data: { enableStripe?: boolean }) => setStripeEnabled(data.enableStripe !== false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const stored = loadAnalysis();
    if (stored) {
      setSessionToken(stored.token);
      setResult(stored.result);
      setIsUnlocked(Boolean(stored.paid));
    }
    setIsLoaded(true);

    if (params.get('checkout') === 'cancelled') {
      setNotice('Checkout was cancelled. Your results are still here whenever you are ready.');
      return;
    }

    const checkoutSessionId = params.get('session_id');
    if (!checkoutSessionId) return;

    // The redirect alone never unlocks anything -- Stripe's own record of the
    // session is the source of truth, so ask it directly rather than trust
    // the URL.
    setIsVerifying(true);
    setNotice('Confirming your payment...');

    fetch(`/api/verify-payment?session_id=${encodeURIComponent(checkoutSessionId)}`)
      .then((response) => response.json())
      .then((data: { paid?: boolean; sessionToken?: string | null; reason?: string }) => {
        if (data.paid && data.sessionToken && stored && data.sessionToken === stored.token) {
          markAnalysisPaid(data.sessionToken);
          setIsUnlocked(true);
          setNotice(null);
        } else if (data.reason === 'refunded') {
          setNotice('This report was refunded, so it is no longer unlocked.');
        } else {
          setNotice(
            "We could not confirm this payment yet. If you just paid, this can take a few seconds -- refresh the page. If it still doesn't unlock, contact support with your receipt."
          );
        }
      })
      .catch((err) => {
        console.error('Payment verification failed:', err);
        setNotice(
          'We could not confirm this payment right now. Refresh the page, or contact support with your receipt.'
        );
      })
      .finally(() => setIsVerifying(false));
  }, []);

  const handleUnlock = async () => {
    if (!sessionToken || !stripeEnabled) return;

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
          <h1>{isUnlocked ? 'Your Full Repayment Plan' : 'Free Teaser Results'}</h1>
          {isLoaded && (
            <p>
              We found <strong>{strategies.length}</strong>{' '}
              {strategies.length === 1 ? 'way' : 'ways'} to potentially lower your payments.
            </p>
          )}
        </header>

        {result && result.notices.length > 0 && (
          <section className="notices" aria-label="Time-sensitive, applies to everyone">
            <h2>Before anything else</h2>
            <ul>
              {result.notices.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {/*
          Free tier shows headlines only. Exact figures are deliberately not
          rendered here -- keeping them out of the DOM entirely, rather than
          hiding them with CSS, is what actually protects the paywall. Once
          isUnlocked is true (confirmed via /api/verify-payment, never from
          the URL alone), the same strategies array already sitting in
          sessionStorage carries the real numbers -- nothing is re-fetched.

          riskWarnings is the one exception: it carries no dollar figure, only
          eligibility- and risk-critical text (e.g. "refinancing forfeits
          federal protections permanently, this cannot be undone"). Paywalling
          that would protect the wrong thing -- it costs nothing to give away
          and it's the difference between informational and letting someone
          make an irreversible choice for want of the unlock price.
        */}
        {strategies.map((strategy, index) => (
          <article key={strategy.id} className="strategy-card">
            <div className="strategy-header">
              <span className="badge">{index + 1}</span>
              <h3>{strategy.title}</h3>
            </div>
            {strategy.riskWarnings && strategy.riskWarnings.length > 0 && (
              <ul className="risk-warnings" aria-label={`Important information about ${strategy.title}`}>
                {strategy.riskWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            {isUnlocked ? (
              <>
                {(strategy.estimatedMonthlyPayment !== undefined ||
                  strategy.estimatedAnnualSavings !== undefined) && (
                  <div className="strategy-metrics" aria-label={`Estimated figures for ${strategy.title}`}>
                    {strategy.estimatedMonthlyPayment !== undefined && (
                      <div className="metric">
                        <span className="metric-label">Estimated monthly payment</span>
                        <strong>{formatCurrency(strategy.estimatedMonthlyPayment)}</strong>
                      </div>
                    )}
                    {strategy.estimatedAnnualSavings !== undefined && (
                      <div className="metric">
                        <span className="metric-label">Estimated savings</span>
                        <strong>{formatCurrency(strategy.estimatedAnnualSavings)}/year</strong>
                      </div>
                    )}
                  </div>
                )}

                {strategy.tradeoffs && strategy.tradeoffs.length > 0 && (
                  <div className="tradeoffs">
                    <h4>Considerations</h4>
                    <ul>
                      {strategy.tradeoffs.map((tradeoff) => (
                        <li key={tradeoff}>{tradeoff}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {strategy.warnings && strategy.warnings.length > 0 && (
                  <ul className="risk-warnings" aria-label={`Cost details for ${strategy.title}`}>
                    {strategy.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}

                {strategy.actionUrl && (
                  <div className="strategy-action">
                    <a href={strategy.actionUrl} target="_blank" rel="noopener noreferrer">
                      {strategy.actionUrlLabel || `Start ${strategy.title}`} →
                    </a>
                    {strategy.actionDisclosure && (
                      <p className="action-disclosure">{strategy.actionDisclosure}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="disclaimer">
                Exact numbers, trade-offs and next steps are in the full report.
              </p>
            )}
          </article>
        ))}

        {result && result.ineligibleFor.length > 0 && (
          <section className="ineligible-for" aria-label="Not eligible right now">
            <h2>Not eligible right now</h2>
            <ul>
              {result.ineligibleFor.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
        )}

        {strategies.length === 0 && isLoaded && result && result.recommendations.length === 0 && (
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

        {strategies.length > 0 && !isUnlocked && (
          <section className="unlock-cta" aria-labelledby="unlock-heading">
            <h2 id="unlock-heading">View Your Detailed Plan</h2>
            <p>
              The full report has your estimated new payment, the savings, the trade-offs, and a
              checklist with links to start each option.
            </p>
            <p className="what-were-selling">
              Enrolling in IDR, consolidating, and applying for PSLF are always free directly
              through studentaid.gov. What you&apos;re paying for here is the comparison across
              all your options in one place, including real private refinance offers, which
              studentaid.gov doesn&apos;t provide.
            </p>

            {stripeEnabled ? (
              <button onClick={handleUnlock} disabled={isProcessing || isVerifying} className="btn-primary">
                {isProcessing ? 'Processing...' : 'Unlock Full Report'}
              </button>
            ) : (
              <div className="notice-banner" role="status">
                <p>Payments aren&apos;t open yet -- check back soon to unlock your full report.</p>
              </div>
            )}
          </section>
        )}

        {isUnlocked && (
          <section className="unlock-cta unlocked" aria-label="Report unlocked">
            <h2>Report Unlocked</h2>
            <p>
              Everything above now includes your estimated numbers and direct links to start each
              option. Use your browser&apos;s print or save-as-PDF to keep a copy -- this page is
              tied to this browser tab and is not stored on our servers.
            </p>
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
