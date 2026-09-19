import React, { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { LoanForm } from './components/LoanForm';
import DetailedReport from './components/reports/DetailedReport';
import UnlockButton from './components/payment-gate/UnlockButton';
import { PrivateOnlyUserFlow } from './components/edge-cases/PrivateOnlyUserFlow';
import { FFELPerkinsDeadlineMessage } from './components/edge-cases/FFELPerkinsDeadlineMessage';
import { OutOfRangeInputValidation } from './components/validation/OutOfRangeInputValidation';

const App: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Edge case state (in production, determined from analysis engine)
  const hasFFELPerkins = true;
  const allPrivateLoans = false;
  const currentYear = new Date().getFullYear();

  const handleFormSubmit = async (loans: any[], borrower: any) => {
    setAnalysisResult({
      count: 3,
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
        showResults && analysisResult && (
          <>
            <h1>Free Teaser Results</h1>

            {/* Edge Case: All Private Loans */}
            {allPrivateLoans && (
              <PrivateOnlyUserFlow allPrivateLoans={allPrivateLoans} />
            )}

            {/* Edge Case: FFEL/Perkins Past Deadline */}
            {hasFFELPerkins && currentYear > 2026 && (
              <FFELPerkinsDeadlineMessage />
            )}

            {/* Out-of-Range Input Validation Example */}
            <OutOfRangeInputValidation 
              fieldName="Interest Rate"
              currentValue={35.5}
              min={0}
              max={25}
            />

            <DetailedReport 
              strategies={analysisResult.headlines.map((h: string, i: number) => ({
                id: `strategy-${i}`,
                title: h,
                estimatedNewPayment: 300 - (i * 10),
                monthlySavings: i > 0 ? undefined : 45,
                tradeoffs: ['Consider eligibility requirements'],
                actionChecklist: [{ step: 'Visit provider website', status: 'pending' as const }],
                providerLink: 'https://studentaid.gov',
                onUnlock: () => Promise.resolve(),
              }))}
              priceId="price_studentloan9"
              sessionToken="test-session-token"
            />

            <UnlockButton onUnlock={() => Promise.resolve()} priceId="price_studentloan9" />
          </>
        )
      )}
    </div>
  );
};

export default App;