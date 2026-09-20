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
  timeSensitiveNotices: {
    autopayDiscount: {
      standardDiscountPercent: number;
      boostedDiscountPercent: number;
      enrollByDate: string;
      boostExpiresDate: string;
    };
    saveTransition: {
      firstWaveDeadlineExample: string;
      lastWaveDeadlineExample: string;
    };
  };
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
  comparisonSites: Array<{
    name: string;
    url: string;
    affiliate?: boolean;
    disclosure?: string;
  }>;
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
  /**
   * Dollar-figure risk disclosures (lifetime cost, forgiven balance) --
   * paywalled with the rest of the strategy's numbers. For risk disclosures
   * that carry no dollar figure, see riskWarnings.
   */
  warnings?: string[];
  /**
   * Eligibility- and risk-critical text that carries no dollar figure, e.g.
   * "refinancing forfeits federal protections permanently." Meant to be
   * shown on the free tier regardless of payment status: burying an
   * irreversible-risk warning behind a paywall protects the wrong thing.
   */
  riskWarnings?: string[];
  /**
   * Where to actually start this strategy -- a federal portal for
   * idr/consolidation/pslf, or a neutral multi-lender comparison site for
   * refinance (never a single lender, so this never picks a "winner").
   * Paywalled with the rest of the strategy's numbers, like the card itself.
   */
  actionUrl?: string;
  actionUrlLabel?: string;
  /** FTC-required affiliate disclosure for actionUrl, when it applies. */
  actionDisclosure?: string;
}

export interface AnalysisResult {
  eligibleStrategies: Strategy[];
  ineligibleFor: string[];
  recommendations: string[];
  /**
   * Universal, time-sensitive facts unrelated to which strategy the borrower
   * picks -- the autopay interest-rate discount, the SAVE-plan transition
   * window. Kept separate from recommendations (which are advice specific to
   * this borrower's situation) since these apply to nearly every federal
   * borrower regardless of what else the analysis finds, and belong at the
   * top of the page rather than mixed into "Worth knowing".
   */
  notices: string[];
  /** The standard 10-year payment that savings figures are measured against. */
  baselineMonthlyPayment: number;
  /** Total paid over the standard 10-year baseline -- the reference point for every lifetimeCost.deltaVsBaseline. */
  baselineLifetimeCost: number;
}

const STANDARD_TERM_YEARS = 10;
const STANDARD_TERM_MONTHS = STANDARD_TERM_YEARS * 12;

/** "2026-09-30" -> "September 30, 2026". Dates in config are ISO for sorting/comparison; this is for display. */
const formatDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

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

const isParentPlus = (type: Loan['type']): boolean => type === 'Direct PLUS (Parent)';

/**
 * Direct loans reach IDR/PSLF directly -- except Parent PLUS, which RAP
 * excludes outright and which only ever reached IBR via ICR after
 * consolidating by 2026-06-30, a window now closed for anyone who had not
 * already acted. See docs/counselor-expert-review.md #1.
 */
const isIdrEligibleDirect = (type: Loan['type']): boolean => isDirect(type) && !isParentPlus(type);

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

/** Balance-weighted average rate across a set of loans, or 0 if none. */
const weightedRate = (loans: Loan[]): { balance: number; rate: number } => {
  const balance = loans.reduce((sum, loan) => sum + loan.balance, 0);
  const rate =
    balance > 0 ? loans.reduce((sum, loan) => sum + loan.balance * loan.interestRate, 0) / balance : 0;
  return { balance, rate };
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
  const { balance, rate } = weightedRate(loans);
  if (balance <= 0) return 0;
  return Math.ceil(rate * 8) / 8;
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

/** A plain-language line for the lifetime-cost delta. Carries a dollar figure -- paywalled via Strategy.warnings. */
const lifetimeCostWarning = (lifetimeCost: LifetimeCost): string | null => {
  if (lifetimeCost.deltaVsBaseline <= 0) return null;
  const extra = lifetimeCost.deltaVsBaseline.toLocaleString('en-US');
  return `Lower monthly payment, but an estimated $${extra} more paid over ${lifetimeCost.termYears} years than the standard 10-year plan.`;
};

/** Carries a dollar figure -- paywalled via Strategy.warnings, unlike riskWarnings. */
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
  const { balance: totalBalance, rate: weightedAverageRate } = weightedRate(loans);

  const baselineMonthlyPayment = standardMonthlyPayment(totalBalance, weightedAverageRate);
  const baselineLifetimeCost = baselineMonthlyPayment * STANDARD_TERM_MONTHS;

  const results: AnalysisResult = {
    eligibleStrategies: [],
    ineligibleFor: [],
    recommendations: [],
    notices: [],
    baselineMonthlyPayment: Math.round(baselineMonthlyPayment),
    baselineLifetimeCost: Math.round(baselineLifetimeCost),
  };

  const portalFor = (type: string) => config.federalPortals.find((p) => p.type === type)?.url;

  // Discharge candidacy is checked first and unconditionally -- including
  // for a borrower in default, where it matters most: Total and Permanent
  // Disability Discharge or Closed School Discharge can be the actual way
  // out of default, not something gated behind resolving it first. A
  // discharge candidate is never blocked from seeing the four strategies
  // below the way default is -- an application can take time or be denied,
  // so the repayment options still have real value in parallel. But a
  // borrower who might qualify should never see four strategies (or the
  // single default message below) with nothing pointing at door zero.
  if (borrower.possibleDischarge) {
    const { disability, closedSchool, borrowerDefense } = borrower.possibleDischarge;
    const dischargeMessages: string[] = [];

    if (disability) {
      const url = portalFor('disability_discharge');
      dischargeMessages.push(
        `Total and Permanent Disability Discharge can cancel your federal loans outright if you have a qualifying disability.${url ? ` Apply at ${url}.` : ''}`
      );
    }
    if (closedSchool) {
      const url = portalFor('closed_school_discharge');
      dischargeMessages.push(
        `Closed School Discharge can cancel your federal loans if your school closed while you were enrolled, or within 120-180 days after you withdrew.${url ? ` Apply at ${url}.` : ''}`
      );
    }
    if (borrowerDefense) {
      const url = portalFor('borrower_defense');
      dischargeMessages.push(
        `Borrower Defense to Repayment can cancel your federal loans if your school misled you or violated certain laws.${url ? ` Apply at ${url}.` : ''}`
      );
    }

    if (dischargeMessages.length > 0) {
      results.recommendations.unshift(
        'Before choosing a repayment strategy below, it is worth checking whether you qualify for a discharge program that would cancel the debt outright:',
        ...dischargeMessages
      );
    }
  }

  // A borrower in default is not enrolling in a new IDR plan, not making
  // PSLF-qualifying payments, and unlikely to be approved for private
  // refinancing -- every other recommendation below assumes a premise this
  // borrower does not have. One clear next step (plus any discharge
  // messages already queued above), nothing else, rather than strategies
  // that would be actively misleading to show as available.
  if (borrower.paymentStatus === 'default') {
    const defaultPortal = config.federalPortals.find((p) => p.type === 'default_rehabilitation');
    results.recommendations.push(
      `Your loans are in default. This blocks new IDR enrollment, PSLF progress, and most refinancing or consolidation options until it is resolved. The first step is getting out of default -- through loan rehabilitation (an agreement to make a set number of on-time payments) or Direct Consolidation.${defaultPortal ? ` Start at ${defaultPortal.url}` : ' Start at studentaid.gov'} or by contacting your loan holder. Come back for a full analysis once that is resolved.`
    );
    return results;
  }

  if (borrower.paymentStatus === 'delinquent') {
    results.recommendations.push(
      'You mentioned you are behind on payments. Before anything else, contact your loan servicer about deferment or forbearance -- pausing payments now is far better than sliding into default, which would block most of the options below. If your loans are private, ask your lender directly: forbearance is not guaranteed the way it is for federal loans.'
    );
  }

  // Loan classification. Federal, Direct, and IDR/PSLF-eligible-Direct are
  // three different things: FFEL and Perkins are federal but not Direct;
  // Parent PLUS is Direct but not IDR/PSLF-eligible (see isIdrEligibleDirect).
  const hasFederalLoans = loans.some((l) => isFederal(l.type));
  const nonDirectFederalLoans = loans.filter((l) => isFederal(l.type) && !isDirect(l.type));
  const parentPlusLoans = loans.filter((l) => isParentPlus(l.type));
  const idrEligibleLoans = loans.filter((l) => isIdrEligibleDirect(l.type));

  // Universal, time-sensitive facts that apply regardless of which strategy
  // is chosen -- not ranked against the four strategies, shown alongside
  // them. See docs/counselor-expert-review.md #2.
  if (hasFederalLoans) {
    const { autopayDiscount, saveTransition } = config.timeSensitiveNotices;
    const enrollByDate = new Date(autopayDiscount.enrollByDate);
    const boostExpiresDate = new Date(autopayDiscount.boostExpiresDate);

    if (today.getTime() <= enrollByDate.getTime()) {
      results.notices.push(
        `Enroll in autopay by ${formatDate(autopayDiscount.enrollByDate)} for a temporary ${autopayDiscount.boostedDiscountPercent}% interest-rate discount on Direct Loans first disbursed after July 1, 2012 (up from the usual ${autopayDiscount.standardDiscountPercent}%) -- no eligibility check, no trade-off, and it applies no matter which strategy below you choose. The boosted rate runs through ${formatDate(autopayDiscount.boostExpiresDate)}.`
      );
    } else if (today.getTime() <= boostExpiresDate.getTime()) {
      results.notices.push(
        `The window to newly enroll for the boosted ${autopayDiscount.boostedDiscountPercent}% autopay discount closed ${formatDate(autopayDiscount.enrollByDate)}. If you were already enrolled, you keep it through ${formatDate(autopayDiscount.boostExpiresDate)}. The standard ${autopayDiscount.standardDiscountPercent}% autopay discount is still available and still free either way.`
      );
    }

    const lastPossibleSaveDeadline = new Date(saveTransition.lastWaveDeadlineExample);
    if (today.getTime() <= lastPossibleSaveDeadline.getTime()) {
      results.notices.push(
        `If you're on the SAVE plan, it was vacated by court order: your servicer gives you a 90-day window to choose a new plan once they notify you, or you're moved to Standard Repayment automatically. The first wave's window closed around ${formatDate(saveTransition.firstWaveDeadlineExample)}; later waves run through ${formatDate(saveTransition.lastWaveDeadlineExample)}. Time in SAVE forbearance does not count toward PSLF or IDR forgiveness -- check your studentaid.gov account for your specific deadline.`
      );
    }
  }

  // IDR/RAP/PSLF are computed against only the balance actually eligible for
  // them. Folding a Parent PLUS balance into the same figure as a borrower's
  // own Direct Subsidized/Unsubsidized debt would overstate what IDR would
  // actually charge, since IDR does not reach that balance at all.
  const { balance: idrBalance, rate: idrRate } = weightedRate(idrEligibleLoans);
  const idrBaselineMonthly = standardMonthlyPayment(idrBalance, idrRate);
  const idrBaselineLifetime = idrBaselineMonthly * STANDARD_TERM_MONTHS;

  if (parentPlusLoans.length > 0) {
    results.ineligibleFor.push(
      'Income-driven repayment and PSLF for your Parent PLUS balance — RAP excludes Parent PLUS loans outright, and the only path to IBR required consolidating by June 30, 2026, which has passed. If you already consolidated before that date, check studentaid.gov for your ICR options directly; otherwise this balance currently has no IDR path.'
    );
  }

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
  const refinanceRiskWarnings: string[] = [];

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

  // A comparison site, never a single lender -- this is a multi-lender
  // shopping tool, not a recommendation of one lender over another.
  const refinanceComparison = config.comparisonSites[0];
  if (refinanceComparison) {
    refinance.actionUrl = refinanceComparison.url;
    refinance.actionUrlLabel = `Compare offers at ${refinanceComparison.name}`;
    if (refinanceComparison.disclosure) refinance.actionDisclosure = refinanceComparison.disclosure;
  }

  if (hasFederalLoans) {
    refinanceRiskWarnings.push(
      'Refinancing a federal loan converts it to private debt and permanently forfeits IDR, RAP, PSLF, deferment and forgiveness eligibility. This cannot be undone.'
    );
  }
  if (borrower.paymentStatus === 'delinquent') {
    refinanceRiskWarnings.push(
      'Being behind on payments may make it harder to qualify for private refinancing -- lenders check payment history.'
    );
  }
  if (refinanceRiskWarnings.length > 0) refinance.riskWarnings = refinanceRiskWarnings;

  // Only surface refinancing when it would actually help, or when we cannot
  // yet tell because the credit band is missing.
  if (refinanceSavings === null && borrower.creditScoreBand) {
    results.ineligibleFor.push('Refinancing — your current rate already beats available offers');
  } else {
    results.eligibleStrategies.push(refinance);
  }

  // Strategy B: Income-driven repayment. IDR-eligible Direct loans only
  // (excludes Parent PLUS -- see isIdrEligibleDirect). Also feeds PSLF below,
  // which forgives at 120 payments under whichever qualifying IDR plan the
  // borrower would actually use.
  const activeIdrPlans = config.idrPlans.filter((plan) => plan.status === 'active');
  let cheapestIdrForPslf: { monthly: number; mode: 'capitalizing' | 'rap-assisted' } | null = null;

  if (idrEligibleLoans.length > 0) {
    for (const plan of activeIdrPlans) {
      const isRap = plan.name === 'RAP';
      const monthly = isRap
        ? calculateRapPayment(borrower, config)
        : calculateIbrPayment(borrower, plan, config);

      const termYears = resolveForgivenessTermYears(plan.forgivenessTerm);
      const simulation = simulatePayoff(
        idrBalance,
        idrRate,
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
        idrBaselineLifetime,
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

      const idrPortal = portalFor('federal_idr');

      const strategy: Strategy = {
        id: `idr_${plan.name.toLowerCase()}`,
        title: `Income-Driven Repayment (${plan.name})`,
        estimatedMonthlyPayment: Math.round(monthly),
        estimatedAnnualSavings: Math.max(0, Math.round((idrBaselineMonthly - monthly) * 12)),
        lifetimeCost,
        tradeoffs,
        ...(warnings.length > 0 ? { warnings } : {}),
        ...(idrPortal ? { actionUrl: idrPortal, actionUrlLabel: 'Apply on studentaid.gov' } : {}),
      };

      if (parentPlusLoans.length > 0) {
        strategy.riskWarnings = [
          `This estimate covers only your Direct Subsidized/Unsubsidized/Grad PLUS balance ($${Math.round(idrBalance).toLocaleString('en-US')}). Your Parent PLUS balance is not included -- see "Not eligible right now" for why.`,
        ];
      }

      results.eligibleStrategies.push(strategy);
    }
  } else if (parentPlusLoans.length === 0 && nonDirectFederalLoans.length > 0) {
    // Parent PLUS holders already got a specific explanation above; an
    // all-private borrower has no federal loans to consolidate at all, and
    // gets nothing here. This is only for FFEL/Perkins holders with no
    // Direct loans yet.
    results.recommendations.push('Consolidate FFEL/Perkins loans to access federal IDR plans');
  }

  // Strategy C: Consolidation, and the eligibility consequences of the
  // deadline having passed.
  if (nonDirectFederalLoans.length > 0) {
    const affected = nonDirectFederalLoans.map((l) => l.type).join(', ');
    const newRate = calculateConsolidationRate(loans);
    const consolidationPortal = portalFor('consolidation');
    const consolidationAction = consolidationPortal
      ? { actionUrl: consolidationPortal, actionUrlLabel: 'Consolidate on studentaid.gov' }
      : {};

    if (pastConsolidationDeadline) {
      results.eligibleStrategies.push({
        id: 'consolidation',
        title: 'Federal Loan Consolidation',
        tradeoffs: [
          'Combines multiple loans into a single payment',
          `New rate would be ${newRate.toFixed(3)}% — the weighted average, rounded up to the nearest 1/8%`,
          'Simplifies repayment, but does not lower your rate',
        ],
        riskWarnings: [
          `The deadline to consolidate ${affected} loans while preserving IDR and PSLF eligibility passed on ${config.consolidationDeadline.historicalDeadline}. Those loans have permanently lost that eligibility, and consolidating now will not restore it.`,
        ],
        ...consolidationAction,
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
        riskWarnings: [
          `Consolidating your ${affected} loans into a Direct Consolidation Loan is a prerequisite for IDR and PSLF, and the deadline to do so while preserving that eligibility is ${config.consolidationDeadline.historicalDeadline}.`,
          'Consolidation produces a weighted average of any PSLF qualifying-payment counts on the loans involved -- it does not preserve the highest count. Confirm your counts on studentaid.gov before consolidating if you are close to 120 payments.',
        ],
        ...consolidationAction,
      });

      results.recommendations.push(
        `Consolidate your ${affected} loans before ${config.consolidationDeadline.historicalDeadline} to keep IDR and PSLF eligibility.`
      );
    }
  }

  // Strategy D: PSLF. IDR-eligible Direct loans plus qualifying employment.
  // Forgiveness is modeled at 120 payments under whichever active IDR plan
  // gives the borrower the lowest qualifying payment, since that is the
  // rational choice and PSLF itself does not set the payment amount.
  const pslfEligibleEmployment = borrower.employmentSector === 'Nonprofit/Government (PSLF)';

  if (pslfEligibleEmployment && idrEligibleLoans.length > 0) {
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

    const pslfPortal = portalFor('pslf');
    if (pslfPortal) {
      strategy.actionUrl = pslfPortal;
      strategy.actionUrlLabel = 'Start the PSLF Help Tool';
    }

    if (parentPlusLoans.length > 0) {
      strategy.riskWarnings = [
        `This estimate covers only your Direct Subsidized/Unsubsidized/Grad PLUS balance ($${Math.round(idrBalance).toLocaleString('en-US')}). Your Parent PLUS balance is not included -- see "Not eligible right now" for why.`,
      ];
    }

    if (cheapestIdrForPslf) {
      const pslfTermYears = config.pslfRules.qualifyingPayments / 12;
      const simulation = simulatePayoff(
        idrBalance,
        idrRate,
        cheapestIdrForPslf.monthly,
        config.pslfRules.qualifyingPayments,
        cheapestIdrForPslf.mode,
        cheapestIdrForPslf.mode === 'rap-assisted' ? config.rapRules.principalMatchCap : 0
      );
      const lifetimeCost = buildLifetimeCost(
        simulation,
        pslfTermYears,
        idrBaselineLifetime,
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
  } else if (pslfEligibleEmployment && idrEligibleLoans.length === 0 && hasFederalLoans) {
    if (parentPlusLoans.length === 0) {
      // Parent PLUS holders already got a specific explanation above; this
      // generic one is only for FFEL/Perkins holders with no Direct loans.
      results.recommendations.push(
        'PSLF requires Direct loans. Your federal loans would need to be consolidated into a Direct Consolidation Loan to qualify.'
      );
    }
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
