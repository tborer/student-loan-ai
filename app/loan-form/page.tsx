'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// Define Loan type explicitly to avoid TypeScript errors
interface Loan {
  id: number;
  type: string;
  balance: number;
  interestRate: number;
  servicer?: string;
}

export default function LoanFormPage() {
  const router = useRouter();
  
  // Form state with proper typing
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Mock analysis result (in production, this would call the backend)
  const runAnalysis = async () => {
    // Validate inputs
    if (loans.length === 0) {
      setError('Please add at least one loan.');
      return;
    }
    
    try {
      // Simulate analysis call to serverless function
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      router.push('/results');
    } catch (err) {
      setError('An error occurred while submitting your analysis request.');
    }
  };

  return (
    <main className="loan-form-page">
      <div className="container">
        <header>
          <h1>Analyze Your Student Loans</h1>
          <p className="intro">Enter your loan details and borrower information below. We&apos;ll generate a free teaser analysis first.</p>
        </header>

        {error && (
          <div className="error-message" role="alert">
            <p>{error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Loan Add Section */}
        <section className="add-loan">
          <h2>Add Loans</h2>
          <button 
            onClick={() => {
              const newLoan: Loan = { 
                id: Date.now(), 
                type: '', 
                balance: 0, 
                interestRate: 0 
              };
              setLoans([...loans, newLoan]);
            }}
          >
            + Add Another Loan
          </button>
        </section>

        {/* Loan Details (rendered once per loan) */}
        <div className="loan-details-list">
          {loans.map((loan) => (
            <fieldset key={loan.id} className="loan-fieldset">
              <legend>Loan #{loans.indexOf(loan) + 1}</legend>
              
              <div className="form-row">
                <label htmlFor={`loan-type-${loan.id}`} className="required">
                  Loan Type *
                </label>
                <select
                  id={`loan-type-${loan.id}`}
                  value={loan.type}
                  onChange={(e) => {
                    const updatedLoans = [...loans];
                    updatedLoans[updatedLoans.indexOf(loan)] = {
                      ...loan,
                      type: e.target.value as string,
                    };
                    setLoans(updatedLoans);
                  }}
                >
                  <option value="">Select a loan type...</option>
                  <option value="Direct Subsidized">Direct Subsidized</option>
                  <option value="Direct Unsubsidized">Direct Unsubsidized</option>
                  <option value="Direct PLUS">Direct PLUS</option>
                  <option value="FFEL">FFEL</option>
                  <option value="Perkins">Perkins</option>
                  <option value="Private">Private</option>
                </select>
              </div>

              <div className="form-row">
                <label htmlFor={`balance-${loan.id}`} className="required">
                  Balance ($) *
                </label>
                <input
                  id={`balance-${loan.id}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={loan.balance}
                  onChange={(e) => {
                    const updatedLoans = [...loans];
                    updatedLoans[updatedLoans.indexOf(loan)] = {
                      ...loan,
                      balance: parseFloat(e.target.value) || 0,
                    };
                    setLoans(updatedLoans);
                  }}
                />
              </div>

              <div className="form-row">
                <label htmlFor={`interest-${loan.id}`} className="required">
                  Interest Rate (%) *
                </label>
                <input
                  id={`interest-${loan.id}`}
                  type="number"
                  min="0"
                  max="25"
                  step="0.01"
                  value={loan.interestRate}
                  onChange={(e) => {
                    const updatedLoans = [...loans];
                    updatedLoans[updatedLoans.indexOf(loan)] = {
                      ...loan,
                      interestRate: parseFloat(e.target.value) || 0,
                    };
                    setLoans(updatedLoans);
                  }}
                />
                <small className="help-text">Valid range: 0-25%</small>
              </div>

              <div className="form-row">
                <label htmlFor={`servicer-${loan.id}`} className="optional">
                  Servicer (improves accuracy)
                </label>
                <input
                  id={`servicer-${loan.id}`}
                  type="text"
                  placeholder="e.g., MOHELA, Aidvantage Federal"
                  value={loan.servicer || ''}
                  onChange={(e) => {
                    const updatedLoans = [...loans];
                    updatedLoans[updatedLoans.indexOf(loan)] = {
                      ...loan,
                      servicer: e.target.value,
                    };
                    setLoans(updatedLoans);
                  }}
                />
              </div>
            </fieldset>
          ))}
        </div>

        {/* Borrower Information */}
        <section className="borrower-info">
          <h2>Borrower Information</h2>
          
          <div className="form-row">
            <label htmlFor="annualIncome" className="required">
              Annual gross income ($) *
            </label>
            <input
              id="annualIncome"
              type="number"
              min="0"
              placeholder="e.g., 45000 (or $0 if unemployed)"
            />
          </div>

          <div className="form-row">
            <label htmlFor="householdSize" className="required">
              Household size *
            </label>
            <input
              id="householdSize"
              type="number"
              min="1"
              defaultValue={1}
            />
          </div>

          <div className="form-row">
            <label htmlFor="filingStatus" className="required">
              Filing status *
            </label>
            <select id="filingStatus">
              <option value="Single">Single</option>
              <option value="Married Filing Jointly">Married Filing Jointly</option>
              <option value="Married Filing Separately">Married Filing Separately</option>
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="stateOfResidence" className="optional">
              State of residence (improves accuracy for state programs)
            </label>
            <input id="stateOfResidence" type="text" placeholder="e.g., CA, NY" />
          </div>

          <div className="form-row">
            <label htmlFor="employmentSector" className="required">
              Employment sector *
            </label>
            <select id="employmentSector">
              <option value="Nonprofit/Government (PSLF)">Nonprofit/Government (PSLF)</option>
              <option value="Private">Private</option>
              <option value="Self-employed">Self-employed</option>
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="yearsInQualifyingRepayment" className="optional">
              Years in qualifying repayment (improves PSLF progress estimate)
            </label>
            <input id="yearsInQualifyingRepayment" type="number" min="0" />
          </div>

          <div className="form-row">
            <label htmlFor="creditScoreBand" className="optional">
              Credit score band (improves refinance rate estimate)
            </label>
            <select id="creditScoreBand">
              <option value="<650">&lt;650</option>
              <option value="650-699">650-699</option>
              <option value="700-749">700-749</option>
              <option value="750+">750+</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button 
              onClick={runAnalysis}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Analyze My Loans
            </button>
            <button onClick={() => router.push('/')} className="btn-secondary">
              Back to Home
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}