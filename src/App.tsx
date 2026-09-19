import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { LoanForm } from './components/LoanForm';

// Placeholder backend API for analysis submission
const submitAnalysis = async (loans: any[], borrower: any): Promise<void> => {
  // In production, this would call the backend serverless function
  // For now, simulate a successful submission
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (borrower.annualIncome <= 0) {
    // Handle zero-income edge case per spec
  }
};

const App: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    count: number;
    headlines: string[];
    savingsRange: string | null;
  } | null>(null);

  const handleFormSubmit = async (loans: any[], borrower: any) => {
    // Run analysis (simulate - would call backend in production)
    setAnalysisResult({
      count: 3, // Simulated finding
      headlines: [
        'Refinancing could lower your rate',
        'You may qualify for income-driven repayment',
        'Consolidating could unlock other benefits',
      ],
      savingsRange: '$1,200-$4,800/year potential',
    });
    setShowForm(false);
    setShowResults(true);
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setShowForm(false);
    setShowResults(false);
  };

  return (
    <div className="app-container">
      {!showForm && !showResults ? (
        <LandingPage onContinue={() => setShowForm(true)} />
      ) : (
        <>
          {showForm && !showResults && (
            <>
              <LoanForm onSubmit={handleFormSubmit} onReset={handleReset} />
              <div className="form-instruction">
                <p>After analyzing your loans, you'll see free teaser results.</p>
                <button onClick={handleReset}>Go back to home</button>
              </div>
            </>
          )}

          {showResults && (
            <div className="results-container" role="main">
              <h1>We found {analysisResult?.count} ways to potentially lower your payments!</h1>
              
              <div className="teaser-results">
                <ul className="strategies-list" aria-label="Eligible strategies">
                  {analysisResult?.headlines.map((headline, index) => (
                    <li key={index} className="strategy-item">
                      <span className="strategy-badge">{index + 1}</span>
                      <span>{headline}</span>
                    </li>
                  ))}
                </ul>

                {analysisResult?.savingsRange && (
                  <div className="savings-estimate" aria-label="Combined savings estimate">
                    <span className="label">Combined savings range:</span>
                    <span>{analysisResult.savingsRange}</span>
                    <span className="disclaimer">(rough estimate)</span>
                  </div>
                )}

                <div className="lock-cta" role="region" aria-label="Unlock full report section">
                  <h2>View your detailed plan</h2>
                  <p className="instruction">
                    Exact numbers, action steps, and provider links are locked. 
                    Click below to unlock with one-time payment.
                  </p>
                  <button className="unlock-btn" aria-label="Unlock full report for $9-$19">
                    Unlock Full Report ($9-$19)
                  </button>
                </div>

                {/* Would include locked/blurred cards here */}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;