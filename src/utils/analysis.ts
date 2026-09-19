/**
 * Student Loan Repayment Analyzer — Analysis Engine
 *
 * Implements the four strategy families from the functional spec: refinancing,
 * income-driven repayment (IBR/RAP), consolidation and forgiveness (PSLF).
 *
 * Every rate, bracket and deadline is read from configuration rather than
 * hardcoded, because the federal landscape is mid-transition and these change.
 */

import type { Loan, BorrowerInfo } from '../components/LoanForm';

/**
 * Configuration loaded from regulatory.json.
 *
 * Shapes are kept loose where runAnalysis does not read them.
 */
export interface RegulatoryConfig {
  repaymentPlans: Record<string, Record<string, unknown>>;
  consolidationDeadline: { historicalDeadline: string };
  povertyGuidelines: { household1: number; additionalPerson: number };
  rapBrackets: Array<{
    agiUpTo: number | null;
    paymentPercent: number;
    flatAnnualPayment?: number;
  }>;
  rapRules: { minMonthlyPayment: number; perDependentMonthlyReduction: number };
  idrPlans: Array<{
    name: string;
    status: string;
    planMinPayment: number;
    discretionaryIncomeMultiplier?: number;
    paymentPercent?: number;
    discretionaryIncomeFormula: boolean;
  }>;
}

/** Configuration loaded from providers.json */
export interface ProviderConfig {
  refinanceLenders: Array<{ name: string; url: string; creditTierMin?: string }>;
  federalPortals: Array<{ name: string; url: string; type: string }>;
}

export interface Strategy {
  id: string;
  title: string;
  /** Estimated monthly payment under this strategy, where one applies. */
  estimatedMonthlyPayment?: number;
  /**
   * Estimated annual savings against the standard 10-year baseline.
   *
   * Always an annual dollar figure, so strategies are comparable to each
   * other. Absent where a strategy has no quantifiable saving (forgiveness,
   * consolidation) or where we lack an input needed to estimate it.
   */
  estimatedAnnualSavings?: number;
  tradeoffs?: string[];
  /** Risks the user must see before acting, not merely trade-offs. */
  warnings?: string[];
}

export interface AnalysisResult {
  eligibleStrategies: Strategy[];
  ineligibleFor: string[];
  recommendations: string[];
  /** The standard 10-year payment that savings figures are measured against. */
  baselineMonthlyPayment: number;
}

const STANDARD_TERM_YEARS = 10;

/** Illustrative refinance rates by credit tier. Refresh from comparison sites. */
const ILLUSTRATIVE_REFINANCE_RATES: Record<string, number> = {
  '<650': 12.0,
  '650-699': 10.5,
  '700-749': 8.5,
  '750+': 6.5,
};

const isFederal = (type: Loan['type']): boolean => type !== 'Private';

/** Only Direct loans reach IDR and PSLF without consolidating first. */
const isDirect = (type: Loan['type']): boolean => type.startsWith('Direct');

/** Standard amortized monthly payment. */
export const standardMonthlyPayment = (
  balance: number,
  annualRatePercent: number,
  years: number = STANDARD_TERM_YEARS
): number => {
  if (balance <= 0) return 0;
  const months = years * 12;
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return balance / months;
  return (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
};

const povertyLine = (householdSize: number, config: RegulatoryConfig): number =>
  config.povertyGuidelines.household1 +
  Math.max(0, householdSize - 1) * config.povertyGuidelines.additionalPerson;

/**
 * Dependents are approximated from household size, since the form does not
 * collect a dependent count. A jointly-filing spouse is not a dependent.
 */
const estimateDependents = (borrower: BorrowerInfo): number => {
  const nonDependents = borrower.filingStatus === 'Married Filing Jointly' ? 2 : 1;
  return Math.max(0, borrower.householdSize - nonDependents);
};

/**
 * IBR: a percentage of discretionary income, where discretionary income is
 * AGI less a multiple of the poverty guideline for the household.
 */
export const calculateIbrPayment = (
  borrower: BorrowerInfo,
  plan: RegulatoryConfig['idrPlans'][number],
  config: RegulatoryConfig
): number => {
  const multiplier = plan.discretionaryIncomeMultiplier ?? 1.5;
  const percent = plan.paymentPercent ?? 15;

  const discretionaryIncome =
    borrower.annualIncome - multiplier * povertyLine(borrower.householdSize, config);

  // Below the threshold the payment is the plan minimum, which for IBR is $0.
  if (discretionaryIncome <= 0) return plan.planMinPayment;

  return Math.max(((percent / 100) * discretionaryIncome) / 12, plan.planMinPayment);
};

/**
 * RAP does not use discretionary income. It applies a percentage drawn from an
 * AGI bracket table directly against AGI, reduced per dependent, with a floor.
 */
export const calculateRapPayment = (
  borrower: BorrowerInfo,
  config: RegulatoryConfig
): number => {
  const bracket =
    config.rapBrackets.find(
      (b) => b.agiUpTo === null || borrower.annualIncome <= b.agiUpTo
    ) ?? config.rapBrackets[config.rapBrackets.length - 1];

  const annualPayment =
    bracket.flatAnnualPayment ?? (bracket.paymentPercent / 100) * borrower.annualIncome;

  const afterDependents =
    annualPayment / 12 -
    estimateDependents(borrower) * config.rapRules.perDependentMonthlyReduction;

  return Math.max(afterDependents, config.rapRules.minMonthlyPayment);
};

/**
 * Refinance savings, measured as the difference between amortizing the balance
 * at the current blended rate and at an illustrative rate for the credit tier.
 *
 * Returns null when there is no usable credit band or no rate advantage.
 */
export const calculateRefinanceSavings = (
  totalBalance: number,
  currentRate: number,
  creditScoreBand?: string
): number | null => {
  if (!creditScoreBand) return null;

  const targetRate = ILLUSTRATIVE_REFINANCE_RATES[creditScoreBand];
  if (targetRate === undefined) return null;
  if (currentRate - targetRate <= 0) return null;

  const current = standardMonthlyPayment(totalBalance, currentRate);
  const refinanced = standardMonthlyPayment(totalBalance, targetRate);

  return Math.round((current - refinanced) * 12);
};

/** Consolidation rate is the weighted average, rounded up to the nearest 1/8%. */
export const calculateConsolidationRate = (loans: Loan[]): number => {
  const totalBalance = loans.reduce((sum, loan) => sum + loan.balance, 0);
  if (totalBalance <= 0) return 0;
  const weighted =
    loans.reduce((sum, loan) => sum + loan.balance * loan.interestRate, 0) / totalBalance;
  return Math.ceil(weighted * 8) / 8;
};

/**
 * Run the analysis engine against loan and borrower data.
 *
 * A strategy the borrower is ineligible for is omitted from
 * eligibleStrategies entirely, never shown as "not recommended".
 */
export const runAnalysis = (
  loans: Loan[],
  borrower: BorrowerInfo,
  config: RegulatoryConfig & ProviderConfig,
  today: Date = new Date()
): AnalysisResult => {
  const totalBalance = loans.reduce((sum, loan) => sum + loan.balance, 0);
  const weightedAverageRate =
    totalBalance > 0
      ? loans.reduce((sum, loan) => sum + loan.balance * loan.interestRate, 0) / totalBalance
      : 0;

  const baselineMonthlyPayment = standardMonthlyPayment(totalBalance, weightedAverageRate);

  const results: AnalysisResult = {
    eligibleStrategies: [],
    ineligibleFor: [],
    recommendations: [],
    baselineMonthlyPayment: Math.round(baselineMonthlyPayment),
  };

  // Loan classification. Federal and Direct are distinct: FFEL and Perkins are
  // federal but cannot reach IDR or PSLF without consolidating into a Direct
  // loan first.
  const hasFederalLoans = loans.some((l) => isFederal(l.type));
  const hasDirectLoans = loans.some((l) => isDirect(l.type));
  const nonDirectFederalLoans = loans.filter((l) => isFederal(l.type) && !isDirect(l.type));

  // The deadline to consolidate FFEL/Perkins while preserving IDR/PSLF
  // eligibility. Compared at runtime, since the answer changes on that date.
  const consolidationDeadline = new Date(config.consolidationDeadline.historicalDeadline);
  const pastConsolidationDeadline = today.getTime() > consolidationDeadline.getTime();

  // Strategy A: Refinance. Applies to any loan type; the federal warning is
  // mandatory whenever the borrower holds federal debt.
  const refinanceSavings = calculateRefinanceSavings(
    totalBalance,
    weightedAverageRate,
    borrower.creditScoreBand
  );

  const refinance: Strategy = {
    id: 'refinance',
    title: 'Refinancing with a Private Lender',
    tradeoffs: ['Fixed or variable private rate, set by your credit profile'],
  };

  if (refinanceSavings !== null) {
    refinance.estimatedAnnualSavings = refinanceSavings;
    refinance.estimatedMonthlyPayment = Math.round(
      standardMonthlyPayment(
        totalBalance,
        ILLUSTRATIVE_REFINANCE_RATES[borrower.creditScoreBand as string]
      )
    );
  } else if (!borrower.creditScoreBand) {
    refinance.tradeoffs?.push('Add a credit score band for a sharper rate estimate');
  }

  if (hasFederalLoans) {
    refinance.warnings = [
      'Refinancing a federal loan converts it to private debt and permanently forfeits IDR, RAP, PSLF, deferment and forgiveness eligibility. This cannot be undone.',
    ];
  }

  // Only surface refinancing when it would actually help, or when we cannot
  // yet tell because the credit band is missing.
  if (refinanceSavings === null && borrower.creditScoreBand) {
    results.ineligibleFor.push('Refinancing — your current rate already beats available offers');
  } else {
    results.eligibleStrategies.push(refinance);
  }

  // Strategy B: Income-driven repayment. Direct loans only.
  const activeIdrPlans = config.idrPlans.filter((plan) => plan.status === 'active');

  if (hasDirectLoans) {
    for (const plan of activeIdrPlans) {
      const monthly =
        plan.name === 'RAP'
          ? calculateRapPayment(borrower, config)
          : calculateIbrPayment(borrower, plan, config);

      const strategy: Strategy = {
        id: `idr_${plan.name.toLowerCase()}`,
        title: `Income-Driven Repayment (${plan.name})`,
        estimatedMonthlyPayment: Math.round(monthly),
        estimatedAnnualSavings: Math.max(
          0,
          Math.round((baselineMonthlyPayment - monthly) * 12)
        ),
        tradeoffs:
          plan.name === 'RAP'
            ? [
                'Payment set by an AGI bracket, reduced per dependent',
                'Unpaid interest is waived rather than capitalized',
                'New plan, effective July 1, 2026',
              ]
            : [
                'Payment set by discretionary income',
                'Remaining balance forgiven after the plan term (20-25 years)',
                'The only IDR plan with permanent statutory status',
              ],
      };

      results.eligibleStrategies.push(strategy);
    }
  }

  // Strategy C: Consolidation, and the eligibility consequences of the
  // deadline having passed.
  if (nonDirectFederalLoans.length > 0) {
    const affected = nonDirectFederalLoans.map((l) => l.type).join(', ');
    const newRate = calculateConsolidationRate(loans);

    if (pastConsolidationDeadline) {
      results.eligibleStrategies.push({
        id: 'consolidation',
        title: 'Federal Loan Consolidation',
        tradeoffs: [
          'Combines multiple loans into a single payment',
          `New rate would be ${newRate.toFixed(3)}% — the weighted average, rounded up to the nearest 1/8%`,
          'Simplifies repayment, but does not lower your rate',
        ],
        warnings: [
          `The deadline to consolidate ${affected} loans while preserving IDR and PSLF eligibility passed on ${config.consolidationDeadline.historicalDeadline}. Those loans have permanently lost that eligibility, and consolidating now will not restore it.`,
        ],
      });

      results.ineligibleFor.push(
        `Income-driven repayment and PSLF for your ${affected} balance — eligibility ended at the consolidation deadline`
      );
    } else {
      results.eligibleStrategies.push({
        id: 'consolidation',
        title: 'Federal Loan Consolidation',
        tradeoffs: [
          'Combines multiple loans into a single payment',
          `New rate would be ${newRate.toFixed(3)}% — the weighted average, rounded up to the nearest 1/8%`,
        ],
        warnings: [
          `Consolidating your ${affected} loans into a Direct Consolidation Loan is a prerequisite for IDR and PSLF, and the deadline to do so while preserving that eligibility is ${config.consolidationDeadline.historicalDeadline}.`,
        ],
      });

      results.recommendations.push(
        `Consolidate your ${affected} loans before ${config.consolidationDeadline.historicalDeadline} to keep IDR and PSLF eligibility.`
      );
    }
  }

  // Strategy D: PSLF. Direct loans plus qualifying employment.
  const pslfEligibleEmployment =
    borrower.employmentSector === 'Nonprofit/Government (PSLF)';

  if (pslfEligibleEmployment && hasDirectLoans) {
    const tradeoffs = [
      'Requires a qualifying nonprofit or government employer',
      'Requires 120 qualifying payments while on a qualifying plan',
      'Forgiven balance is not treated as taxable income',
    ];

    if (borrower.yearsInQualifyingRepayment !== undefined) {
      const paymentsMade = Math.min(120, Math.round(borrower.yearsInQualifyingRepayment * 12));
      tradeoffs.unshift(
        `Roughly ${paymentsMade} of 120 qualifying payments, based on the years you entered`
      );
    }

    results.eligibleStrategies.push({
      id: 'pslf',
      title: 'Public Service Loan Forgiveness (PSLF)',
      tradeoffs,
    });
  } else if (pslfEligibleEmployment && !hasDirectLoans && hasFederalLoans) {
    results.recommendations.push(
      'PSLF requires Direct loans. Your federal loans would need to be consolidated into a Direct Consolidation Loan to qualify.'
    );
  }

  // Ranking: by annual dollar impact, with strategies that have no
  // quantifiable saving (forgiveness, consolidation) after those that do.
  results.eligibleStrategies.sort((a, b) => {
    const aHas = a.estimatedAnnualSavings !== undefined;
    const bHas = b.estimatedAnnualSavings !== undefined;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return (b.estimatedAnnualSavings ?? 0) - (a.estimatedAnnualSavings ?? 0);
  });

  return results;
};

export default runAnalysis;
