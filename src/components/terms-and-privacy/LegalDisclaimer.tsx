import React from 'react';
import './terms-and-privacy.css';

const LegalDisclaimer: React.FC<{ onLearnMore?: () => void }> = ({ onLearnMore }) => {
  return (
    <aside className="legal-disclaimer" role="complementary">
      <div className="disclaimer-box">
        <h3>Educational Tool Only</h3>
        <p className="summary">
          This tool provides educational estimates for student loan repayment strategies. 
          Not financial, legal, or tax advice.
        </p>
        
        <ul className="disclaimer-items" aria-label="Disclaimer items">
          <li><strong>No personalized advice:</strong> Results are generalized calculations</li>
          <li><strong>Consult an advisor:</strong> Speak with a qualified professional before acting</li>
          <li><strong>Estimates only:</strong> Actual terms may differ from our projections</li>
          <li><strong>Affiliate disclosure:</strong> Some links may earn us commissions</li>
        </ul>

        <p className="regulatory-warning">
          ⚠️ State-specific regulation: Financial-advice-adjacent tools are regulated differently 
          in some states. Review your state's requirements.
        </p>

        {onLearnMore && (
          <button onClick={onLearnMore} className="disclaimer-learn-more" aria-label="Read full legal information">
            Learn More
          </button>
        )}
      </div>
    </aside>
  );
};

export default LegalDisclaimer;