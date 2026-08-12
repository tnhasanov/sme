import { safeDiv } from '@/types/core';
import type { ForecastMonth, ForecastSummary } from '@/types/financials';
import type { LoanStructure } from '@/types/application';
import { buildSchedule } from './amortisation';

/**
 * Monthly forecast cash flow (§23).
 *
 * Built from an operating baseline plus seasonality, then overlaid with the
 * existing debt service and the proposed facility's own schedule, so the UI
 * can show the month in which the structure actually bites.
 */

export interface ForecastAssumptions {
  startMonth: string; // YYYY-MM
  months: number;
  openingCash: number;

  monthlySalesReceipts: number;
  salesGrowthMonthlyPct: number;
  /** 12 weights averaging 1.0; index 0 is January. */
  seasonalityIndex: number[];

  /** Share of receipts paid out to suppliers. */
  cogsRatio: number;
  monthlyPayroll: number;
  monthlyOpex: number;
  monthlyTax: number;
  monthlyOwnerWithdrawals: number;

  capexByMonth?: Record<number, number>;
  financingInflowByMonth?: Record<number, number>;

  /** Existing facilities kept after the transaction. */
  existingMonthlyPrincipal: number;
  existingMonthlyInterest: number;
  existingRemainingMonths: number;

  /** The proposed facility, if any. */
  proposedStructure?: LoanStructure;
  /** Disbursement month index (0-based). */
  disbursementMonth?: number;
}

export function buildForecast(a: ForecastAssumptions): ForecastSummary {
  const newLoanSchedule = a.proposedStructure ? buildSchedule(a.proposedStructure) : null;
  const disburse = a.disbursementMonth ?? 0;

  const months: ForecastMonth[] = [];
  let cash = a.openingCash;
  const [startYear, startMonth] = a.startMonth.split('-').map(Number);

  for (let i = 0; i < a.months; i += 1) {
    const date = new Date(Date.UTC(startYear, startMonth - 1 + i, 1));
    const label = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const seasonal = a.seasonalityIndex[date.getUTCMonth()] ?? 1;

    const salesReceipts = a.monthlySalesReceipts * Math.pow(1 + a.salesGrowthMonthlyPct, i) * seasonal;
    const supplierPayments = salesReceipts * a.cogsRatio;
    const capex = a.capexByMonth?.[i] ?? 0;
    const financingInflow = a.financingInflowByMonth?.[i] ?? 0;

    const existingActive = i < a.existingRemainingMonths;
    const existingDebtPrincipal = existingActive ? a.existingMonthlyPrincipal : 0;
    const existingDebtInterest = existingActive ? a.existingMonthlyInterest : 0;

    const newRow = newLoanSchedule && i >= disburse ? newLoanSchedule.rows[i - disburse] : undefined;
    const newDebtPrincipal = newRow?.principal ?? 0;
    const newDebtInterest = newRow?.interest ?? 0;

    const disbursement = a.proposedStructure && i === disburse ? a.proposedStructure.amount : 0;

    const openingCash = cash;
    const closingCash =
      openingCash +
      salesReceipts +
      financingInflow +
      disbursement -
      supplierPayments -
      a.monthlyPayroll -
      a.monthlyOpex -
      a.monthlyTax -
      capex -
      a.monthlyOwnerWithdrawals -
      existingDebtPrincipal -
      existingDebtInterest -
      newDebtPrincipal -
      newDebtInterest;

    months.push({
      index: i,
      label,
      openingCash,
      salesReceipts,
      supplierPayments,
      payroll: a.monthlyPayroll,
      tax: a.monthlyTax,
      opex: a.monthlyOpex,
      capex,
      existingDebtPrincipal,
      existingDebtInterest,
      newDebtPrincipal,
      newDebtInterest,
      ownerWithdrawals: a.monthlyOwnerWithdrawals,
      financingInflow: financingInflow + disbursement,
      closingCash,
    });

    cash = closingCash;
  }

  return summariseForecast(months);
}

export function summariseForecast(months: ForecastMonth[]): ForecastSummary {
  const dscrByMonth = months.map((m) => {
    const debtService = m.existingDebtPrincipal + m.existingDebtInterest + m.newDebtPrincipal + m.newDebtInterest;
    const operatingCash =
      m.salesReceipts - m.supplierPayments - m.payroll - m.opex - m.tax - m.ownerWithdrawals;
    return safeDiv(operatingCash, debtService);
  });

  const withDebt = dscrByMonth.filter((d): d is number => d !== null);
  const minCashMonth = months.reduce(
    (best, m) => (m.closingCash < best.closingCash ? m : best),
    months[0] ?? {
      closingCash: 0,
      label: '—',
    } as ForecastMonth,
  );

  return {
    months,
    minimumCash: minCashMonth?.closingCash ?? 0,
    minimumCashMonth: minCashMonth?.label ?? '—',
    negativeMonths: months.filter((m) => m.closingCash < 0).length,
    liquidityGap: Math.min(...months.map((m) => m.closingCash), 0),
    worstMonthlyDscr: withDebt.length ? Math.min(...withDebt) : null,
    averageMonthlyDscr: withDebt.length ? withDebt.reduce((s, d) => s + d, 0) / withDebt.length : null,
  };
}
