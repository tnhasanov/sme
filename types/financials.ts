import type { Currency, EvidenceStatus, ISODate, ISODateTime, SourceType, TracedValue, UUID } from './core';

/** Financial period kind — §19 requires 3 historical years + YTD + 2 forecasts. */
export const PERIOD_TYPES = ['HISTORICAL', 'YTD', 'FORECAST'] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

export interface FinancialPeriod {
  id: UUID;
  applicationId: UUID;
  label: string; // "2025", "2026 YTD", "2027F"
  year: number;
  periodType: PeriodType;
  startDate: ISODate;
  endDate: ISODate;
  monthsCovered: number;
  /** True when this period is the anchor for ratio/policy evaluation. */
  isPrimary?: boolean;
}

/** §20 Balance sheet — Balans. */
export interface BalanceSheet {
  periodId: UUID;
  // Assets
  cash: TracedValue;
  receivables: TracedValue;
  inventory: TracedValue;
  otherCurrentAssets: TracedValue;
  fixedAssets: TracedValue;
  otherNonCurrentAssets: TracedValue;
  // Liabilities
  shortTermBankDebt: TracedValue;
  payables: TracedValue;
  otherCurrentLiabilities: TracedValue;
  longTermBankDebt: TracedValue;
  otherLiabilities: TracedValue;
  // Equity
  shareCapital: TracedValue;
  retainedEarnings: TracedValue;
  ownerContributions: TracedValue;
  ownerWithdrawals: TracedValue;
  otherEquity: TracedValue;
}

/** Derived balance sheet totals — never stored, always computed. */
export interface BalanceSheetTotals {
  /** Individual lines under the active lens, so ratios need no second lookup. */
  cash: number;
  receivables: number;
  inventory: number;
  payables: number;
  currentAssets: number;
  nonCurrentAssets: number;
  totalAssets: number;
  currentLiabilities: number;
  nonCurrentLiabilities: number;
  totalLiabilities: number;
  totalEquity: number;
  totalBankDebt: number;
  netDebt: number;
  workingCapital: number;
  balanceCheck: number; // Assets - (Liabilities + Equity); must be ~0
}

/** §21 Income statement — Mənfəət və Zərər Haqqında hesabat (MZH). */
export interface IncomeStatement {
  periodId: UUID;
  sales: TracedValue;
  cogs: TracedValue;
  operatingExpenses: TracedValue;
  depreciation: TracedValue;
  interestExpense: TracedValue;
  otherIncome: TracedValue;
  otherExpenses: TracedValue;
  tax: TracedValue;
}

export interface IncomeStatementTotals {
  sales: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number | null;
  operatingExpenses: number;
  ebitda: number;
  ebitdaMargin: number | null;
  depreciation: number;
  ebit: number;
  interestExpense: number;
  otherIncome: number;
  otherExpenses: number;
  profitBeforeTax: number;
  tax: number;
  netProfit: number;
  netMargin: number | null;
}

/** §22 Current (actual) cash flow — direct method, as ATB analysts collect it. */
export interface CashFlowStatement {
  periodId: UUID;
  openingCash: TracedValue;
  customerReceipts: TracedValue;
  supplierPayments: TracedValue;
  payroll: TracedValue;
  rent: TracedValue;
  taxPaid: TracedValue;
  otherOperatingExpenses: TracedValue;
  capex: TracedValue;
  ownerInjection: TracedValue;
  ownerWithdrawal: TracedValue;
  newBorrowing: TracedValue;
  principalRepaid: TracedValue;
  interestPaid: TracedValue;
}

export interface CashFlowTotals {
  openingCash: number;
  operatingInflow: number;
  operatingOutflow: number;
  netOperatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  netChangeInCash: number;
  endingCash: number;
}

/** §23 Monthly forecast cash flow row. */
export interface ForecastMonth {
  index: number;
  label: string; // "2026-09"
  openingCash: number;
  salesReceipts: number;
  supplierPayments: number;
  payroll: number;
  tax: number;
  opex: number;
  capex: number;
  existingDebtPrincipal: number;
  existingDebtInterest: number;
  newDebtPrincipal: number;
  newDebtInterest: number;
  ownerWithdrawals: number;
  financingInflow: number;
  closingCash: number;
}

export interface ForecastSummary {
  months: ForecastMonth[];
  minimumCash: number;
  minimumCashMonth: string;
  negativeMonths: number;
  liquidityGap: number;
  worstMonthlyDscr: number | null;
  averageMonthlyDscr: number | null;
}

/** §24 Adjustment — append-only; original value is never mutated. */
export const ADJUSTMENT_TARGETS = [
  'BALANCE_SHEET',
  'INCOME_STATEMENT',
  'CASH_FLOW',
] as const;
export type AdjustmentTarget = (typeof ADJUSTMENT_TARGETS)[number];

export const ADJUSTMENT_REASONS = [
  'NORMALIZE_EBITDA',
  'REMOVE_ONE_OFF_INCOME',
  'UNSUPPORTED_INVENTORY',
  'RECEIVABLE_HAIRCUT',
  'NON_BUSINESS_ASSET',
  'SHAREHOLDER_LOAN_RECLASS',
  'UNDOCUMENTED_TURNOVER',
  'RELATED_PARTY_ELIMINATION',
  'OTHER',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export interface FinancialAdjustment {
  id: UUID;
  applicationId: UUID;
  periodId: UUID;
  target: AdjustmentTarget;
  field: string;
  originalValue: number;
  adjustedValue: number;
  difference: number;
  reason: AdjustmentReason;
  narrative: string;
  evidence: EvidenceStatus;
  analyst: string;
  createdAt: ISODateTime;
}

/** Bank / POS turnover used for the §31 turnover reconciliation. */
export interface MonthlyTurnover {
  periodId: UUID;
  month: string; // YYYY-MM
  bankCredits: number;
  posTurnover: number;
  cashSales: number;
  declaredSales: number;
  taxDeclaredSales: number;
  currency: Currency;
  sourceType: SourceType;
}
