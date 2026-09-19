import React from 'react';
import UnlockButton from '../payment-gate/UnlockButton';

export interface StrategyCardProps {
  id: string;
  title: string;
  estimatedNewPayment?: number;
  monthlySavings?: number;
  annualSavings?: number;
  lifetimeSavings?: number;
  tradeoffs?: string[];
  actionChecklist: Array<{ step: string; status: 'pending' | 'complete' }>;
  providerLink: string;
  onUnlock: () => Promise<void>;
}

export interface DetailedReportProps {
  strategies: StrategyCardProps[];
  priceId?: string;
  sessionToken: string;
}

// Configuration from providers.json
const providerLinks = {
  federalIDR: 'https://studentaid.gov/help-center/html/apply/idr-ibr',
  consolidation: 'https://studentaid.gov/manage-loans/consolidate',
  pslf: 'https://studentaid.gov/pslf/help-tool',
};

const DetailedReport: React.FC<DetailedReportProps> = ({
  strategies,
  priceId,
  sessionToken,
}) => {
  return (
    <article className="detailed-report" role="main">
      <header>
        <h1>Your Personalized Repayment Plan</h1>
        <p className="access-window">
          Report accessible for 7 days via magic link. Downloadable or printable.
        </p>
      </header>

      <section aria-labelledby="strategies-heading">
        <h2 id="strategies-heading">Recommended Strategies (Ranked)</h2>
        <div className="strategies-container">
          {strategies.map(strategy => (
            <article key={strategy.id} className="strategy-card" role="article">
              <header>
                <h3>{strategy.title}</h3>
                <span className="provider-link" aria-label={`Visit ${strategy.providerLink}`}>
                  {strategy.providerLink === providerLinks.federalIDR ? 'studentaid.gov' : strategy.providerLink}
                </span>
              </header>

              <div className="savings-metrics" aria-label="Savings metrics">
                {strategy.estimatedNewPayment && (
                  <div className="metric">
                    <span className="label">Estimated New Payment:</span>
                    <strong>${strategy.estimatedNewPayment.toFixed(2)}/month</strong>
                  </div>
                )}
                {(strategy.monthlySavings || strategy.annualSavings) && (
                  <div className="metric highlight">
                    <span className="label">Monthly Savings:</span>
                    <strong>${strategy.monthlySavings?.toFixed(2) || 'N/A'}</strong>
                  </div>
                )}
              </div>

              <div className="tradeoffs" aria-label="Trade-offs and considerations">
                {strategy.tradeoffs && strategy.tradeoffs.length > 0 && (
                  <>
                    <h4>Considerations:</h4>
                    <ul>
                      {strategy.tradeoffs.map((tradeoff, index) => (
                        <li key={index}>{tradeoff}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div className="action-checklist" aria-label="Action steps">
                <h4>Action Steps:</h4>
                {strategy.actionChecklist.map((item, index) => (
                  <label key={index} className={`checkbox-item ${item.status}`} >
                    <input
                      type="checkbox"
                      checked={item.status === 'complete'}
                      readOnly
                    />
                    {item.step}
                  </label>
                ))}
              </div>

              <footer className="strategy-footer">
                <a href={providerLinks[Object.keys(providerLinks).find(key => providerLinks[key] === strategy.providerLink) || '']} rel="noopener noreferrer" target="_blank" aria-label={`Go to ${strategy.title.toLowerCase()}`}>
                  {`→ Start ${strategy.title}`}
                </a>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <UnlockButton onUnlock={() => Promise.resolve()} priceId={priceId} />
    </article>
  );
};

export default DetailedReport;