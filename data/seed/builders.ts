import type {
  BalanceSheet,
  CashFlowStatement,
  FinancialPeriod,
  IncomeStatement,
  MonthlyTurnover,
} from '@/types/financials';
import type { EvidenceStatus, SourceType, TracedValue, UUID } from '@/types/core';
import { tv } from '@/types/core';
import type {
  Collateral,
  CreditDocument,
  CreditFacility,
  CreditBureauReport,
  DocumentCategory,
  GroupMember,
  PurposeLine,
} from '@/types/application';

/**
 * Seed-data builders.
 *
 * All demo data is synthetic. Real customer names, tax IDs, phone numbers,
 * addresses and account numbers from the reference material are never used —
 * only the *shape* of the risk (growth outrunning cash conversion, serial
 * refinancing, thin documentation) is carried across.
 */

let counter = 0;
/** Deterministic ids so re-rendering never changes the demo. */
export function id(prefix: string): UUID {
  counter += 1;
  return `${prefix}-${counter.toString().padStart(6, '0')}`;
}

export function resetIds(): void {
  counter = 0;
}

type Ev = EvidenceStatus;
type Src = SourceType;

export function v(raw: number, src: Src = 'CUSTOMER_DOCUMENT', ev: Ev = 'PARTIALLY_VERIFIED', extra: Partial<TracedValue> = {}): TracedValue {
  return tv(raw, src, ev, extra);
}

export function period(
  applicationId: UUID,
  label: string,
  year: number,
  periodType: FinancialPeriod['periodType'],
  startDate: string,
  endDate: string,
  monthsCovered: number,
  isPrimary = false,
): FinancialPeriod {
  return {
    id: id('per'),
    applicationId,
    label,
    year,
    periodType,
    startDate,
    endDate,
    monthsCovered,
    isPrimary,
  };
}

export interface BalanceInput {
  cash: number;
  receivables: number;
  inventory: number;
  otherCurrentAssets?: number;
  fixedAssets: number;
  otherNonCurrentAssets?: number;
  shortTermBankDebt: number;
  payables: number;
  otherCurrentLiabilities?: number;
  longTermBankDebt?: number;
  otherLiabilities?: number;
  shareCapital: number;
  /**
   * Omit to let the builder plug it so total assets equal liabilities plus
   * equity. The source workbook does the same (`L22 = L27 − L4`), and it keeps
   * seeded balance sheets internally consistent, so a failing balance-integrity
   * check always means a real data problem rather than a typo in a fixture.
   */
  retainedEarnings?: number;
  ownerContributions?: number;
  ownerWithdrawals?: number;
  otherEquity?: number;
  evidence?: Partial<Record<keyof BalanceInput, [Src, Ev]>>;
}

export function balance(periodId: UUID, input: BalanceInput): BalanceSheet {
  const e = (k: keyof BalanceInput, fallback: [Src, Ev] = ['CUSTOMER_DOCUMENT', 'PARTIALLY_VERIFIED']) =>
    input.evidence?.[k] ?? fallback;

  const mk = (k: keyof BalanceInput, value = 0) => {
    const [src, ev] = e(k);
    return v(value, src, ev);
  };

  const totalAssets =
    input.cash +
    input.receivables +
    input.inventory +
    (input.otherCurrentAssets ?? 0) +
    input.fixedAssets +
    (input.otherNonCurrentAssets ?? 0);
  const totalLiabilities =
    input.shortTermBankDebt +
    input.payables +
    (input.otherCurrentLiabilities ?? 0) +
    (input.longTermBankDebt ?? 0) +
    (input.otherLiabilities ?? 0);

  const retained =
    input.retainedEarnings ??
    totalAssets -
      totalLiabilities -
      input.shareCapital -
      (input.ownerContributions ?? 0) +
      (input.ownerWithdrawals ?? 0) -
      (input.otherEquity ?? 0);

  return {
    periodId,
    cash: mk('cash', input.cash),
    receivables: mk('receivables', input.receivables),
    inventory: mk('inventory', input.inventory),
    otherCurrentAssets: mk('otherCurrentAssets', input.otherCurrentAssets ?? 0),
    fixedAssets: mk('fixedAssets', input.fixedAssets),
    otherNonCurrentAssets: mk('otherNonCurrentAssets', input.otherNonCurrentAssets ?? 0),
    shortTermBankDebt: mk('shortTermBankDebt', input.shortTermBankDebt),
    payables: mk('payables', input.payables),
    otherCurrentLiabilities: mk('otherCurrentLiabilities', input.otherCurrentLiabilities ?? 0),
    longTermBankDebt: mk('longTermBankDebt', input.longTermBankDebt ?? 0),
    otherLiabilities: mk('otherLiabilities', input.otherLiabilities ?? 0),
    shareCapital: mk('shareCapital', input.shareCapital),
    retainedEarnings: mk('retainedEarnings', retained),
    ownerContributions: mk('ownerContributions', input.ownerContributions ?? 0),
    ownerWithdrawals: mk('ownerWithdrawals', input.ownerWithdrawals ?? 0),
    otherEquity: mk('otherEquity', input.otherEquity ?? 0),
  };
}

export interface IncomeInput {
  sales: number;
  cogs: number;
  operatingExpenses: number;
  depreciation: number;
  interestExpense: number;
  otherIncome?: number;
  otherExpenses?: number;
  tax: number;
  evidence?: Partial<Record<keyof IncomeInput, [Src, Ev]>>;
}

export function income(periodId: UUID, input: IncomeInput): IncomeStatement {
  const e = (k: keyof IncomeInput, fallback: [Src, Ev] = ['CUSTOMER_DOCUMENT', 'PARTIALLY_VERIFIED']) =>
    input.evidence?.[k] ?? fallback;
  const mk = (k: keyof IncomeInput, value = 0) => {
    const [src, ev] = e(k);
    return v(value, src, ev);
  };

  return {
    periodId,
    sales: mk('sales', input.sales),
    cogs: mk('cogs', input.cogs),
    operatingExpenses: mk('operatingExpenses', input.operatingExpenses),
    depreciation: mk('depreciation', input.depreciation),
    interestExpense: mk('interestExpense', input.interestExpense),
    otherIncome: mk('otherIncome', input.otherIncome ?? 0),
    otherExpenses: mk('otherExpenses', input.otherExpenses ?? 0),
    tax: mk('tax', input.tax),
  };
}

export interface CashFlowInput {
  openingCash: number;
  customerReceipts: number;
  supplierPayments: number;
  payroll: number;
  rent: number;
  taxPaid: number;
  otherOperatingExpenses: number;
  capex?: number;
  ownerInjection?: number;
  ownerWithdrawal?: number;
  newBorrowing?: number;
  principalRepaid?: number;
  interestPaid: number;
  evidence?: Partial<Record<keyof CashFlowInput, [Src, Ev]>>;
}

export function cashFlow(periodId: UUID, input: CashFlowInput): CashFlowStatement {
  const e = (k: keyof CashFlowInput, fallback: [Src, Ev] = ['BANK_STATEMENT', 'PARTIALLY_VERIFIED']) =>
    input.evidence?.[k] ?? fallback;
  const mk = (k: keyof CashFlowInput, value = 0) => {
    const [src, ev] = e(k);
    return v(value, src, ev);
  };

  return {
    periodId,
    openingCash: mk('openingCash', input.openingCash),
    customerReceipts: mk('customerReceipts', input.customerReceipts),
    supplierPayments: mk('supplierPayments', input.supplierPayments),
    payroll: mk('payroll', input.payroll),
    rent: mk('rent', input.rent),
    taxPaid: mk('taxPaid', input.taxPaid),
    otherOperatingExpenses: mk('otherOperatingExpenses', input.otherOperatingExpenses),
    capex: mk('capex', input.capex ?? 0),
    ownerInjection: mk('ownerInjection', input.ownerInjection ?? 0),
    ownerWithdrawal: mk('ownerWithdrawal', input.ownerWithdrawal ?? 0),
    newBorrowing: mk('newBorrowing', input.newBorrowing ?? 0),
    principalRepaid: mk('principalRepaid', input.principalRepaid ?? 0),
    interestPaid: mk('interestPaid', input.interestPaid),
  };
}

export function facility(input: Partial<CreditFacility> & Pick<CreditFacility, 'lender' | 'originalAmount' | 'issueDate' | 'maturityDate'>): CreditFacility {
  const outstanding = input.outstanding ?? 0;
  return {
    id: id('fac'),
    subjectName: input.subjectName ?? 'Sifarişçi',
    lender: input.lender,
    isAtb: input.isAtb ?? input.lender === 'Azər-Türk Bank',
    product: input.product ?? 'Biznes krediti',
    originalAmount: input.originalAmount,
    outstanding,
    currency: input.currency ?? 'AZN',
    issueDate: input.issueDate,
    maturityDate: input.maturityDate,
    monthlyPayment: input.monthlyPayment ?? 0,
    currentDpd: input.currentDpd ?? 0,
    maxDpd: input.maxDpd ?? 0,
    dpd30PlusEvents: input.dpd30PlusEvents ?? 0,
    status: input.status ?? (outstanding > 0 ? 'ACTIVE' : 'CLOSED'),
    closureDate: input.closureDate,
    earlyClosure: input.earlyClosure,
    collateralised: input.collateralised ?? false,
  };
}

export function bureauReport(
  applicationId: UUID,
  subjectName: string,
  inquiryDate: string,
  acbMicroScore: number | null,
  facilities: CreditFacility[],
  extra: Partial<CreditBureauReport> = {},
): CreditBureauReport {
  return {
    id: id('akb'),
    applicationId,
    subjectName,
    inquiryDate,
    reportReference: `AKB-${id('ref').slice(-6)}`,
    acbMicroScore,
    facilities,
    guarantees: extra.guarantees ?? [],
    inquiries: extra.inquiries ?? [],
    individualBureauRating: extra.individualBureauRating,
    acbMicroRating: extra.acbMicroRating,
  };
}

export function groupMember(
  name: string,
  relationship: GroupMember['relationship'],
  atbExposure: number,
  externalExposure: number,
  extra: Partial<GroupMember> = {},
): GroupMember {
  return {
    id: id('grp'),
    name,
    relationship,
    atbExposure,
    externalExposure,
    requestedExposure: extra.requestedExposure ?? 0,
    guaranteesGiven: extra.guaranteesGiven ?? 0,
    includeInGroup: extra.includeInGroup ?? true,
    taxId: extra.taxId,
    note: extra.note,
  };
}

export function collateralItem(
  input: Partial<Collateral> & Pick<Collateral, 'type' | 'description' | 'ownerName' | 'marketValue'>,
): Collateral {
  return {
    id: id('col'),
    type: input.type,
    description: input.description,
    ownerName: input.ownerName,
    ownerRelationship: input.ownerRelationship ?? 'SHAREHOLDER',
    marketValue: input.marketValue,
    forcedSaleValue: input.forcedSaleValue ?? input.marketValue * 0.75,
    haircutOverridePct: input.haircutOverridePct,
    lienRanking: input.lienRanking ?? 1,
    existingLienAmount: input.existingLienAmount ?? 0,
    valuationDate: input.valuationDate ?? '2026-06-15',
    appraiser: input.appraiser ?? 'Müstəqil qiymətləndirici A',
    insured: input.insured ?? true,
    insuranceExpiry: input.insuranceExpiry,
    registered: input.registered ?? true,
    evidence: input.evidence ?? 'VERIFIED',
    currency: input.currency ?? 'AZN',
  };
}

export function document(
  applicationId: UUID,
  category: DocumentCategory,
  name: string,
  evidence: EvidenceStatus,
  extra: Partial<CreditDocument> = {},
): CreditDocument {
  return {
    id: id('doc'),
    applicationId,
    category,
    name,
    documentDate: extra.documentDate,
    sourceType: extra.sourceType ?? 'CUSTOMER_DOCUMENT',
    uploadedBy: extra.uploadedBy ?? 'RM',
    uploadedAt: extra.uploadedAt ?? '2026-07-02T10:00:00.000Z',
    verifiedBy: extra.verifiedBy,
    evidence,
    relatedMetrics: extra.relatedMetrics ?? [],
    expiryDate: extra.expiryDate,
    mandatory: extra.mandatory ?? true,
    received: extra.received ?? evidence !== 'MISSING',
  };
}

export function purposeLine(
  category: PurposeLine['category'],
  description: string,
  amount: number,
  evidence: EvidenceStatus,
  businessBenefit: string,
  controlMechanism: string,
  extra: Partial<PurposeLine> = {},
): PurposeLine {
  return {
    id: id('pur'),
    category,
    description,
    amount,
    evidence,
    evidenceDocument: extra.evidenceDocument,
    businessBenefit,
    controlMechanism,
    effectiveness: extra.effectiveness,
  };
}

export function monthlyTurnover(
  periodId: UUID,
  months: string[],
  bankPerMonth: number,
  posPerMonth: number,
  cashPerMonth: number,
  declaredPerMonth: number,
  taxDeclaredPerMonth: number,
): MonthlyTurnover[] {
  return months.map((month) => ({
    periodId,
    month,
    bankCredits: bankPerMonth,
    posTurnover: posPerMonth,
    cashSales: cashPerMonth,
    declaredSales: declaredPerMonth,
    taxDeclaredSales: taxDeclaredPerMonth,
    currency: 'AZN' as const,
    sourceType: 'BANK_STATEMENT' as const,
  }));
}

export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}
