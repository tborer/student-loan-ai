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
  rapRules: {
    minMonthlyPayment: number;
    perDependentMonthlyReduction: number;
    /**
     * Separate mechanic from perDependentMonthlyReduction, despite sharing a
     * dollar amount: RAP credits up to this much monthly principal reduction
     * even when the payment does not cover it, which is what lets a low RAP
     * payment amortize instead of growing forever.
     */
    principalMatchCap: number;
  };
  pslfRules: { qualifyingPayments: number };
  /** Federal tax treatment of a forgiven balance, keyed by plan/program name, alongside metadata siblings (note, verifyBeforeLaunch). */
  forgivenessTaxTreatment: Record<string, unknown>;
  idrPlans: Array<{
    name: string;
    status: string;
    planMinPayment: number;
    discretionaryIncomeMultiplier?: number;
    paymentPercent?: number;
    discretionaryIncomeFormula: boolean;
    /**
     * Years until any remaining balance is forgiven. IBR's is disbursement-
     * date-dependent (old/new); RAP's is a single flat term.
     */
    forgivenessTerm: { standard: number; extended: number } | number | null;
  }>;
}

/** Configuration loaded from providers.json */
export interface ProviderConfig {
  refinanceLenders: Array<{ name: string; url: string; creditTierMin?: string }>;
  federalPortals: Array<{ name: string; url: string; type: string }>;
}

/**
 * What a strategy costs over its full term, not just this month.
 *
 * This exists because "lower monthly payment" and "costs less" are different
 * claims -- a payment below the interest accrual can cost far more over the
 * life of the loan even though it feels cheaper today.
 */
export interface LifetimeCost {
  /** Total dollars paid in, over the term modeled. */
  totalPaid: number;
  /** The term actually modeled, in years (may end early on full payoff). */
  termYears: number;
  /** True if the balance reached $0 before the term ended -- no forgiveness. */
  paidOffBeforeTerm: boolean;
  /** Balance forgiven at term end. Present only when paidOffBeforeTerm is false. */
  forgivenBalance?: number;
  /** Whether that forgiven balance is treated as taxable federal income. */
  forgivenessTaxableFederal?: boolean;
  /** totalPaid minus the standard-plan baseline's totalPaid. Positive = costs more. */
  deltaVsBaseline: number;
}

export interface Strategy {
  id: string;
  title: string;
  /** Estimated monthly payment under this strategy, where one applies. */
  estimatedMonthlyPayment?: number;
  /**
   * Monthly cash-flow relief vs. the standard 10-year baseline, annualized.
   *
   * This is NOT lifetime savings -- a strategy can relieve monthly cash flow
   * while costing more overall. See lifetimeCost for the total-cost picture,
   * and lifetimeCost.deltaVsBaseline specifically for whether it actually
   * saves money.
   */
  estimatedAnnualSavings?: number;
  lifetimeCost?: LifetimeCost;
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
  /** Total paid over the standard 10-year baseline -- the reference point for every lifetimeCost.deltaVsBaseline. */
  baselineLifetimeCost: number;
}

const STANDARD_TERM_YEARS = 10;
const STANDARD_TERM_MONTHS = STANDARD_TERM_YEARS * 12;

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
 *
 * This is the borrower's monthly bill. It is a different number from the
 * principal-match mechanic in simulatePayoff below, which affects how fast
 * the balance shrinks, not what the borrower owes each month.
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

interface PayoffSimulationResult {
  totalPaid: number;
  /** Months actually elapsed, whether by payoff or hitting the term cap. */
  monthsElapsed: number;
  /** True if the balance reached $0 before maxMonths. */
  paidOffBeforeTerm: boolean;
  /** Remaining balance at maxMonths, when not paid off early. */
  endingBalance: number;
}

/**
 * Simulates a fixed monthly payment against an amortizing balance for up to
 * maxMonths, under one of two interest-shortfall rules:
 *
 *  - 'capitalizing': a payment below the month's interest lets the balance
 *    grow (unpaid interest capitalizes). This is the IBR/legacy-IDR
 *    assumption. It is the conservative direction for a tool warning about
 *    risk: if real-world treatment is actually more forgiving, this
 *    overstates the cost rather than understating it. VERIFY.
 *
 *  - 'rap-assisted': unpaid interest is waived rather than capitalized, and
 *    the borrower is credited up to principalMatchCap dollars of principal
 *    reduction each month even when their payment alone would not cover
 *    that much -- the mechanic that lets a low RAP payment still amortize.
 *
 * A constant monthly payment is itself a simplification: real IDR/RAP
 * payments are recalculated as income and household size change. This models
 * "if your situation stays the same," which is the only thing a point-in-time
 * tool can responsibly estimate.
 */
export const simulatePayoff = (
  balance: number,
  annualRatePercent: number,
  monthlyPayment: number,
  maxMonths: number,
  mode: 'capitalizing' | 'rap-assisted',
  principalMatchCap = 0
): PayoffSimulationResult => {
  const monthlyRate = annualRatePercent / 100 / 12;
  let remaining = balance;
  let totalPaid = 0;

  for (let month = 1; month <= maxMonths; month++) {
    const interest = remaining * monthlyRate;

    if (mode === 'rap-assisted') {
      const principalFromPayment = Math.max(0, monthlyPayment - interest);
      const principalReduction = Math.max(principalFromPayment, principalMatchCap);

      if (principalReduction >= remaining) {
        // Final month: don't count more than what was owed.
        totalPaid += interest + remaining;
        return { totalPaid, monthsElapsed: month, paidOffBeforeTerm: true, endingBalance: 0 };
      }
      remaining -= principalReduction;
      totalPaid += monthlyPayment;
    } else {
      if (monthlyPayment >= interest + remaining) {
        totalPaid += interest + remaining;
        return { totalPaid, monthsElapsed: month, paidOffBeforeTerm: true, endingBalance: 0 };
      }
      remaining = remaining + interest - monthlyPayment;
      totalPaid += monthlyPayment;
    }
  }

  return {
    totalPaid,
    monthsElapsed: maxMonths,
    paidOffBeforeTerm: false,
    endingBalance: Math.max(0, remaining),
  };
};

/** IBR's term is disbursement-date-dependent; extended (25yr/15%) is used until that date is collected -- see docs/engine-rules-gap-analysis.md #2.1. */
const resolveForgivenessTermYears = (
  term: RegulatoryConfig['idrPlans'][number]['forgivenessTerm']
): number => {
  if (typeof term === 'number') return term;
  if (term && typeof term === 'object') return term.extended;
  return STANDARD_TERM_YEARS;
};

const buildLifetimeCost = (
  simulation: PayoffSimulationResult,
  termYears: number,
  baselineTotalPaid: number,
  taxableFederal?: boolean
): LifetimeCost => ({
  totalPaid: Math.round(simulation.totalPaid),
  termYears,
  paidOffBeforeTerm: simulation.paidOffBeforeTerm,
  ...(simulation.paidOffBeforeTerm
    ? {}
    : {
        forgivenBalance: Math.round(simulation.endingBalance),
        forgivenessTaxableFederal: taxableFederal,
      }),
  deltaVsBaseline: Math.round(simulation.totalPaid - baselineTotalPaid),
});

/** A plain-language line for the lifetime-cost delta, so it can't be silently dropped from the UI later. */
const lifetimeCostWarning = (lifetimeCost: LifetimeCost): string | null => {
  if (lifetimeCost.deltaVsBaseline <= 0) return null;
  const extra = lifetimeCost.deltaVsBaseline.toLocaleString('en-US');
  return `Lower monthly payment, but an estimated $${extra} more paid over ${lifetimeCost.termYears} years than the standard 10-year plan.`;
};

const forgivenessWarning = (lifetimeCost: LifetimeCost): string | null => {
  if (lifetimeCost.paidOffBeforeTerm || lifetimeCost.forgivenBalance === undefined) return null;
  const amount = lifetimeCost.forgivenBalance.toLocaleString('en-US');
  if (lifetimeCost.forgivenessTaxableFederal) {
    return `An estimated $${amount} would be forgiven after ${lifetimeCost.termYears} years, and under current federal rules that amount is added to your taxable income in the year it's forgiven. Consult a tax professional before relying on this plan for forgiveness.`;
  }
  return `An estimated $${amount} would be forgiven after ${lifetimeCost.termYears} years, tax-free under current federal rules.`;
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
  const baselineLifetimeCost = baselineMonthlyPayment * STANDARD_TERM_MONTHS;

  const results: AnalysisResult = {
    eligibleStrategies: [],
    ineligibleFor: [],
    recommendations: [],
    baselineMonthlyPayment: Math.round(baselineMonthlyPayment),
    baselineLifetimeCost: Math.round(baselineLifetimeCost),
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
  // mandatory whenever the borrower holds federal debt. A refinance at a rate
  // that covers its own interest always fully amortizes over the term by
  // construction, so its lifetime cost is just monthly x term -- no
  // simulation needed, and there is never a forgiven-balance/tax question.
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
    const targetRate = ILLUSTRATIVE_REFINANCE_RATES[borrower.creditScoreBand as string];
    const refinancedMonthly = standardMonthlyPayment(totalBalance, targetRate);
    const refinancedTotal = refinancedMonthly * STANDARD_TERM_MONTHS;

    refinance.estimatedAnnualSavings = refinanceSavings;
    refinance.estimatedMonthlyPayment = Math.round(refinancedMonthly);
    refinance.lifetimeCost = {
      totalPaid: Math.round(refinancedTotal),
      termYears: STANDARD_TERM_YEARS,
      paidOffBeforeTerm: true,
      deltaVsBaseline: Math.round(refinancedTotal - baselineLifetimeCost),
    };
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

  // Strategy B: Income-driven repayment. Direct loans only. Also feeds PSLF
  // below, which forgives at 120 payments under whichever qualifying IDR plan
  // the borrower would actually use.
  const activeIdrPlans = config.idrPlans.filter((plan) => plan.status === 'active');
  let cheapestIdrForPslf: { monthly: number; mode: 'capitalizing' | 'rap-assisted' } | null = null;

  if (hasDirectLoans) {
    for (const plan of activeIdrPlans) {
      const isRap = plan.name === 'RAP';
      const monthly = isRap
        ? calculateRapPayment(borrower, config)
        : calculateIbrPayment(borrower, plan, config);

      const termYears = resolveForgivenessTermYears(plan.forgivenessTerm);
      const simulation = simulatePayoff(
        totalBalance,
        weightedAverageRate,
        monthly,
        termYears * 12,
        isRap ? 'rap-assisted' : 'capitalizing',
        isRap ? config.rapRules.principalMatchCap : 0
      );
      const taxableFederal = (
        config.forgivenessTaxTreatment[plan.name] as { taxableFederal?: boolean } | undefined
      )?.taxableFederal;
      const lifetimeCost = buildLifetimeCost(
        simulation,
        termYears,
        baselineLifetimeCost,
        taxableFederal
      );

      if (!cheapestIdrForPslf || monthly < cheapestIdrForPslf.monthly) {
        cheapestIdrForPslf = { monthly, mode: isRap ? 'rap-assisted' : 'capitalizing' };
      }

      const tradeoffs = isRap
        ? [
            'Payment set by an AGI bracket, reduced per dependent',
            'Unpaid interest is waived and principal is matched up to $50/month, so the balance still amortizes',
            'New plan, effective July 1, 2026',
          ]
        : [
            'Payment set by discretionary income',
            'The only IDR plan with permanent statutory status',
          ];

      const warnings = [lifetimeCostWarning(lifetimeCost), forgivenessWarning(lifetimeCost)].filter(
        (w): w is string => w !== null
      );

      results.eligibleStrategies.push({
        id: `idr_${plan.name.toLowerCase()}`,
        title: `Income-Driven Repayment (${plan.name})`,
        estimatedMonthlyPayment: Math.round(monthly),
        estimatedAnnualSavings: Math.max(0, Math.round((baselineMonthlyPayment - monthly) * 12)),
        lifetimeCost,
        tradeoffs,
        ...(warnings.length > 0 ? { warnings } : {}),
      });
    }
  } else {
    results.recommendations.push('Consolidate FFEL/Perkins loans to access federal IDR plans');
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
          'Consolidation produces a weighted average of any PSLF qualifying-payment counts on the loans involved -- it does not preserve the highest count. Confirm your counts on studentaid.gov before consolidating if you are close to 120 payments.',
        ],
      });

      results.recommendations.push(
        `Consolidate your ${affected} loans before ${config.consolidationDeadline.historicalDeadline} to keep IDR and PSLF eligibility.`
      );
    }
  }

  // Strategy D: PSLF. Direct loans plus qualifying employment. Forgiveness is
  // modeled at 120 payments under whichever active IDR plan gives the
  // borrower the lowest qualifying payment, since that is the rational choice
  // and PSLF itself does not set the payment amount.
  const pslfEligibleEmployment = borrower.employmentSector === 'Nonprofit/Government (PSLF)';

  if (pslfEligibleEmployment && hasDirectLoans) {
    const tradeoffs = [
      'Requires a qualifying nonprofit or government employer',
      'Requires 120 qualifying payments while on a qualifying repayment plan',
    ];

    if (borrower.yearsInQualifyingRepayment !== undefined) {
      const paymentsMade = Math.min(120, Math.round(borrower.yearsInQualifyingRepayment * 12));
      tradeoffs.unshift(
        `Roughly ${paymentsMade} of 120 qualifying payments, based on the years you entered`
      );
    }

    const strategy: Strategy = { id: 'pslf', title: 'Public Service Loan Forgiveness (PSLF)', tradeoffs };

    if (cheapestIdrForPslf) {
      const pslfTermYears = config.pslfRules.qualifyingPayments / 12;
      const simulation = simulatePayoff(
        totalBalance,
        weightedAverageRate,
        cheapestIdrForPslf.monthly,
        config.pslfRules.qualifyingPayments,
        cheapestIdrForPslf.mode,
        cheapestIdrForPslf.mode === 'rap-assisted' ? config.rapRules.principalMatchCap : 0
      );
      const lifetimeCost = buildLifetimeCost(
        simulation,
        pslfTermYears,
        baselineLifetimeCost,
        (config.forgivenessTaxTreatment.PSLF as { taxableFederal?: boolean } | undefined)
          ?.taxableFederal
      );

      strategy.estimatedMonthlyPayment = Math.round(cheapestIdrForPslf.monthly);
      strategy.lifetimeCost = lifetimeCost;

      const forgiveWarning = forgivenessWarning(lifetimeCost);
      if (forgiveWarning) strategy.warnings = [forgiveWarning];
      else if (!lifetimeCost.paidOffBeforeTerm) {
        // paidOffBeforeTerm is false but no forgivenBalance is a state that
        // should not occur; leaving this branch out rather than silently
        // asserting a number we have not actually computed.
      } else {
        tradeoffs.push('Your estimated balance would be paid off before reaching forgiveness');
      }
    }

    results.eligibleStrategies.push(strategy);
  } else if (pslfEligibleEmployment && !hasDirectLoans && hasFederalLoans) {
    results.recommendations.push(
      'PSLF requires Direct loans. Your federal loans would need to be consolidated into a Direct Consolidation Loan to qualify.'
    );
  }

  // Ranking: by monthly cash-flow relief, with strategies that have no
  // quantifiable relief (e.g. consolidation) after those that do. This is a
  // ranking by relief, not by total cost -- a strategy can rank highly here
  // and still carry a lifetimeCostWarning. That tension is deliberate: both
  // numbers are real, and burying either one would be its own kind of
  // misleading.
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
