import { safeDiv } from '@/types/core';
import type { CashFlowTotals, IncomeStatementTotals } from '@/types/financials';

/**
 * Repayment capacity (§34) — the central underwriting metric.
 *
 * Two conventions coexist in the ATB material and both are produced here,
 * because the stop factor is defined on the ATB convention while DSCR-based
 * structuring needs the cash convention:
 *
 *  1. `capacityAtb` reproduces MZH!Q6 — average monthly retained profit plus
 *     the debt-service items that were charged as costs, minus the payments
 *     that will remain at other banks after the deal. It is the denominator
 *     of the 0.8 coefficient (MZH!Q10).
 *  2. `cfads` is a cash-flow-based figure: normalised operating cash earnings
 *     less tax, maintenance capex, working-capital absorption and owner
 *     withdrawals. It drives DSCR and the maximum-sustainable-loan solver.
 */

export interface RepaymentCapacityInput {
  income: IncomeStatementTotals;
  cash?: CashFlowTotals;
  monthsCovered: number;

  /** Monthly averages, all positive numbers. */
  monthlyOwnerWithdrawals: number;
  monthlyMaintenanceCapex: number;
  /**
   * Only applied when CFADS is derived from EBITDA. A direct-method cash-flow
   * statement already embeds the working-capital movement, so subtracting it
   * again would double-count the same drag.
   */
  monthlyWorkingCapitalAbsorption: number;
  monthlyRecurringObligations: number;

  /** Debt service, monthly. */
  existingMonthlyDebtService: number;
  monthlyDebtServiceBeingRefinanced: number;
  proposedMonthlyDebtService: number;

  /** Interest and principal charged inside operating costs (ATB convention). */
  monthlyInterestInCosts: number;
  monthlyPrincipalInCosts: number;
  /** Payments that remain at other banks after the transaction. */
  monthlyPaymentsRemainingElsewhere: number;
}

export interface RepaymentCapacityResult {
  monthlyEbitda: number;
  monthlyTax: number;
  monthlyNetProfit: number;

  /** ATB "Proqnoz ödəmə qabiliyyəti" (MZH!Q6). */
  capacityAtb: number;
  /** Cash flow available for debt service. */
  cfads: number;

  existingDebtService: number;
  debtServiceRefinanced: number;
  proposedDebtService: number;
  postTransactionDebtService: number;

  /** Aylıq ödəniş / proqnoz ödəmə qabiliyyəti — the 0.8 test. */
  paymentToCapacity: number | null;
  /** Bütün ödənişlərin bölüşdürülməmiş mənfəətlə ödənilməsi. */
  allPaymentsToRetainedProfit: number | null;

  dscrBefore: number | null;
  dscrAfter: number | null;
  headroomMonthly: number;
  hasCapacity: boolean;
}

const perMonth = (annualish: number, months: number) => (months > 0 ? annualish / months : 0);

export function computeRepaymentCapacity(input: RepaymentCapacityInput): RepaymentCapacityResult {
  const m = input.monthsCovered || 12;

  const monthlyEbitda = perMonth(input.income.ebitda, m);
  const monthlyTax = perMonth(input.income.tax, m);
  const monthlyNetProfit = perMonth(input.income.netProfit, m);
  const monthlyInterest = perMonth(input.income.interestExpense, m);

  /* ---- ATB convention (MZH!Q6) ---- */
  const retainedProfitMonthly = monthlyNetProfit - input.monthlyOwnerWithdrawals;
  const capacityAtb =
    retainedProfitMonthly +
    input.monthlyInterestInCosts +
    input.monthlyPrincipalInCosts -
    input.monthlyPaymentsRemainingElsewhere;

  /* ---- Cash convention (CFADS) ---- */
  // Interest is added back: CFADS must cover interest and principal alike,
  // and net operating cash flow already has interest deducted.
  const operatingCashMonthly = input.cash
    ? perMonth(input.cash.netOperatingCashFlow, m) + monthlyInterest
    : monthlyEbitda - monthlyTax;

  const workingCapitalDrag = input.cash ? 0 : input.monthlyWorkingCapitalAbsorption;

  const cfads =
    operatingCashMonthly -
    input.monthlyMaintenanceCapex -
    workingCapitalDrag -
    input.monthlyOwnerWithdrawals -
    input.monthlyRecurringObligations;

  const postTransactionDebtService =
    input.existingMonthlyDebtService - input.monthlyDebtServiceBeingRefinanced + input.proposedMonthlyDebtService;

  const allPaymentsBefore = retainedProfitMonthly + input.monthlyInterestInCosts + input.monthlyPrincipalInCosts;

  return {
    monthlyEbitda,
    monthlyTax,
    monthlyNetProfit,

    capacityAtb,
    cfads,

    existingDebtService: input.existingMonthlyDebtService,
    debtServiceRefinanced: input.monthlyDebtServiceBeingRefinanced,
    proposedDebtService: input.proposedMonthlyDebtService,
    postTransactionDebtService,

    // A non-positive capacity is not a small ratio — it is no capacity at all.
    // Returning the raw quotient would produce a negative number that silently
    // satisfies a "≤ 0.8" policy rule.
    paymentToCapacity:
      capacityAtb > 0 ? safeDiv(input.proposedMonthlyDebtService, capacityAtb) : Number.POSITIVE_INFINITY,
    allPaymentsToRetainedProfit:
      allPaymentsBefore > 0 ? safeDiv(postTransactionDebtService, allPaymentsBefore) : Number.POSITIVE_INFINITY,

    dscrBefore: safeDiv(cfads, input.existingMonthlyDebtService),
    dscrAfter: safeDiv(cfads, postTransactionDebtService),
    headroomMonthly: cfads - postTransactionDebtService,
    hasCapacity: capacityAtb > 0 && cfads > postTransactionDebtService,
  };
}

/**
 * Sensitivity block from the MZH sheet: by how much can each driver move
 * before capacity falls below the proposed payment?
 */
export interface CapacityBreakEven {
  salesDeclinePct: number | null;
  marginDeclinePct: number | null;
  costIncreasePct: number | null;
  debtServiceIncreasePct: number | null;
  noCapacity: boolean;
}

export function capacityBreakEven(
  result: RepaymentCapacityResult,
  income: IncomeStatementTotals,
  monthsCovered: number,
): CapacityBreakEven {
  const m = monthsCovered || 12;
  const monthlySales = perMonth(income.sales, m);
  const monthlyGrossProfit = perMonth(income.grossProfit, m);
  const monthlyOpex = perMonth(income.operatingExpenses, m);
  const grossMargin = safeDiv(income.grossProfit, income.sales);

  const headroom = result.capacityAtb - result.proposedDebtService;
  if (result.capacityAtb <= 0 || headroom <= 0) {
    return {
      salesDeclinePct: null,
      marginDeclinePct: null,
      costIncreasePct: null,
      debtServiceIncreasePct: null,
      noCapacity: true,
    };
  }

  return {
    // A sales fall reduces capacity by the gross margin on the lost sales.
    salesDeclinePct:
      grossMargin && monthlySales > 0 ? (headroom / (monthlySales * grossMargin)) * 100 : null,
    marginDeclinePct: monthlyGrossProfit > 0 ? (headroom / monthlyGrossProfit) * 100 : null,
    costIncreasePct: monthlyOpex > 0 ? (headroom / monthlyOpex) * 100 : null,
    debtServiceIncreasePct:
      result.proposedDebtService > 0 ? (headroom / result.proposedDebtService) * 100 : null,
    noCapacity: false,
  };
}
