import type { FinancialLens } from '@/types/core';
import { safeDiv, valueOf } from '@/types/core';
import type {
  BalanceSheet,
  BalanceSheetTotals,
  CashFlowStatement,
  CashFlowTotals,
  IncomeStatement,
  IncomeStatementTotals,
} from '@/types/financials';

/**
 * Statement roll-ups.
 *
 * These mirror the `Balans chart` / `MZH chart` / `Cash chart` sheets of the
 * ATB opinion workbook: the raw input statements are re-mapped into the
 * analytical categories that every downstream ratio references.
 */

export function balanceTotals(bs: BalanceSheet, lens: FinancialLens = 'ADJUSTED'): BalanceSheetTotals {
  const v = (k: keyof BalanceSheet) => valueOf(bs[k] as never, lens);

  const currentAssets = v('cash') + v('receivables') + v('inventory') + v('otherCurrentAssets');
  const nonCurrentAssets = v('fixedAssets') + v('otherNonCurrentAssets');
  const totalAssets = currentAssets + nonCurrentAssets;

  const currentLiabilities = v('shortTermBankDebt') + v('payables') + v('otherCurrentLiabilities');
  const nonCurrentLiabilities = v('longTermBankDebt') + v('otherLiabilities');
  const totalLiabilities = currentLiabilities + nonCurrentLiabilities;

  const totalEquity =
    v('shareCapital') + v('retainedEarnings') + v('ownerContributions') - v('ownerWithdrawals') + v('otherEquity');

  const totalBankDebt = v('shortTermBankDebt') + v('longTermBankDebt');

  return {
    cash: v('cash'),
    receivables: v('receivables'),
    inventory: v('inventory'),
    payables: v('payables'),
    currentAssets,
    nonCurrentAssets,
    totalAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    totalLiabilities,
    totalEquity,
    totalBankDebt,
    netDebt: totalBankDebt - v('cash'),
    workingCapital: currentAssets - currentLiabilities,
    balanceCheck: totalAssets - (totalLiabilities + totalEquity),
  };
}

export function incomeTotals(is: IncomeStatement, lens: FinancialLens = 'ADJUSTED'): IncomeStatementTotals {
  const v = (k: keyof IncomeStatement) => valueOf(is[k] as never, lens);

  const sales = v('sales');
  const cogs = v('cogs');
  const grossProfit = sales - cogs;
  const operatingExpenses = v('operatingExpenses');
  const ebitda = grossProfit - operatingExpenses;
  const depreciation = v('depreciation');
  const ebit = ebitda - depreciation;
  const interestExpense = v('interestExpense');
  const otherIncome = v('otherIncome');
  const otherExpenses = v('otherExpenses');
  const profitBeforeTax = ebit - interestExpense + otherIncome - otherExpenses;
  const tax = v('tax');
  const netProfit = profitBeforeTax - tax;

  return {
    sales,
    cogs,
    grossProfit,
    grossMargin: safeDiv(grossProfit, sales),
    operatingExpenses,
    ebitda,
    ebitdaMargin: safeDiv(ebitda, sales),
    depreciation,
    ebit,
    interestExpense,
    otherIncome,
    otherExpenses,
    profitBeforeTax,
    tax,
    netProfit,
    netMargin: safeDiv(netProfit, sales),
  };
}

export function cashFlowTotals(cf: CashFlowStatement, lens: FinancialLens = 'ADJUSTED'): CashFlowTotals {
  const v = (k: keyof CashFlowStatement) => valueOf(cf[k] as never, lens);

  const operatingInflow = v('customerReceipts');
  const operatingOutflow = v('supplierPayments') + v('payroll') + v('rent') + v('taxPaid') + v('otherOperatingExpenses');
  const netOperatingCashFlow = operatingInflow - operatingOutflow - v('interestPaid');
  const investingCashFlow = -v('capex');
  const financingCashFlow =
    v('ownerInjection') - v('ownerWithdrawal') + v('newBorrowing') - v('principalRepaid');
  const netChangeInCash = netOperatingCashFlow + investingCashFlow + financingCashFlow;

  return {
    openingCash: v('openingCash'),
    operatingInflow,
    operatingOutflow,
    netOperatingCashFlow,
    investingCashFlow,
    financingCashFlow,
    netChangeInCash,
    endingCash: v('openingCash') + netChangeInCash,
  };
}

/**
 * Monthly DSCR as implemented in the workbook:
 *   (net operating cash flow + interest paid) / (interest paid + principal repaid)
 * Interest is added back because it sits inside the operating outflow.
 */
export function periodDscr(cf: CashFlowStatement, lens: FinancialLens = 'ADJUSTED'): number | null {
  const t = cashFlowTotals(cf, lens);
  const interest = valueOf(cf.interestPaid, lens);
  const principal = valueOf(cf.principalRepaid, lens);
  return safeDiv(t.netOperatingCashFlow + interest, interest + principal);
}
