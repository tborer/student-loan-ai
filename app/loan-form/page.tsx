'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BorrowerInfo, Loan } from '@/components/LoanForm';
import { runAnalysis } from '@/utils/analysis';
import { analysisConfig } from '../lib/config';
import { storeAnalysis } from '../lib/analysis-session';

/**
 * Numeric fields are held as strings so the inputs can be genuinely empty
 * rather than showing a spurious 0. They are parsed and validated on submit.
 */
interface FormLoan {
  id: string;
  type: Loan['type'] | '';
  balance: string;
  interestRate: string;
  servicer: string;
}

const LOAN_TYPES: Loan['type'][] = [
  'Direct Subsidized',
  'Direct Unsubsidized',
  'Direct PLUS',
  'FFEL',
  'Perkins',
  'Private',
];

const blankLoan = (): FormLoan => ({
  id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type: '',
  balance: '',
  interestRate: '',
  servicer: '',
});

export default function LoanFormPage() {
  const router = useRouter();

  const [loans, setLoans] = useState<FormLoan[]>([blankLoan()]);
  const [annualIncome, setAnnualIncome] = useState('');
  const [householdSize, setHouseholdSize] = useState('1');
  const [filingStatus, setFilingStatus] =
    useState<BorrowerInfo['filingStatus']>('Single');
  const [stateOfResidence, setStateOfResidence] = useState('');
  const [employmentSector, setEmploymentSector] =
    useState<BorrowerInfo['employmentSector']>('Private');
  const [yearsInQualifyingRepayment, setYearsInQualifyingRepayment] = useState('');
  const [creditScoreBand, setCreditScoreBand] = useState<'' | NonNullable<BorrowerInfo['creditScoreBand']>>('');

  const [errors, setErrors] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const updateLoan = (id: string, patch: Partial<FormLoan>) => {
    setLoans((current) =>
      current.map((loan) => (loan.id === id ? { ...loan, ...patch } : loan))
    );
  };

  const removeLoan = (id: string) => {
    setLoans((current) => current.filter((loan) => loan.id !== id));
  };

  /** Validation mirrors the field rules in the functional spec. */
  const validate = (): { messages: string[]; loans: Loan[]; borrower: BorrowerInfo } => {
    const messages: string[] = [];

    if (loans.length === 0) {
      messages.push('Add at least one loan.');
    }

    const parsedLoans: Loan[] = [];
    loans.forEach((loan, index) => {
      const label = `Loan #${index + 1}`;

      if (!loan.type) {
        messages.push(`${label}: choose a loan type.`);
      }

      const balance = Number(loan.balance);
      if (loan.balance.trim() === '' || Number.isNaN(balance) || balance <= 0) {
        messages.push(`${label}: balance must be greater than $0.`);
      }

      const interestRate = Number(loan.interestRate);
      if (
        loan.interestRate.trim() === '' ||
        Number.isNaN(interestRate) ||
        interestRate < 0 ||
        interestRate > 25
      ) {
        messages.push(`${label}: interest rate must be between 0% and 25%.`);
      }

      if (loan.type && balance > 0 && interestRate >= 0 && interestRate <= 25) {
        parsedLoans.push({
          id: loan.id,
          type: loan.type,
          balance,
          interestRate,
          servicer: loan.servicer.trim() || undefined,
        });
      }
    });

    // $0 is a valid income (unemployed) per the spec, so only blank,
    // non-numeric or negative is rejected.
    const income = Number(annualIncome);
    if (annualIncome.trim() === '' || Number.isNaN(income) || income < 0) {
      messages.push('Annual gross income must be $0 or greater.');
    }

    const household = Number(householdSize);
    if (!Number.isInteger(household) || household < 1) {
      messages.push('Household size must be at least 1.');
    }

    const years = yearsInQualifyingRepayment.trim();
    if (years !== '' && (Number.isNaN(Number(years)) || Number(years) < 0)) {
      messages.push('Years in qualifying repayment must be 0 or greater.');
    }

    const borrower: BorrowerInfo = {
      annualIncome: income,
      householdSize: household,
      filingStatus,
      stateOfResidence: stateOfResidence.trim() || undefined,
      employmentSector,
      yearsInQualifyingRepayment: years === '' ? undefined : Number(years),
      creditScoreBand: creditScoreBand || undefined,
    };

    return { messages, loans: parsedLoans, borrower };
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const { messages, loans: parsedLoans, borrower } = validate();
    if (messages.length > 0) {
      setErrors(messages);
      return;
    }

    setErrors([]);
    setIsAnalyzing(true);

    try {
      const result = runAnalysis(parsedLoans, borrower, analysisConfig);
      const stored = storeAnalysis(result);

      if (!stored) {
        setErrors([
          'Your browser blocked session storage, so we could not hold your results. Enable storage for this site and try again.',
        ]);
        setIsAnalyzing(false);
        return;
      }

      router.push('/results');
    } catch (error) {
      console.error('Analysis failed:', error);
      setErrors(['Something went wrong while analyzing your loans. Please try again.']);
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="loan-form-page">
      <div className="container">
        <header>
          <h1>Analyze Your Student Loans</h1>
          <p className="intro">
            Enter your loan details and borrower information below. We&apos;ll generate a free
            teaser analysis first.
          </p>
        </header>

        {errors.length > 0 && (
          <div className="error-message" role="alert">
            <p>Please fix the following:</p>
            <ul>
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <section className="add-loan">
            <h2>Your Loans</h2>

            <div className="loan-details-list">
              {loans.map((loan, index) => (
                <fieldset key={loan.id} className="loan-fieldset">
                  <legend>Loan #{index + 1}</legend>

                  <div className="form-row">
                    <label htmlFor={`loan-type-${loan.id}`}>Loan type *</label>
                    <select
                      id={`loan-type-${loan.id}`}
                      value={loan.type}
                      onChange={(e) =>
                        updateLoan(loan.id, { type: e.target.value as FormLoan['type'] })
                      }
                    >
                      <option value="">Select a loan type...</option>
                      {LOAN_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <label htmlFor={`balance-${loan.id}`}>Balance ($) *</label>
                    <input
                      id={`balance-${loan.id}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={loan.balance}
                      onChange={(e) => updateLoan(loan.id, { balance: e.target.value })}
                    />
                  </div>

                  <div className="form-row">
                    <label htmlFor={`interest-${loan.id}`}>Interest rate (%) *</label>
                    <input
                      id={`interest-${loan.id}`}
                      type="number"
                      min="0"
                      max="25"
                      step="0.01"
                      value={loan.interestRate}
                      onChange={(e) => updateLoan(loan.id, { interestRate: e.target.value })}
                      aria-describedby={`interest-help-${loan.id}`}
                    />
                    <small id={`interest-help-${loan.id}`} className="help-text">
                      Valid range: 0-25%
                    </small>
                  </div>

                  <div className="form-row">
                    <label htmlFor={`servicer-${loan.id}`}>Servicer (improves accuracy)</label>
                    <input
                      id={`servicer-${loan.id}`}
                      type="text"
                      placeholder="e.g., MOHELA, Aidvantage"
                      value={loan.servicer}
                      onChange={(e) => updateLoan(loan.id, { servicer: e.target.value })}
                    />
                  </div>

                  {loans.length > 1 && (
                    <button type="button" onClick={() => removeLoan(loan.id)}>
                      Remove Loan #{index + 1}
                    </button>
                  )}
                </fieldset>
              ))}
            </div>

            <button type="button" onClick={() => setLoans((c) => [...c, blankLoan()])}>
              + Add Another Loan
            </button>
          </section>

          <section className="borrower-info">
            <h2>Borrower Information</h2>

            <div className="form-row">
              <label htmlFor="annualIncome">Annual gross income ($) *</label>
              <input
                id="annualIncome"
                type="number"
                min="0"
                placeholder="e.g., 45000 (enter 0 if unemployed)"
                value={annualIncome}
                onChange={(e) => setAnnualIncome(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="householdSize">Household size *</label>
              <input
                id="householdSize"
                type="number"
                min="1"
                value={householdSize}
                onChange={(e) => setHouseholdSize(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="filingStatus">Filing status *</label>
              <select
                id="filingStatus"
                value={filingStatus}
                onChange={(e) =>
                  setFilingStatus(e.target.value as BorrowerInfo['filingStatus'])
                }
              >
                <option value="Single">Single</option>
                <option value="Married Filing Jointly">Married Filing Jointly</option>
                <option value="Married Filing Separately">Married Filing Separately</option>
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="employmentSector">Employment sector *</label>
              <select
                id="employmentSector"
                value={employmentSector}
                onChange={(e) =>
                  setEmploymentSector(e.target.value as BorrowerInfo['employmentSector'])
                }
              >
                <option value="Nonprofit/Government (PSLF)">Nonprofit/Government</option>
                <option value="Private">Private</option>
                <option value="Self-employed">Self-employed</option>
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="stateOfResidence">
                State of residence (improves accuracy for state programs)
              </label>
              <input
                id="stateOfResidence"
                type="text"
                placeholder="e.g., CA, NY"
                value={stateOfResidence}
                onChange={(e) => setStateOfResidence(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="yearsInQualifyingRepayment">
                Years in qualifying repayment (improves PSLF progress estimate)
              </label>
              <input
                id="yearsInQualifyingRepayment"
                type="number"
                min="0"
                value={yearsInQualifyingRepayment}
                onChange={(e) => setYearsInQualifyingRepayment(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="creditScoreBand">
                Credit score band (improves refinance rate estimate)
              </label>
              <select
                id="creditScoreBand"
                value={creditScoreBand}
                onChange={(e) =>
                  setCreditScoreBand(
                    e.target.value as '' | NonNullable<BorrowerInfo['creditScoreBand']>
                  )
                }
              >
                <option value="">Prefer not to say</option>
                <option value="<650">Below 650</option>
                <option value="650-699">650-699</option>
                <option value="700-749">700-749</option>
                <option value="750+">750 or above</option>
              </select>
            </div>
          </section>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isAnalyzing}>
              {isAnalyzing ? 'Analyzing...' : 'Analyze My Loans'}
            </button>
            <button type="button" onClick={() => router.push('/')} className="btn-secondary">
              Back to Home
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
