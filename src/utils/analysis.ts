/**
 * Student Loan Repayment Analyzer — Client-side Analysis Engine
 * 
 * This implements the analysis engine logic from the spec using configuration-driven data.
 * In production, this would be in a serverless function, but for v1 we can run client-side
 * to validate concept before adding backend complexity.
 */

import type { Loan, BorrowerInfo } from '../components/LoanForm';

/** Configuration loaded from regulatory.json */
interface RegulatoryConfig {
  repaymentPlans: {
    SAVE: { status: string; effectiveFor: string | null };
    IBR: { status: string; planMinPayment: number };
    RAP: { status: string; effectiveDate: string; agilPercentRange: [number, number] };
    PAYE: { status: string };
    ICR: { status: string };
    tieredStandard: { terms: number[] };
  };
  rapBrackets: Array<{ agiPercentMin: number; agiPercentMax: number; paymentPercent: number }>;
  idrPlans: Array<{ name: string; status: string; planMinPayment: number; discretionaryIncomeFormula: boolean }>;
}

/** Configuration loaded from providers.json */
interface ProviderConfig {
  refinanceLenders: Array<{ name: string; url: string; creditTierMin?: string }>;
  federalPortals: Array<{ name: string; url: string; type: 'federal_idr' | 'consolidation' | 'pslf' }>;
}

interface AnalysisResult {
  eligibleStrategies: Array<{
    id: string;
    title: string;
    savingsEstimate?: number | null;
    tradeoffs?: string[];
  }>;
  ineligibleFor: string[];
  recommendations: string[];
}

/**
 * Run analysis engine based on loan/borrower data and configuration.
 * Returns eligibility and savings estimates per strategy family.
 */
export const runAnalysis = (
  loans: Loan[],
  borrower: BorrowerInfo,
  config: RegulatoryConfig & ProviderConfig
): AnalysisResult => {
  const results: AnalysisResult = {
    eligibleStrategies: [],
    ineligibleFor: [],
    recommendations: [],
  };

  // Calculate weighted average interest rate
  const totalBalance = loans.reduce((sum, loan) => sum + loan.balance, 0);
  const weightedAverageRate =
    totalBalance > 0
      ? loans.reduce((sum, loan) => sum + (loan.balance * loan.interestRate), 0) / totalBalance
      : 0;

  // Helper: Check federal eligibility
  const hasFederalLoans = loans.some(
    l => l.type !== 'Private' && !l.type.startsWith('Perkins') || ['Direct', 'PLUS'].includes(l.type.split(' ')[0])
  );

  // Strategy A: Refinance eligibility
  if (!hasFederalLoans) {
    results.eligibleStrategies.push({
      id: 'refinance',
      title: 'Refinancing with Private Lender',
      savingsEstimate: calculateRefinanceSavings(weightedAverageRate, borrower.creditScoreBand),
      tradeoffs: [
        'Converts federal loans to private (loses PSLF/IDR eligibility)',
        'Good for pure refinancing (no federal loans)'
      ],
    });
  } else {
    results.ineligibleFor.push('Refinancing — would lose federal protections');
  }

  // Strategy B: Income-Driven Repayment (IBR/RAP)
  const idrPlans = config.idrPlans.filter(plan => plan.status === 'active');
  
  if (hasFederalLoans) {
    for (const plan of idrPlans) {
      results.eligibleStrategies.push({
        id: `idr_${plan.name.toLowerCase()}`,
        title: `Income-Driven Repayment (${plan.name})`,
        savingsEstimate: calculateIdrPayment(borrower, plan),
        tradeoffs: [
          'Payments based on income',
          'Eligible for forgiveness after term (20/25 years)',
          `${plan.name === 'IBR' ? 'Permanent status.' : 'New as of July 1, 2026.'}`
        ],
      });
    }
  } else {
    results.recommendations.push('Consolidate FFEL/Perkins loans to access federal IDR plans');
  }

  // Strategy C: Consolidation
  const ffelOrParentPlusLoans = loans.some(
    l => ['FFEL', 'Perkins', 'Parent PLUS'].includes(l.type.split(' ')[0])
  );

  if (ffelOrParentPlusLoans) {
    results.eligibleStrategies.push({
      id: 'consolidation',
      title: 'Federal Loan Consolidation',
      savingsEstimate: calculateConsolidationSavings(loans, weightedAverageRate),
      tradeoffs: [
        'Combines multiple loans into one payment',
        'New rate = weighted average (rounded up to 1/8%)',
        'May improve PSLF eligibility if currently ineligible'
      ],
    });
  }

  // Strategy D: PSLF
  const pslfEligibleEmployment = borrower.employmentSector === 'Nonprofit/Government (PSLF)';
  if (pslfEligibleEmployment && hasFederalLoans) {
    results.eligibleStrategies.push({
      id: 'pslf',
      title: 'Public Service Loan Forgiveness (PSLF)',
      savingsEstimate: null, // Not a savings, it's forgiveness
      tradeoffs: [
        'Requires qualifying employer (nonprofit/government)',
        'Requires 120 qualifying payments',
        'Must be enrolled in qualifying repayment plan'
      ],
    });
  }

  // Ranking: Order by dollar impact (or eligibility strength for PSLF)
  const rankedStrategies = results.eligibleStrategies.sort((a, b) => {
    if (a.savingsEstimate === null && b.savingsEstimate !== null) return 1;
    if (b.savingsEstimate === null && a.savingsEstimate !== null) return -1;
    return (b.savingsEstimate || 0) - (a.savingsEstimate || 0);
  });

  // Add provider links
  rankedStrategies.forEach(strategy => {
    const provider = config.refinanceLenders.find(l => 
      l.name.toLowerCase() === strategy.title.toLowerCase().replace(/income-driven repayment/i, '').trim()
    ) || config.federalPortals.find(p => p.type.includes(strategy.id.split('_')[1]));
    
    if (provider) {
      // In production, attach provider data to strategy object
    }
  });

  return results;
};

/** Calculate refinance savings estimate based on credit score tier */
const calculateRefinanceSavings = (currentRate: number, creditScoreBand?: string): number | null => {
  const illustrativeRates: Record<string, number> = {
    '<650': 12.0,
    '650-699': 10.5,
    '700-749': 8.5,
    '750+': 6.5,
  };

  const rate = (creditScoreBand && illustrativeRates[creditScoreBand]) || 10.0;
  const gap = currentRate - rate;
  
  if (gap <= 0) return null; // No savings possible
  
  // Estimate: assuming $25k total balance for illustration
  const estimatedBalance = 25000;
  const annualSavings = gap * estimatedBalance / 100;
  
  return Math.round(annualSavings);
};

/** Calculate IDR monthly payment estimate */
const calculateIdrPayment = (borrower: BorrowerInfo, plan: { name: string; planMinPayment: number }): number | null => {
  const povertyLines: Record<number, number> = {
    1: 16940, // single individual
    2: 20608, // size 2
    3: 24387,
    4: 28156,
  };

  const povertyLine = povertyLines[borrower.householdSize] || 16940;
  const discretionaryIncome = borrower.annualIncome - (povertyLine * 0.2); // 20% multiplier example
  
  // Simplified IBR: ~15% of discretionary income for Direct loans before July 1, 2026
  const monthlyPayment = Math.max(discretionaryIncome * 0.15 / 12, plan.planMinPayment);
  
  return Math.round(monthlyPayment);
};

/** Calculate consolidation savings estimate */
const calculateConsolidationSavings = (loans: Loan[], currentWeightedRate: number): number | null => {
  // New rate after consolidation typically similar to weighted average
  // Savings come from simplified payments, not rate reduction
  return null; // No direct savings from rate change alone
};

export default runAnalysis;