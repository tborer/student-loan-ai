import React, { useState } from 'react';
import './loan-form.css';

export interface Loan {
  id?: string;
  type: 'Direct Subsidized' | 'Direct Unsubsidized' | 'Direct PLUS' | 'FFEL' | 'Perkins' | 'Private';
  balance: number;
  interestRate: number; // percentage
  servicer?: string;
}

export interface BorrowerInfo {
  annualIncome: number;
  householdSize: number;
  filingStatus: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately';
  stateOfResidence?: string;
  employmentSector: 'Nonprofit/Government (PSLF)' | 'Private' | 'Self-employed';
  yearsInQualifyingRepayment?: number;
  creditScoreBand?: '<650' | '650-699' | '700-749' | '750+';
}

interface LoanFormProps {
  onSubmit: (loans: Loan[], borrower: BorrowerInfo) => Promise<void>;
  onReset?: () => void;
}

export const LoanForm: React.FC<LoanFormProps> = ({ onSubmit, onReset }) => {
  const [error, setError] = useState<string | null>(null);

  // Loan fields
  const [loanTypes, setLoanTypes] = useState<Loan['type'][]>(['Direct Subsidized']);
  
  const loanTypeOptions: Array<{value: Loan['type']; label: string}> = [
    { value: 'Direct Subsidized', label: 'Direct Subsidized' },
    { value: 'Direct Unsubsidized', label: 'Direct Unsubsidized' },
    { value: 'Direct PLUS', label: 'Direct PLUS' },
    { value: 'FFEL', label: 'FFEL' },
    { value: 'Perkins', label: 'Perkins' },
    { value: 'Private', label: 'Private' },
  ];

  // Borrower fields
  const [annualIncome, setAnnualIncome] = useState<string>('');
  const [householdSize, setHouseholdSize] = useState<number>(1);
  const [filingStatus, setFilingStatus] = useState<'Single' | 'Married Filing Jointly' | 'Married Filing Separately'>('Single');
  const [stateOfResidence, setStateOfResidence] = useState<string>('');
  const [employmentSector, setEmploymentSector] = useState<'Nonprofit/Government (PSLF)' | 'Private' | 'Self-employed'>('Nonprofit/Government (PSLF)');
  const [yearsInQualifyingRepayment, setYearsInQualifyingRepayment] = useState<string>('');
  const [creditScoreBand, setCreditScoreBand] = useState<'<650' | '650-699' | '700-749' | '750+'>('<650');

  const handleLoanTypeToggle = (type: Loan['type']) => {
    if (loanTypes.includes(type)) {
      setLoanTypes(loanTypes.filter(t => t !== type));
    } else if (loanTypes.length < 10) {
      setLoanTypes([...loanTypes, type]);
    }
  };

  const handleRemoveLoanType = (type: Loan['type']) => {
    setLoanTypes(loanTypes.filter(t => t !== type));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (loanTypes.length === 0) {
      setError('Please select at least one loan.');
      return;
    }

    const parsedIncome = Number(annualIncome);
    if (annualIncome.trim() === '' || Number.isNaN(parsedIncome) || parsedIncome < 0) {
      setError('Annual gross income must be $0 or greater.');
      return;
    }

    if (!householdSize || householdSize < 1) {
      setError('Household size must be at least 1.');
      return;
    }

    try {
      // Submit to backend
      await onSubmit(
        loanTypes.map(type => ({ type, balance: 0, interestRate: 0 })), // Placeholder - would be filled from form fields
        {
          annualIncome: parsedIncome,
          householdSize,
          filingStatus,
          stateOfResidence,
          employmentSector,
          yearsInQualifyingRepayment: yearsInQualifyingRepayment ? Number(yearsInQualifyingRepayment) : undefined,
          creditScoreBand,
        }
      );
    } catch (err) {
      setError('An error occurred while submitting your analysis request.');
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  return (
    <form className="loan-form" onSubmit={handleSubmit} aria-labelledby="form-heading">
      <h2 id="form-heading" className="visually-hidden">Loan and Borrower Information Form</h2>
      
      {error && <div className="error-message" role="alert">{error}</div>}

      {/* Loan Selection */}
      <fieldset className="field-group">
        <legend>Loans (select all that apply)</legend>
        <div className="loan-options" role="group" aria-label="Loan type selection">
          {loanTypeOptions.map(option => (
            <label key={option.value} className="loan-option">
              <input
                type="checkbox"
                checked={loanTypes.includes(option.value)}
                onChange={() => handleLoanTypeToggle(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Loan-specific fields (rendered once per selected loan) */}
      <div className="loan-details-section">
        <h3>Loan Details</h3>
        <p className="help-text">Fields below will repeat for each loan you select.</p>
        <input type="text" placeholder="Balance ($)" aria-label="Loan balance" />
        <input type="number" placeholder="Interest rate (%)" step="0.01" min="0" max="25" aria-label="Loan interest rate (0-25%)" />
        <select aria-label="Servicer (optional)">
          <option value="">Improves accuracy - leave blank if not sure</option>
          {/* More options */}
        </select>
      </div>

      {/* Borrower Info */}
      <fieldset className="field-group">
        <legend>Borrower Information</legend>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="annualIncome">Annual gross income ($):</label>
            <input
              id="annualIncome"
              type="number"
              min="0"
              value={annualIncome}
              onChange={(e) => setAnnualIncome(e.target.value)}
              aria-describedby="income-help"
            />
            <span id="income-help" className="help-text">Required. $0 is valid (unemployed).</span>
          </div>

          <div className="form-field">
            <label htmlFor="householdSize">Household size:</label>
            <input
              id="householdSize"
              type="number"
              min="1"
              value={householdSize}
              onChange={(e) => setHouseholdSize(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="filingStatus">Filing status:</label>
            <select
              id="filingStatus"
              value={filingStatus}
              onChange={(e) => setFilingStatus(e.target.value as any)}
            >
              <option value="Single">Single</option>
              <option value="Married Filing Jointly">Married Filing Jointly</option>
              <option value="Married Filing Separately">Married Filing Separately</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="employmentSector">Employment sector:</label>
            <select
              id="employmentSector"
              value={employmentSector}
              onChange={(e) => setEmploymentSector(e.target.value as any)}
            >
              <option value="Nonprofit/Government (PSLF)">Nonprofit/Government (PSLF)</option>
              <option value="Private">Private</option>
              <option value="Self-employed">Self-employed</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="stateOfResidence">State of residence (optional):</label>
            <input
              id="stateOfResidence"
              type="text"
              value={stateOfResidence}
              onChange={(e) => setStateOfResidence(e.target.value)}
              placeholder="Improves accuracy for state-specific programs"
            />
          </div>

          <div className="form-field">
            <label htmlFor="yearsInQualifyingRepayment">Years in qualifying repayment (optional):</label>
            <input
              id="yearsInQualifyingRepayment"
              type="number"
              min="0"
              value={yearsInQualifyingRepayment}
              onChange={(e) => setYearsInQualifyingRepayment(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="creditScoreBand">Credit score band (optional):</label>
            <select
              id="creditScoreBand"
              value={creditScoreBand}
              onChange={(e) => setCreditScoreBand(e.target.value as any)}
            >
              <option value="<650">&lt;650</option>
              <option value="650-699">650-699</option>
              <option value="700-749">700-749</option>
              <option value="750+">750+</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* Actions */}
      <div className="form-actions">
        <button type="submit" className="btn-primary">Analyze My Loans</button>
        {onReset && (
          <button type="button" onClick={handleReset} className="btn-secondary">Reset Form</button>
        )}
      </div>

      {/* Accessibility */}
      <style>{`
        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </form>
  );
};

export default LoanForm;