import React from 'react';

export interface OutOfRangeInputProps {
  fieldName: string;
  currentValue: number;
  min?: number;
  max?: number;
}

export const OutOfRangeInputValidation: React.FC<OutOfRangeInputProps> = ({
  fieldName,
  currentValue,
  min,
  max,
}) => {
  if (min === undefined && max === undefined) return null;

  const isBelowMin = currentValue < (min || 0);
  const isAboveMax = currentValue > (max || Infinity);

  if (!isBelowMin && !isAboveMax) return null;

  const errorType = isBelowMin ? 'below' : 'above';
  const boundValue = min ?? max ?? 25; // Fallback to reasonable default

  return (
    <div className="validation-error" role="alert">
      <style>{`
        .validation-error {
          background: #fef2f2;
          border-left: 4px solid #ef4444;
          padding: var(--spacing-sm) var(--spacing-md);
          margin-top: var(--spacing-xs);
          border-radius: var(--border-radius);
          font-size: 0.875rem;
          color: #991b1b;
        }

        .validation-error h4 {
          margin: 0 0 var(--spacing-xs) 0;
          font-size: 0.875rem;
        }

        .validation-error ul {
          margin: 0;
          padding-left: var(--spacing-md);
          font-size: 0.75rem;
        }

        .validation-error li {
          margin-bottom: var(--spacing-xxs);
        }
      `}</style>

      <h4>Value Out of Range for {fieldName}:</h4>
      <ul>
        <li>Current: ${currentValue.toFixed(2)}</li>
        <li>Valid range: ${min || 0}% to ${max || 100}% (or valid)</li>
        <li>Accepted values for this field are reasonable (e.g., 0-25% interest rate)</li>
      </ul>
    </div>
  );
};

export default OutOfRangeInputValidation;